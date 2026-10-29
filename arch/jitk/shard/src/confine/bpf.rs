//! A small seccomp-BPF compiler: an ordered list of syscall rules becomes a
//! classic BPF program that checks the architecture, then returns the action
//! of the first rule whose syscall number and argument conditions match, and
//! kills the process otherwise. `eval` interprets a program the way the
//! kernel does, so the policies are tested on any host.

/// AUDIT_ARCH_AARCH64: seccomp_data.arch of a native arm64 syscall.
pub const AUDIT_ARCH_AARCH64: u32 = 0xC000_00B7;

const RET_KILL_PROCESS: u32 = 0x8000_0000;
const RET_ERRNO: u32 = 0x0005_0000;
const RET_ALLOW: u32 = 0x7fff_0000;

/// What the filter does with a matching syscall.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Action {
    Allow,
    /// Fail the call with this errno (for probes a library makes and handles).
    Errno(u16),
    /// SIGSYS for the whole process, never just the calling thread.
    KillProcess,
}
impl Action {
    fn ret(self) -> u32 {
        match self {
            Action::Allow => RET_ALLOW,
            Action::Errno(e) => RET_ERRNO | e as u32,
            Action::KillProcess => RET_KILL_PROCESS,
        }
    }
    /// The action of a seccomp return value (inverse of `ret`).
    pub fn from_ret(ret: u32) -> Self {
        match ret & 0xffff_0000 {
            RET_ALLOW => Action::Allow,
            RET_ERRNO => Action::Errno(ret as u16),
            _ => Action::KillProcess,
        }
    }
}

/// A condition on one 64-bit syscall argument.
#[derive(Clone, Copy, Debug)]
pub enum Arg {
    /// `args[i] == value`.
    Eq(u8, u64),
    /// `args[i] & mask == value`.
    Masked(u8, u64, u64),
}

/// A syscall and when it gets `action`: always if `any_of` is empty, else
/// when every condition of one of its alternatives holds. A call to `nr`
/// that matches no alternative kills the process.
#[derive(Clone, Debug)]
pub struct Rule {
    pub nr: u32,
    pub any_of: Vec<Vec<Arg>>,
    pub action: Action,
}
impl Rule {
    pub fn allow(nr: u32) -> Self {
        Self {
            nr,
            any_of: Vec::new(),
            action: Action::Allow,
        }
    }
    /// Allow `nr` only with these arguments.
    pub fn allow_if(nr: u32, all: &[Arg]) -> Self {
        Self::allow_any(nr, &[all])
    }
    /// Allow `nr` when one of these argument sets matches.
    pub fn allow_any(nr: u32, any_of: &[&[Arg]]) -> Self {
        assert!(!any_of.is_empty() && any_of.iter().all(|all| !all.is_empty()));
        Self {
            nr,
            any_of: any_of.iter().map(|all| all.to_vec()).collect(),
            action: Action::Allow,
        }
    }
    pub fn errno(nr: u32, errno: u16) -> Self {
        Self {
            nr,
            any_of: Vec::new(),
            action: Action::Errno(errno),
        }
    }
}

/// One classic BPF instruction; the layout of the kernel's `struct sock_filter`.
#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Insn {
    pub code: u16,
    pub jt: u8,
    pub jf: u8,
    pub k: u32,
}
const LD_W_ABS: u16 = 0x20;
const ALU_AND_K: u16 = 0x54;
const JMP_JEQ_K: u16 = 0x15;
const RET_K: u16 = 0x06;
/// seccomp_data offsets: nr, arch, then instruction pointer and args[6].
const NR: u32 = 0;
const ARCH: u32 = 4;
const ARGS: u32 = 16;
/// The kernel's limit (BPF_MAXINSNS).
const MAX_INSNS: usize = 4096;

fn load(offset: u32) -> Insn {
    Insn {
        code: LD_W_ABS,
        jt: 0,
        jf: 0,
        k: offset,
    }
}
fn ret(action: u32) -> Insn {
    Insn {
        code: RET_K,
        jt: 0,
        jf: 0,
        k: action,
    }
}
/// Fall through when the accumulator equals `k`, else skip `skip`.
fn equal_or_skip(k: u32, skip: usize) -> Insn {
    Insn {
        code: JMP_JEQ_K,
        jt: 0,
        jf: u8::try_from(skip).expect("seccomp rule too long for one jump"),
        k,
    }
}

/// The instructions that return `action` if every condition of `all` holds,
/// and fall through to the instruction after them otherwise.
fn alternative(all: &[Arg], action: Action) -> Vec<Insn> {
    // Each 64-bit comparison is two 32-bit ones (little-endian halves); the
    // jump targets are patched once the block's length is known.
    let mut block = Vec::new();
    for condition in all {
        let (index, mask, value) = match *condition {
            Arg::Eq(i, v) => (i, u64::MAX, v),
            Arg::Masked(i, m, v) => (i, m, v),
        };
        assert!(index < 6, "syscall argument index");
        let low = ARGS + 8 * index as u32;
        for (offset, mask, value) in [
            (low, mask as u32, value as u32),
            (low + 4, (mask >> 32) as u32, (value >> 32) as u32),
        ] {
            assert_eq!(value & !mask, 0, "condition value outside its mask");
            block.push(load(offset));
            if mask != u32::MAX {
                block.push(Insn {
                    code: ALU_AND_K,
                    jt: 0,
                    jf: 0,
                    k: mask,
                });
            }
            block.push(equal_or_skip(value, 0));
        }
    }
    block.push(ret(action.ret()));
    let len = block.len();
    for (at, insn) in block.iter_mut().enumerate() {
        if insn.code == JMP_JEQ_K {
            // A mismatch skips the rest of this block, including its RET.
            insn.jf = u8::try_from(len - at - 1).expect("seccomp alternative too long");
        }
    }
    block
}

/// The program for `rules` (first match wins; anything else kills the
/// process, as does a syscall of another architecture).
pub fn compile(rules: &[Rule]) -> Vec<Insn> {
    let mut program = vec![
        load(ARCH),
        // The native architecture skips the kill.
        Insn {
            code: JMP_JEQ_K,
            jt: 1,
            jf: 0,
            k: AUDIT_ARCH_AARCH64,
        },
        ret(RET_KILL_PROCESS),
        load(NR),
    ];
    for rule in rules {
        let mut body = Vec::new();
        if rule.any_of.is_empty() {
            body.push(ret(rule.action.ret()));
        } else {
            for all in &rule.any_of {
                body.extend(alternative(all, rule.action));
            }
            // The syscall matched but none of its argument sets did.
            body.push(ret(RET_KILL_PROCESS));
        }
        // Every path through a body returns, so a body that loads arguments
        // never falls through; a mismatch skips it with the number still
        // in the accumulator.
        program.push(equal_or_skip(rule.nr, body.len()));
        program.extend(body);
    }
    program.push(ret(RET_KILL_PROCESS));
    assert!(program.len() <= MAX_INSNS, "seccomp program too long");
    program
}

/// Run `program` on one syscall, as the kernel does; returns the action.
pub fn eval(program: &[Insn], arch: u32, nr: u32, args: [u64; 6]) -> Action {
    let word = |offset: u32| -> u32 {
        match offset {
            NR => nr,
            ARCH => arch,
            o if o >= ARGS => {
                let arg = args[((o - ARGS) / 8) as usize];
                if (o - ARGS).is_multiple_of(8) {
                    arg as u32
                } else {
                    (arg >> 32) as u32
                }
            }
            _ => 0,
        }
    };
    let (mut pc, mut acc) = (0usize, 0u32);
    loop {
        let insn = program[pc];
        match insn.code {
            LD_W_ABS => acc = word(insn.k),
            ALU_AND_K => acc &= insn.k,
            JMP_JEQ_K => pc += if acc == insn.k { insn.jt } else { insn.jf } as usize,
            RET_K => return Action::from_ret(insn.k),
            code => panic!("unexpected BPF instruction {code:#x}"),
        }
        pc += 1;
    }
}

#[cfg(test)]
mod tests {
    use super::{AUDIT_ARCH_AARCH64, Action, Arg, Rule, compile, eval};
    const READ: u32 = 63;
    const WRITE: u32 = 64;
    const IOCTL: u32 = 29;
    fn rules() -> Vec<Rule> {
        vec![
            Rule::allow(READ),
            Rule::allow_if(WRITE, &[Arg::Eq(2, 8)]),
            Rule::allow_any(
                IOCTL,
                &[&[Arg::Eq(1, 0xae80)], &[Arg::Masked(1, 0xff00, 0xab00)]],
            ),
            Rule::errno(435, 38),
        ]
    }
    fn run(nr: u32, args: [u64; 6]) -> Action {
        eval(&compile(&rules()), AUDIT_ARCH_AARCH64, nr, args)
    }
    #[test]
    fn first_matching_rule_wins_and_the_rest_is_killed() {
        assert_eq!(run(READ, [0; 6]), Action::Allow);
        assert_eq!(run(WRITE, [5, 0, 8, 0, 0, 0]), Action::Allow);
        assert_eq!(run(WRITE, [5, 0, 9, 0, 0, 0]), Action::KillProcess);
        assert_eq!(run(435, [0; 6]), Action::Errno(38));
        assert_eq!(run(56, [0; 6]), Action::KillProcess);
    }
    #[test]
    fn conditions_compare_all_64_bits() {
        assert_eq!(run(IOCTL, [3, 0xae80, 0, 0, 0, 0]), Action::Allow);
        assert_eq!(
            run(IOCTL, [3, 1 << 32 | 0xae80, 0, 0, 0, 0]),
            Action::KillProcess
        );
        assert_eq!(run(IOCTL, [3, 0xab42, 0, 0, 0, 0]), Action::Allow);
        assert_eq!(run(IOCTL, [3, 0xac42, 0, 0, 0, 0]), Action::KillProcess);
    }
    #[test]
    fn another_architecture_is_killed() {
        let program = compile(&rules());
        assert_eq!(
            eval(&program, 0xC000_003E, READ, [0; 6]),
            Action::KillProcess
        );
    }
}

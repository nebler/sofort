// Generates src/kvm_abi.rs, the Linux arm64 KVM UAPI constants the shard
// uses (ioctl numbers, ONE_REG ids, kvm_run offsets). Run by the pinned Node
// (type stripping), like snapshot.ts:
//
//   abi-gen.ts           rewrite src/kvm_abi.rs
//   abi-gen.ts --check   exit 1 when src/kvm_abi.rs differs from the output
//
// The values are derived here from the UAPI encoding rules, not read from a
// header, so the build needs no C compiler and works on any host:
//   ioctl     _IOC(dir, type, nr, size) = dir << 30 | size << 16 | type << 8 | nr
//             (asm-generic/ioctl.h; arm64 uses the generic layout), KVMIO 0xAE
//   ONE_REG   KVM_REG_ARM64 | KVM_REG_SIZE_U64 | class | index
//             (linux/kvm.h, arch/arm64/include/uapi/asm/kvm.h)
//   kvm_run   the fixed head (u8, u8, u8[6], u32 exit_reason, ...) and the
//             mmio member of the exit union at offset 32
// The Linux test tests/kvm_abi.rs compiles the same names against the host's
// installed headers and compares every line with the checked-in file.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KVMIO = 0xaen;
const NONE = 0n;
const WRITE = 1n;
const READ = 2n;
function ioc(dir: bigint, nr: number, size: number): bigint {
  return (dir << 30n) | (BigInt(size) << 16n) | (KVMIO << 8n) | BigInt(nr);
}
const io = (nr: number): bigint => ioc(NONE, nr, 0);
const ior = (nr: number, size: number): bigint => ioc(READ, nr, size);
const iow = (nr: number, size: number): bigint => ioc(WRITE, nr, size);
const iowr = (nr: number, size: number): bigint => ioc(READ | WRITE, nr, size);

// sizeof the ioctl argument structs (all fields naturally aligned, no padding).
const KVM_USERSPACE_MEMORY_REGION = 4 + 4 + 8 + 8 + 8; // slot, flags, guest_phys_addr, memory_size, userspace_addr
const KVM_VCPU_INIT = 4 + 7 * 4; // target, features[7]
const KVM_ONE_REG = 8 + 8; // id, addr
const KVM_REG_LIST = 8; // n, then the flexible reg[]
const KVM_MP_STATE = 4; // mp_state
const KVM_ENABLE_CAP = 4 + 4 + 4 * 8 + 64; // cap, flags, args[4], pad[64]

const KVM_REG_ARM64 = 0x6000000000000000n;
const KVM_REG_SIZE_U64 = 0x0030000000000000n;
const KVM_REG_ARM_COPROC_SHIFT = 16n;
const KVM_REG_ARM_CORE = 0x0010n << KVM_REG_ARM_COPROC_SHIFT;
const KVM_REG_ARM64_SYSREG = 0x0013n << KVM_REG_ARM_COPROC_SHIFT;
function sysreg(op0: number, op1: number, crn: number, crm: number, op2: number): bigint {
  const field = (value: number, shift: bigint, mask: bigint): bigint => (BigInt(value) << shift) & mask;
  return KVM_REG_ARM64 | KVM_REG_SIZE_U64 | KVM_REG_ARM64_SYSREG | field(op0, 14n, 0xc000n) | field(op1, 11n, 0x3800n) | field(crn, 7n, 0x0780n) | field(crm, 3n, 0x0078n) | field(op2, 0n, 0x0007n);
}
// struct kvm_regs begins with struct user_pt_regs { u64 regs[31]; u64 sp; u64 pc; u64 pstate; };
// a core register id carries its byte offset in 32-bit units.
function core(byteOffset: number): bigint {
  return KVM_REG_ARM64 | KVM_REG_SIZE_U64 | KVM_REG_ARM_CORE | BigInt(byteOffset / 4);
}

// struct kvm_run: request_interrupt_window u8 @0, immediate_exit u8 @1,
// padding1[6], exit_reason u32 @8, ...; the exit union starts at 32 and its
// mmio member is { u64 phys_addr; u8 data[8]; u32 len; u8 is_write; }, its
// arm_nisv member { u64 esr_iss; u64 fault_ipa; }.
const RUN_UNION = 32;

// Order and names are the generated file's (and the header test's) contract.
export const CONSTANTS: [string, 'u64' | 'usize', bigint][] = [
  ['KVM_GET_API_VERSION', 'u64', io(0x00)],
  ['KVM_CREATE_VM', 'u64', io(0x01)],
  ['KVM_CREATE_VCPU', 'u64', io(0x41)],
  ['KVM_GET_VCPU_MMAP_SIZE', 'u64', io(0x04)],
  ['KVM_SET_USER_MEMORY_REGION', 'u64', iow(0x46, KVM_USERSPACE_MEMORY_REGION)],
  ['KVM_RUN', 'u64', io(0x80)],
  ['KVM_ARM_PREFERRED_TARGET', 'u64', ior(0xaf, KVM_VCPU_INIT)],
  ['KVM_ARM_VCPU_INIT', 'u64', iow(0xae, KVM_VCPU_INIT)],
  ['KVM_GET_ONE_REG', 'u64', iow(0xab, KVM_ONE_REG)],
  ['KVM_SET_ONE_REG', 'u64', iow(0xac, KVM_ONE_REG)],
  ['KVM_MEM_READONLY', 'u64', 1n << 1n],
  ['KVM_GET_REG_LIST', 'u64', iowr(0xb0, KVM_REG_LIST)],
  ['KVM_EXIT_MMIO', 'u64', 6n],
  ['KVM_ARM_VCPU_PSCI_0_2', 'u64', 2n],
  ['KVM_SET_MP_STATE', 'u64', iow(0x99, KVM_MP_STATE)],
  ['KVM_GET_MP_STATE', 'u64', ior(0x98, KVM_MP_STATE)],
  ['KVM_MP_STATE_RUNNABLE', 'u64', 0n],
  ['KVM_EXIT_SYSTEM_EVENT', 'u64', 24n],
  ['KVM_REG_ARM_TIMER_CNT', 'u64', sysreg(3, 3, 14, 3, 2)],
  ['KVM_REG_ARM64_SYSREG', 'u64', KVM_REG_ARM64_SYSREG],
  ['KVM_REG_ARM64', 'u64', KVM_REG_ARM64],
  ['KVM_REG_SIZE_U64', 'u64', KVM_REG_SIZE_U64],
  ['EXIT_REASON', 'usize', 8n],
  ['IMMEDIATE_EXIT', 'usize', 1n],
  ['MMIO_ADDR', 'usize', BigInt(RUN_UNION)],
  ['MMIO_DATA', 'usize', BigInt(RUN_UNION + 8)],
  ['MMIO_LEN', 'usize', BigInt(RUN_UNION + 16)],
  ['MMIO_WRITE', 'usize', BigInt(RUN_UNION + 20)],
  ['REG_X0', 'u64', core(0)],
  ['REG_PC', 'u64', core(32 * 8)],
  ['REG_PSTATE', 'u64', core(33 * 8)],
  ['REG_SCTLR', 'u64', sysreg(3, 0, 1, 0, 0)],
  ['KVM_CHECK_EXTENSION', 'u64', io(0x03)],
  ['KVM_ENABLE_CAP', 'u64', iow(0xa3, KVM_ENABLE_CAP)],
  ['KVM_CAP_ARM_NISV_TO_USER', 'u64', 177n],
  ['KVM_EXIT_ARM_NISV', 'u64', 28n],
  ['NISV_IPA', 'usize', BigInt(RUN_UNION + 8)],
];

export function render(): string {
  const head = [
    '// @generated by ../abi-gen.ts (Linux arm64 KVM UAPI). Do not edit: change',
    '// abi-gen.ts and run `make -C arch/jitk/shard abi`. tests/kvm_abi.rs checks',
    '// every line against the host headers on Linux.',
  ];
  return [...head, ...CONSTANTS.map(([name, type, value]) => 'pub const ' + name + ': ' + type + ' = ' + value.toString() + ';'), ''].join('\n');
}

const target = join(import.meta.dirname, 'src/kvm_abi.rs');
const text = render();
if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(target, 'utf8');
  } catch {}
  if (current !== text) {
    console.error('shard: src/kvm_abi.rs is stale; run `make -C arch/jitk/shard abi`');
    process.exitCode = 1;
  }
} else {
  writeFileSync(target, text);
}

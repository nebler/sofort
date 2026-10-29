//! `hvf console`: the console kernel profile (kernel `build.sh`, no
//! `transport-ring`) on Hypervisor.framework, with stdin/stdout as its
//! virtio console. A drop-in for the former libkrun launcher's
//! `jitk-vmm --image KERNEL` (vmm/, deleted): the same boot contract
//! (raw image at 2 GiB, FDT at the end of 32 MiB RAM, `x0` = FDT), the same
//! `{"sandbox":"ok"}` acknowledgement on stderr once jitk.sb is applied and
//! before the VM exists, exit status 0 at PSCI SYSTEM_OFF, 70 on an error.
//!
//! Only GrowOS (grow/, scriptc-corpus/) and the kernel and protocol tests run
//! it: their guest programs need the console profile's stdin, path syscalls
//! and the inline `\x1e` trace on stdout, which the ring profile does not
//! carry (yet). The executor and MCP use the ring engine (`hvf ipc`). Deleted
//! together with the console profile once those move to the ring.
//!
//! The device is the virtio-mmio console of `crate::virtio_console` over
//! stdin/stdout. There is no interrupt controller: the FDT names a GIC the
//! kernel never touches because `jitk.tick_us` selects its CNTV fallback
//! (kernel/README.md), and WFI is the only wait. The vtimer stays masked; at
//! a WFI the runner sleeps until CNTV_CVAL or stdin input, then resumes past
//! it. Guest CNTVCT is the host's mach_absolute_time (offset 0), so
//! `jitk.counter` pairs it with the epoch as the libkrun launcher did.
use super::{
    HvfVcpu, HvfVm, REG_PC, check, hv_vcpu_get_sys_reg, hv_vcpu_run, hv_vcpu_set_vtimer_mask,
    seatbelt,
};
use crate::hv::{Region, Vcpu as _, Vm as _};
use crate::virtio_console::{Console, Port};
use std::{
    fs::File,
    io::{self, Read, Write},
    path::PathBuf,
    ptr,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

#[link(name = "Hypervisor", kind = "framework")]
unsafe extern "C" {
    fn hv_vcpu_set_vtimer_offset(vcpu: u64, offset: u64) -> i32;
}
#[repr(C)]
#[derive(Default)]
struct Timebase {
    numer: u32,
    denom: u32,
}
unsafe extern "C" {
    fn mach_absolute_time() -> u64;
    fn mach_timebase_info(info: *mut Timebase) -> i32;
}

/// The console kernel's fixed layout (kernel/src/arch/aarch64: RAM_GPA, fdt.rs
/// RAM_END, mmu.rs device blocks at 0x09e00000 and 0x0a000000).
const RAM_GPA: u64 = 0x8000_0000;
const RAM_BYTES: usize = 32 << 20;
/// libkrun's FDT_MAX_SIZE, at the end of RAM (fdt.rs MAX_BYTES).
const FDT_BYTES: usize = 0x20_0000;
const CONSOLE_GPA: u64 = 0x0a00_0000;
const CONSOLE_BYTES: u64 = 0x1000;
const GICD_GPA: u64 = 0x09ff_0000;
const GICR_GPA: u64 = 0x09fd_0000;
/// The CNTV fallback interval: an idle guest re-checks its console this
/// often. Input wakes it at once, so this only bounds a lost wakeup.
const TICK_US: u64 = 100_000;
const SYS_CNTV_CTL: u16 = 0xdf19;
const SYS_CNTV_CVAL: u16 = 0xdf1a;
const PSCI_CPU_OFF: u64 = 0x8400_0002;
const PSCI_SYSTEM_OFF: u64 = 0x8400_0008;

fn err(m: impl Into<String>) -> io::Error {
    io::Error::other(m.into())
}

struct Options {
    image: PathBuf,
    seed: Option<String>,
    epoch: Option<u64>,
}
impl Options {
    fn parse(args: &[String]) -> io::Result<Self> {
        let (mut image, mut seed, mut epoch) = (None, None, None);
        let mut it = args.iter();
        while let Some(a) = it.next() {
            let mut value = || it.next().ok_or_else(|| err(format!("{a} needs a value")));
            match a.as_str() {
                "--image" => image = Some(PathBuf::from(value()?)),
                "--seed" => seed = Some(value()?.clone()),
                "--epoch-ns" => {
                    epoch = Some(
                        value()?
                            .parse()
                            .map_err(|_| err("--epoch-ns: not a number"))?,
                    )
                }
                // The console kernel's RAM is fixed (fdt.rs RAM_END).
                "--mem-mib" if value()? == "32" => {}
                _ => return Err(err(format!("unknown argument: {a}"))),
            }
        }
        let seed = match seed {
            Some(s) if s.len() == 32 && s.bytes().all(|b| b.is_ascii_hexdigit()) => {
                Some(s.to_ascii_lowercase())
            }
            Some(_) => return Err(err("seed must contain exactly 32 hex digits")),
            None => None,
        };
        Ok(Self {
            image: image.ok_or_else(|| err("--image is required"))?,
            seed,
            epoch,
        })
    }
}

fn now_ticks() -> u64 {
    // SAFETY: no arguments or memory preconditions.
    unsafe { mach_absolute_time() }
}
fn ticks_to_duration(ticks: u64) -> Duration {
    let mut t = Timebase::default();
    // SAFETY: a live out-pointer.
    unsafe { mach_timebase_info(&mut t) };
    Duration::from_nanos(
        (u128::from(ticks) * u128::from(t.numer) / u128::from(t.denom.max(1))) as u64,
    )
}

/// The kernel's boot configuration (fdt.rs `parse`): root with two-cell
/// addresses, `chosen/bootargs`, a GIC node and the virtio-mmio console.
fn fdt(bootargs: &str) -> Vec<u8> {
    struct Fdt {
        st: Vec<u8>,
        strings: Vec<u8>,
    }
    impl Fdt {
        fn word(&mut self, v: u32) {
            self.st.extend_from_slice(&v.to_be_bytes());
        }
        fn pad(&mut self) {
            while !self.st.len().is_multiple_of(4) {
                self.st.push(0);
            }
        }
        fn begin(&mut self, name: &str) {
            self.word(1);
            self.st.extend_from_slice(name.as_bytes());
            self.st.push(0);
            self.pad();
        }
        fn end(&mut self) {
            self.word(2);
        }
        fn prop(&mut self, name: &str, value: &[u8]) {
            let mut key = name.as_bytes().to_vec();
            key.push(0);
            let off = self
                .strings
                .windows(key.len())
                .position(|w| w == key.as_slice())
                .unwrap_or_else(|| {
                    self.strings.extend_from_slice(&key);
                    self.strings.len() - key.len()
                });
            self.word(3);
            self.word(value.len() as u32);
            self.word(off as u32);
            self.st.extend_from_slice(value);
            self.pad();
        }
    }
    let cells = |v: &[u64]| v.iter().flat_map(|x| x.to_be_bytes()).collect::<Vec<u8>>();
    let mut f = Fdt {
        st: Vec::new(),
        strings: Vec::new(),
    };
    f.begin("");
    f.prop("#address-cells", &2u32.to_be_bytes());
    f.prop("#size-cells", &2u32.to_be_bytes());
    f.begin("chosen");
    f.prop("bootargs", format!("{bootargs}\0").as_bytes());
    f.end();
    f.begin("intc@9ff0000");
    f.prop("compatible", b"arm,gic-v3\0");
    f.prop("reg", &cells(&[GICD_GPA, 0x10000, GICR_GPA, 0x20000]));
    f.end();
    f.begin("virtio_mmio@a000000");
    f.prop("compatible", b"virtio,mmio\0");
    f.prop("reg", &cells(&[CONSOLE_GPA, CONSOLE_BYTES]));
    f.prop("interrupts", &[0, 0, 0, 0, 0, 0, 0, 16, 0, 0, 0, 1]);
    f.end();
    f.end();
    f.word(9);
    let (rsv, st) = (40usize, 56usize);
    let strings = st + f.st.len();
    let total = strings + f.strings.len();
    let mut b = Vec::with_capacity(total);
    for v in [
        0xd00d_feed,
        total,
        st,
        strings,
        rsv,
        17,
        16,
        0,
        f.strings.len(),
        f.st.len(),
    ] {
        b.extend_from_slice(&(v as u32).to_be_bytes());
    }
    b.extend_from_slice(&[0; 16]);
    b.extend_from_slice(&f.st);
    b.extend_from_slice(&f.strings);
    b
}

/// Guest RAM as the device sees it: the runner's mapping, borrowed only
/// while the vCPU is stopped.
struct GuestRam(*mut u8);
impl AsMut<[u8]> for GuestRam {
    fn as_mut(&mut self) -> &mut [u8] {
        // SAFETY: the RAM_BYTES mapping lives until the process exits. The
        // device runs only on the vCPU thread between hv_vcpu_run calls, when
        // the guest cannot touch RAM, and holds the slice for one access.
        unsafe { std::slice::from_raw_parts_mut(self.0, RAM_BYTES) }
    }
}

/// The console port on stdin/stdout. Input is read unbuffered: input left in
/// a userspace buffer would not wake poll.
struct Stdio;
impl Read for Stdio {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        // SAFETY: buf is writable for its length; read keeps no pointer.
        match unsafe { libc::read(0, buf.as_mut_ptr().cast(), buf.len()) } {
            n if n >= 0 => Ok(n as usize),
            _ => Err(io::Error::last_os_error()),
        }
    }
}
impl Write for Stdio {
    fn write(&mut self, b: &[u8]) -> io::Result<usize> {
        io::stdout().write(b)
    }
    fn flush(&mut self) -> io::Result<()> {
        io::stdout().flush()
    }
}
impl Port for Stdio {
    fn readable(&mut self, wait: Option<Duration>) -> bool {
        let ms = wait.map_or(-1, |d| d.as_millis().min(i32::MAX as u128) as i32);
        let mut fd = libc::pollfd {
            fd: 0,
            events: libc::POLLIN,
            revents: 0,
        };
        // SAFETY: one live pollfd.
        unsafe { libc::poll(&mut fd, 1, ms) > 0 }
    }
}
type Device = Console<GuestRam, Stdio>;

/// WFI: sleep until the armed CNTV deadline or stdin input.
fn idle(dev: &mut Device, cpu: &HvfVcpu) -> io::Result<()> {
    let sys = |r: u16| -> io::Result<u64> {
        let mut v = 0;
        check(
            // SAFETY: own vCPU on its creating thread; live out-pointer.
            unsafe { hv_vcpu_get_sys_reg(cpu.id, r, &mut v) },
            "hv_vcpu_get_sys_reg",
        )?;
        Ok(v)
    };
    let (ctl, cval) = (sys(SYS_CNTV_CTL)?, sys(SYS_CNTV_CVAL)?);
    let deadline = (ctl & 3 == 1).then_some(cval);
    let left = || deadline.map(|d| ticks_to_duration(d.saturating_sub(now_ticks())));
    if left() == Some(Duration::ZERO) {
        return Ok(());
    }
    // A buffer the guest got since its last WFI is a pending interrupt: it
    // may have checked its queues just before, so WFI completes.
    if dev.interrupt(left())? {
        return Ok(());
    }
    match left() {
        Some(d) => std::thread::sleep(d),
        None => {
            return Err(err(
                "guest waits with no timer armed and no input to wait for",
            ));
        }
    }
    Ok(())
}

/// `hvf console --image KERNEL [--seed HEX] [--epoch-ns NS] [--mem-mib 32]`.
pub fn run(args: &[String]) -> io::Result<()> {
    let o = Options::parse(args)?;
    let image = std::fs::canonicalize(&o.image)?;
    let seed = match o.seed {
        Some(s) => s,
        None => {
            let mut b = [0u8; 16];
            File::open("/dev/urandom")?.read_exact(&mut b)?;
            b.iter().map(|b| format!("{b:02x}")).collect()
        }
    };
    let (epoch, counter) = match o.epoch {
        Some(e) => (e, now_ticks()),
        None => {
            let mut best = (u64::MAX, 0, 0);
            for _ in 0..5 {
                let before = now_ticks();
                let epoch = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .map_err(|e| err(e.to_string()))?
                    .as_nanos() as u64;
                let after = now_ticks();
                if after - before < best.0 {
                    best = (after - before, epoch, before + (after - before) / 2);
                }
            }
            (best.1, best.2)
        }
    };
    let bootargs = format!(
        "jitk.seed={seed} jitk.epoch_ns={epoch} jitk.counter={counter} jitk.tick_us={TICK_US}"
    );
    // Confined as the engine: jitk.sb for the image's directory, no fork.
    let dir = image
        .parent()
        .ok_or_else(|| err("image has no directory"))?;
    seatbelt::apply(&seatbelt::compile(seatbelt::PROFILE, dir)?)?;
    super::child::confine()?;
    io::stderr().write_all(b"{\"sandbox\":\"ok\"}\n")?;

    // SAFETY: a fresh anonymous private mapping; checked below.
    let ram = unsafe {
        libc::mmap(
            ptr::null_mut(),
            RAM_BYTES,
            libc::PROT_READ | libc::PROT_WRITE,
            libc::MAP_ANON | libc::MAP_PRIVATE,
            -1,
            0,
        )
    };
    if ram == libc::MAP_FAILED {
        return Err(io::Error::last_os_error());
    }
    let mut ram = GuestRam(ram.cast::<u8>());
    let mut file = File::open(&image)?;
    let len = file.metadata()?.len() as usize;
    if len > RAM_BYTES - FDT_BYTES {
        return Err(err(format!(
            "image of {len} bytes does not fit below the FDT"
        )));
    }
    file.read_exact(&mut ram.as_mut()[..len])?;
    let tree = fdt(&bootargs);
    let at = RAM_BYTES - FDT_BYTES;
    ram.as_mut()[at..at + tree.len()].copy_from_slice(&tree);

    let mut vm = HvfVm::create()?;
    // SAFETY: the RAM mapping outlives the VM (never unmapped); page aligned.
    unsafe { vm.map(RAM_GPA, ram.0, RAM_BYTES, Region::Boot)? };
    let mut cpu = vm.vcpu()?;
    check(
        // SAFETY: own vCPU on its creating thread.
        unsafe { hv_vcpu_set_vtimer_offset(cpu.id, 0) },
        "hv_vcpu_set_vtimer_offset",
    )?;
    check(
        // SAFETY: own vCPU on its creating thread.
        unsafe { hv_vcpu_set_vtimer_mask(cpu.id, true) },
        "hv_vcpu_set_vtimer_mask",
    )?;
    cpu.set_entry(RAM_GPA)?;
    cpu.set(0, RAM_GPA + at as u64)?;
    let mut dev = Console::new(ram, RAM_GPA, Stdio);
    loop {
        // SAFETY: own vCPU on its creating thread.
        check(unsafe { hv_vcpu_run(cpu.id) }, "hv_vcpu_run")?;
        // SAFETY: HVF owns this per-vCPU exit record and writes it only inside
        // hv_vcpu_run, which has returned.
        let e = unsafe { ptr::read_volatile(cpu.exit) };
        match e.reason {
            0 => continue,
            1 => {}
            // The vtimer only bounds WFI (`idle`); keep it masked.
            2 => {
                // SAFETY: own vCPU on its creating thread.
                unsafe { hv_vcpu_set_vtimer_mask(cpu.id, true) };
                continue;
            }
            r => return Err(err(format!("unexpected HVF exit {r}"))),
        }
        let (esr, pc) = (e.syndrome, cpu.reg(REG_PC));
        match esr >> 26 {
            // WFI (WFE just resumes).
            0x01 => {
                if esr & 1 == 0 {
                    idle(&mut dev, &cpu)?;
                }
            }
            // HVC: ELR already points past it.
            0x16 => {
                match cpu.reg(0) {
                    PSCI_SYSTEM_OFF | PSCI_CPU_OFF => return dev.port().flush(),
                    // NOT_SUPPORTED.
                    _ => cpu.set(0, u64::MAX)?,
                }
                continue;
            }
            0x24 => {
                let gpa = e.physical_address;
                if esr >> 24 & 1 == 0 || !(CONSOLE_GPA..CONSOLE_GPA + CONSOLE_BYTES).contains(&gpa)
                {
                    return Err(err(format!(
                        "guest access at {gpa:#x} (ESR {esr:#x}, PC {pc:#x}) outside RAM and the console"
                    )));
                }
                let (srt, write) = ((esr >> 16 & 31) as u32, esr >> 6 & 1 == 1);
                if esr >> 22 & 3 != 2 {
                    return Err(err(format!(
                        "console access of {} bytes at {gpa:#x}",
                        1 << (esr >> 22 & 3)
                    )));
                }
                if write {
                    dev.write(
                        gpa - CONSOLE_GPA,
                        if srt == 31 { 0 } else { cpu.reg(srt) as u32 },
                    )?;
                } else {
                    let v = dev.read(gpa - CONSOLE_GPA)?;
                    if srt != 31 {
                        cpu.set(srt, u64::from(v))?;
                    }
                }
            }
            // CNTP_{TVAL,CTL,CVAL}_EL0 trap without a GIC: RAZ/WI (as hvf.rs).
            0x18 if esr & 0x31fc1e == 0x30f804 => {
                let rt = (esr >> 5 & 31) as u32;
                if esr & 1 == 1 && rt != 31 {
                    cpu.set(rt, 0)?;
                }
            }
            ec => {
                return Err(err(format!(
                    "unexpected guest exception EC {ec:#x} (ESR {esr:#x}, PC {pc:#x})"
                )));
            }
        }
        cpu.set(REG_PC, pc + 4)?;
    }
}

/// `hvf console` end to end: hand-assembled EL1 guests (MMU off) on the
/// deps-built engine binary, which `make test-hvf` passes as
/// JITK_SHARD_BINARY.
#[cfg(test)]
mod tests {
    use super::{CONSOLE_GPA, PSCI_SYSTEM_OFF, RAM_GPA};
    use std::{
        io::Read,
        process::{Command, Output, Stdio},
        time::{Duration, Instant},
    };

    /// Where the guests keep their transmit queue (one descriptor).
    const DESC: u64 = RAM_GPA + 0x1_0000;
    const AVAIL: u64 = DESC + 0x100;
    const USED: u64 = DESC + 0x200;
    const BUFFER: u64 = DESC + 0x400;

    /// A64 encodings of the few instructions the guests use.
    struct Asm(Vec<u32>);
    impl Asm {
        /// x`rd` = `v` (movz, then movk per nonzero halfword).
        fn mov(&mut self, rd: u32, v: u64) -> &mut Self {
            self.0.push(0xd280_0000 | ((v & 0xffff) as u32) << 5 | rd);
            for hw in 1..4 {
                let part = (v >> (16 * hw) & 0xffff) as u32;
                if part != 0 {
                    self.0.push(0xf280_0000 | hw << 21 | part << 5 | rd);
                }
            }
            self
        }
        /// str w`rt`, [x`rn`, #off]
        fn str32(&mut self, rt: u32, rn: u32, off: u32) -> &mut Self {
            self.0.push(0xb900_0000 | (off / 4) << 10 | rn << 5 | rt);
            self
        }
        /// A 32-bit store of `v` to register `off` of the device at x1.
        fn reg(&mut self, off: u32, v: u64) -> &mut Self {
            self.mov(2, v).str32(2, 1, off)
        }
        /// Set up transmit queue 1 over the image's queue and notify it.
        fn transmit(&mut self) -> &mut Self {
            self.mov(1, CONSOLE_GPA)
                .reg(0x30, 1)
                .reg(0x38, 1)
                .reg(0x80, DESC)
                .reg(0x90, AVAIL)
                .reg(0xa0, USED)
                .reg(0x44, 1)
                .reg(0x50, 1)
        }
        /// PSCI SYSTEM_OFF (hvc #0).
        fn power_off(&mut self) -> &mut Self {
            self.mov(0, PSCI_SYSTEM_OFF);
            self.0.push(0xd400_0002);
            self
        }
    }

    /// A raw image: `code` at RAM_GPA, one transmit descriptor for `text`
    /// with `flags`/`next`, made available once.
    fn image(code: &Asm, text: &[u8], flags: u16, next: u16) -> Vec<u8> {
        let at = |gpa: u64| (gpa - RAM_GPA) as usize;
        let mut b = vec![0u8; at(BUFFER) + text.len()];
        for (i, w) in code.0.iter().enumerate() {
            b[4 * i..4 * i + 4].copy_from_slice(&w.to_le_bytes());
        }
        let d = at(DESC);
        b[d..d + 8].copy_from_slice(&BUFFER.to_le_bytes());
        b[d + 8..d + 12].copy_from_slice(&(text.len() as u32).to_le_bytes());
        b[d + 12..d + 14].copy_from_slice(&flags.to_le_bytes());
        b[d + 14..d + 16].copy_from_slice(&next.to_le_bytes());
        b[at(AVAIL) + 2] = 1; // idx 1; ring[0] = descriptor 0
        b[at(BUFFER)..].copy_from_slice(text);
        b
    }

    /// Boot `image` on `hvf console` with no input. A guest that never
    /// exits fails the test after 20 s instead of hanging it.
    fn boot(name: &str, image: &[u8]) -> Output {
        let engine = std::env::var("JITK_SHARD_BINARY")
            .expect("JITK_SHARD_BINARY: the hvf engine (make -C arch/jitk/shard test-hvf)");
        let dir = std::env::temp_dir().join(format!("jitk-console-{}-{name}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("image.bin");
        std::fs::write(&path, image).unwrap();
        let mut child = Command::new(engine)
            .args(["console", "--image"])
            .arg(&path)
            .args(["--seed", &"0".repeat(32), "--epoch-ns", "1"])
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        let start = Instant::now();
        let status = loop {
            if let Some(status) = child.try_wait().unwrap() {
                break status;
            }
            if start.elapsed() > Duration::from_secs(20) {
                child.kill().unwrap();
                panic!("{name}: hvf console did not exit");
            }
            std::thread::sleep(Duration::from_millis(5));
        };
        let (mut stdout, mut stderr) = (Vec::new(), Vec::new());
        child
            .stdout
            .take()
            .unwrap()
            .read_to_end(&mut stdout)
            .unwrap();
        child
            .stderr
            .take()
            .unwrap()
            .read_to_end(&mut stderr)
            .unwrap();
        std::fs::remove_dir_all(&dir).unwrap();
        Output {
            status,
            stdout,
            stderr,
        }
    }

    #[test]
    #[ignore = "requires Hypervisor.framework (make test-hvf)"]
    fn a_guest_transmits_and_powers_off() {
        let mut code = Asm(Vec::new());
        code.transmit().power_off();
        let out = boot("ok", &image(&code, b"hello from the guest\n", 0, 0));
        let stderr = String::from_utf8_lossy(&out.stderr);
        assert!(out.status.success(), "{:?}: {stderr}", out.status);
        assert_eq!(out.stdout, b"hello from the guest\n");
        assert_eq!(stderr, "{\"sandbox\":\"ok\"}\n");
    }

    #[test]
    #[ignore = "requires Hypervisor.framework (make test-hvf)"]
    fn hostile_guests_stop_with_status_70() {
        let mut looping = Asm(Vec::new());
        looping.transmit().power_off();
        let mut stray = Asm(Vec::new());
        stray.mov(1, CONSOLE_GPA - 0x1000).reg(0, 1).power_off();
        let mut queue = Asm(Vec::new());
        queue.mov(1, CONSOLE_GPA).reg(0x30, 4).power_off();
        for (name, image, message) in [
            // Descriptor 0 continues with itself.
            (
                "loop",
                image(&looping, b"x", 1, 0),
                "descriptor chain loops",
            ),
            (
                "stray",
                image(&stray, b"", 0, 0),
                "outside RAM and the console",
            ),
            ("queue", image(&queue, b"", 0, 0), "queue 4 does not exist"),
        ] {
            let out = boot(name, &image);
            let stderr = String::from_utf8_lossy(&out.stderr);
            assert_eq!(out.status.code(), Some(70), "{name}: {stderr}");
            assert!(stderr.contains(message), "{name}: {stderr}");
            assert!(out.stdout.is_empty(), "{name}");
        }
    }
}

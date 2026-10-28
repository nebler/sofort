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
//! The device is a virtio-mmio (version 2) console with MULTIPORT and one
//! port, the subset kernel/src/console.rs drives: receive/transmit queues 0/1,
//! control queues 2/3 (DEVICE_READY -> DEVICE_ADD). Every queue is serviced
//! synchronously at the guest's QueueNotify store, so a transmit is complete
//! when the vCPU resumes. There is no interrupt controller: the FDT names a
//! GIC the kernel never touches because `jitk.tick_us` selects its CNTV
//! fallback (kernel/README.md), and WFI is the only wait. The vtimer stays
//! masked; at a WFI the runner sleeps until CNTV_CVAL or stdin input, then
//! resumes past it. Guest CNTVCT is the host's mach_absolute_time (offset 0),
//! so `jitk.counter` pairs it with the epoch as the libkrun launcher did.
use super::{
    HvfVcpu, HvfVm, REG_PC, check, hv_vcpu_get_sys_reg, hv_vcpu_run, hv_vcpu_set_vtimer_mask,
    seatbelt,
};
use crate::hv::{Region, Vcpu as _, Vm as _};
use std::{
    collections::VecDeque,
    fs::File,
    io::{self, Read, Write},
    path::PathBuf,
    ptr,
    sync::atomic::{Ordering, fence},
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
const QUEUE_MAX: u32 = 256;
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

#[derive(Default, Clone, Copy)]
struct Queue {
    num: u32,
    ready: bool,
    desc: u64,
    avail: u64,
    used: u64,
    last_avail: u16,
    used_idx: u16,
}

/// One descriptor of a chain: guest address, length, device-writable.
type Segment = (u64, u32, bool);

/// The virtio-mmio console over guest RAM at `ram` (RAM_BYTES at RAM_GPA).
struct Console {
    ram: *mut u8,
    status: u32,
    device_sel: u32,
    queue_sel: usize,
    queues: [Queue; 4],
    /// Control messages for the guest, waiting for a control receive buffer.
    control: VecDeque<[u8; 8]>,
    stdin_eof: bool,
    /// A receive buffer was used since the guest's last WFI.
    wake: bool,
}
impl Console {
    fn at(&self, gpa: u64, len: usize) -> io::Result<*mut u8> {
        let off = gpa
            .checked_sub(RAM_GPA)
            .ok_or_else(|| err(format!("queue address {gpa:#x} outside RAM")))?
            as usize;
        if off.checked_add(len).is_none_or(|end| end > RAM_BYTES) {
            return Err(err(format!("queue range {gpa:#x}+{len} outside RAM")));
        }
        // SAFETY: off..off+len lies inside the RAM mapping.
        Ok(unsafe { self.ram.add(off) })
    }
    fn get<T: Copy>(&self, gpa: u64) -> io::Result<T> {
        let p = self.at(gpa, size_of::<T>())?;
        // SAFETY: in bounds (at); the vCPU is stopped while the runner reads.
        Ok(unsafe { ptr::read_unaligned(p.cast::<T>()) })
    }
    fn put<T: Copy>(&self, gpa: u64, v: T) -> io::Result<()> {
        let p = self.at(gpa, size_of::<T>())?;
        // SAFETY: in bounds (at); the vCPU is stopped while the runner writes.
        unsafe { ptr::write_unaligned(p.cast::<T>(), v) };
        Ok(())
    }
    fn live(&self, q: usize) -> bool {
        let q = &self.queues[q];
        q.ready && q.num > 0
    }
    fn pending(&self, qi: usize) -> io::Result<bool> {
        let q = self.queues[qi];
        Ok(self.live(qi) && self.get::<u16>(q.avail + 2)? != q.last_avail)
    }
    /// The next available chain: its head and (address, length, writable)
    /// segments.
    fn pop(&mut self, qi: usize) -> io::Result<Option<(u16, Vec<Segment>)>> {
        if !self.pending(qi)? {
            return Ok(None);
        }
        let q = self.queues[qi];
        let head: u16 = self.get(q.avail + 4 + 2 * u64::from(q.last_avail % q.num as u16))?;
        self.queues[qi].last_avail = q.last_avail.wrapping_add(1);
        let (mut id, mut segs) = (head, Vec::new());
        for _ in 0..q.num {
            if u32::from(id) >= q.num {
                return Err(err(format!("queue {qi}: descriptor {id} out of range")));
            }
            let d = q.desc + 16 * u64::from(id);
            let (addr, len, flags, next) = (
                self.get::<u64>(d)?,
                self.get::<u32>(d + 8)?,
                self.get::<u16>(d + 12)?,
                self.get::<u16>(d + 14)?,
            );
            segs.push((addr, len, flags & 2 != 0));
            if flags & 1 == 0 {
                return Ok(Some((head, segs)));
            }
            id = next;
        }
        Err(err(format!("queue {qi}: descriptor chain loops")))
    }
    fn push(&mut self, qi: usize, head: u16, len: u32) -> io::Result<()> {
        let q = self.queues[qi];
        let e = q.used + 4 + 8 * u64::from(q.used_idx % q.num as u16);
        self.put(e, u32::from(head))?;
        self.put(e + 4, len)?;
        fence(Ordering::SeqCst);
        let idx = q.used_idx.wrapping_add(1);
        self.queues[qi].used_idx = idx;
        // A receive or control-receive buffer is what an interrupt would
        // announce (`idle`).
        self.wake |= qi.is_multiple_of(2);
        self.put(q.used + 2, idx)
    }
    fn notify(&mut self, qi: usize) -> io::Result<()> {
        match qi {
            1 => {
                let mut out = io::stdout().lock();
                while let Some((head, segs)) = self.pop(1)? {
                    for (addr, len, writable) in segs {
                        if !writable {
                            let p = self.at(addr, len as usize)?;
                            // SAFETY: in bounds (at); the vCPU is stopped.
                            out.write_all(unsafe { std::slice::from_raw_parts(p, len as usize) })?;
                        }
                    }
                    self.push(1, head, 0)?;
                }
                out.flush()
            }
            3 => {
                while let Some((head, segs)) = self.pop(3)? {
                    for (addr, len, writable) in segs {
                        for at in (0..len / 8 * 8).step_by(8).filter(|_| !writable) {
                            // virtio_console_control: id u32, event u16, value u16.
                            if self.get::<u16>(addr + u64::from(at) + 4)? == 0 {
                                // DEVICE_READY -> DEVICE_ADD for port 0.
                                self.control.push_back([0, 0, 0, 0, 1, 0, 1, 0]);
                            }
                        }
                    }
                    self.push(3, head, 0)?;
                }
                self.deliver_control()
            }
            0 => self.pump(Some(Duration::ZERO)).map(|_| ()),
            2 => self.deliver_control(),
            _ => Ok(()),
        }
    }
    fn deliver_control(&mut self) -> io::Result<()> {
        while !self.control.is_empty() && self.pending(2)? {
            let (head, segs) = self.pop(2)?.expect("pending");
            let &(addr, len, _) = segs
                .iter()
                .find(|s| s.2 && s.1 >= 8)
                .ok_or_else(|| err("control buffer too small"))?;
            let _ = len;
            let msg = self.control.pop_front().expect("non-empty");
            self.put(addr, msg)?;
            self.push(2, head, 8)?;
        }
        Ok(())
    }
    /// Move stdin into one posted receive buffer, waiting at most `wait`
    /// (None: until input) when input can be taken. A zero-length used buffer
    /// is EOF (console.rs `service`). Whether input was delivered.
    fn pump(&mut self, wait: Option<Duration>) -> io::Result<bool> {
        if self.stdin_eof || !self.pending(0)? {
            return Ok(false);
        }
        let ms = wait.map_or(-1, |d| d.as_millis().min(i32::MAX as u128) as i32);
        let mut fd = libc::pollfd {
            fd: 0,
            events: libc::POLLIN,
            revents: 0,
        };
        // SAFETY: one live pollfd.
        if unsafe { libc::poll(&mut fd, 1, ms) } <= 0 {
            return Ok(false);
        }
        let q = self.queues[0];
        let head: u16 = self.get(q.avail + 4 + 2 * u64::from(q.last_avail % q.num as u16))?;
        let d = q.desc + 16 * u64::from(head.min(q.num as u16 - 1));
        let mut buf = vec![0u8; (self.get::<u32>(d + 8)? as usize).clamp(1, 1 << 16)];
        // Unbuffered: input left in a userspace buffer would not wake poll.
        // SAFETY: buf is writable for its length; read keeps no pointer.
        let n = match unsafe { libc::read(0, buf.as_mut_ptr().cast(), buf.len()) } {
            n if n >= 0 => n as usize,
            _ if io::Error::last_os_error().kind() == io::ErrorKind::Interrupted => {
                return Ok(false);
            }
            _ => 0,
        };
        let (head, segs) = self.pop(0)?.expect("pending");
        let &(addr, len, _) = segs
            .iter()
            .find(|s| s.2)
            .ok_or_else(|| err("receive buffer not writable"))?;
        let n = n.min(len as usize);
        if n == 0 {
            self.stdin_eof = true;
        } else {
            let p = self.at(addr, n)?;
            // SAFETY: in bounds (at); the vCPU is stopped.
            unsafe { ptr::copy_nonoverlapping(buf.as_ptr(), p, n) };
        }
        self.push(0, head, n as u32)?;
        Ok(true)
    }
    fn read(&mut self, off: u64) -> io::Result<u32> {
        let q = self.queues[self.queue_sel];
        Ok(match off {
            0x00 => 0x7472_6976,
            0x04 => 2,
            0x08 => 3,
            0x0c => 0x554d_4551,
            // MULTIPORT; VERSION_1.
            0x10 => [1 << 1, 1]
                .get(self.device_sel as usize)
                .copied()
                .unwrap_or(0),
            0x34 => QUEUE_MAX,
            0x44 => u32::from(q.ready),
            0x60 => {
                // The guest's console service: input it can pick up now.
                self.pump(Some(Duration::ZERO))?;
                0
            }
            0x70 => self.status,
            // virtio_console_config.max_nr_ports.
            0x104 => 1,
            _ => 0,
        })
    }
    fn write(&mut self, off: u64, v: u32) -> io::Result<()> {
        let q = &mut self.queues[self.queue_sel];
        let lo = |a: &mut u64| *a = (*a & !0xffff_ffff) | u64::from(v);
        let hi = |a: &mut u64| *a = (*a & 0xffff_ffff) | u64::from(v) << 32;
        match off {
            0x14 => self.device_sel = v,
            0x30 if v < 4 => self.queue_sel = v as usize,
            0x30 => return Err(err(format!("queue {v} does not exist"))),
            0x38 if (1..=QUEUE_MAX).contains(&v) => q.num = v,
            0x44 => q.ready = v == 1,
            0x50 => return self.notify(v as usize),
            0x70 if v == 0 => {
                self.status = 0;
                self.queues = Default::default();
            }
            0x70 => self.status = v,
            0x80 => lo(&mut q.desc),
            0x84 => hi(&mut q.desc),
            0x90 => lo(&mut q.avail),
            0x94 => hi(&mut q.avail),
            0xa0 => lo(&mut q.used),
            0xa4 => hi(&mut q.used),
            // Feature selection and acknowledgements need no state.
            _ => {}
        }
        Ok(())
    }
    /// WFI: sleep until the armed CNTV deadline or stdin input.
    fn idle(&mut self, cpu: &HvfVcpu) -> io::Result<()> {
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
        // A buffer the guest got since its last WFI is a pending interrupt:
        // it may have checked its queues just before, so WFI completes.
        if std::mem::take(&mut self.wake) || self.pump(left())? {
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
    let ram = ram.cast::<u8>();
    // SAFETY: the mapping is RAM_BYTES long and lives until the process exits.
    let mem = unsafe { std::slice::from_raw_parts_mut(ram, RAM_BYTES) };
    let mut file = File::open(&image)?;
    let len = file.metadata()?.len() as usize;
    if len > RAM_BYTES - FDT_BYTES {
        return Err(err(format!(
            "image of {len} bytes does not fit below the FDT"
        )));
    }
    file.read_exact(&mut mem[..len])?;
    let tree = fdt(&bootargs);
    let at = RAM_BYTES - FDT_BYTES;
    mem[at..at + tree.len()].copy_from_slice(&tree);

    let mut vm = HvfVm::create()?;
    // SAFETY: the RAM mapping outlives the VM (never unmapped); page aligned.
    unsafe { vm.map(RAM_GPA, ram, RAM_BYTES, Region::Boot)? };
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
    let mut dev = Console {
        ram,
        status: 0,
        device_sel: 0,
        queue_sel: 0,
        queues: Default::default(),
        control: VecDeque::new(),
        stdin_eof: false,
        wake: false,
    };
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
                    dev.idle(&cpu)?;
                }
            }
            // HVC: ELR already points past it.
            0x16 => {
                match cpu.reg(0) {
                    PSCI_SYSTEM_OFF | PSCI_CPU_OFF => return io::stdout().flush(),
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

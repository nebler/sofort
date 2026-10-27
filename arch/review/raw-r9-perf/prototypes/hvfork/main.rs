//! R9 prototype (measurement only): what does a fresh HVF VM cost when the
//! process is (a) posix_spawned+exec'd, (b) forked from a pre-initialised
//! parent that already loaded Hypervisor.framework, (c) created in-process?
//! Each VM: hv_vm_create, 32 MiB anonymous RAM mapped, 1 vCPU, one guest
//! instruction (HVC #0) run to its exit, destroy.
//!
//! hvfork spawn|fork|inproc N [RAM_MIB] [TOUCH_KIB]
//! Build: rustc -O main.rs -o hvfork && codesign -s - -f --entitlements hypervisor.entitlements hvfork
use std::ffi::c_void;

#[link(name = "Hypervisor", kind = "framework")]
extern "C" {
    fn hv_vm_create(config: *mut c_void) -> i32;
    fn hv_vm_destroy() -> i32;
    fn hv_vm_map(addr: *mut c_void, ipa: u64, size: usize, flags: u64) -> i32;
    fn hv_vcpu_create(vcpu: *mut u64, exit: *mut *mut c_void, config: *mut c_void) -> i32;
    fn hv_vcpu_destroy(vcpu: u64) -> i32;
    fn hv_vcpu_set_reg(vcpu: u64, reg: u32, value: u64) -> i32;
    fn hv_vcpu_run(vcpu: u64) -> i32;
}
extern "C" {
    fn mmap(addr: *mut c_void, len: usize, prot: i32, flags: i32, fd: i32, off: i64) -> *mut c_void;
    fn munmap(addr: *mut c_void, len: usize) -> i32;
    fn fork() -> i32;
    fn _exit(code: i32) -> !;
    fn wait4(pid: i32, status: *mut i32, options: i32, ru: *mut [u64; 18]) -> i32;
    fn getrusage(who: i32, ru: *mut [u64; 18]) -> i32;
}

extern "C" {
    fn proc_pid_rusage(pid: i32, flavor: i32, buf: *mut [u64; 40]) -> i32;
    fn getpid() -> i32;
}
fn footprint() -> u64 {
    let mut b = [0u64; 40];
    // SAFETY: flavor 4 (rusage_info_v4) is < 320 bytes; ri_phys_footprint is
    // the 8th u64 after the 16-byte uuid.
    unsafe { proc_pid_rusage(getpid(), 4, &mut b) };
    b[9]
}
fn vm_once(ram_mib: usize, touch_kib: usize) {
    if std::env::var_os("HVFORK_FOOTPRINT").is_some() {
        eprintln!("{{\"phys_footprint_before_vm\":{}}}", footprint());
    }
    let len = ram_mib << 20;
    // HVFORK_FILE=PATH maps a prepared RAM file MAP_PRIVATE (copy-on-write,
    // clean pages shared through the page cache) instead of anonymous memory.
    let file = std::env::var("HVFORK_FILE").ok().map(|p| std::fs::File::open(p).unwrap());
    // SAFETY: private RW mapping (anonymous, or of a read-only-opened file); checked below.
    let mem = unsafe {
        match &file {
            Some(f) => mmap(std::ptr::null_mut(), len, 3, 0x0002, std::os::fd::AsRawFd::as_raw_fd(f), 0),
            None => mmap(std::ptr::null_mut(), len, 3, 0x1002, -1, 0),
        }
    };
    assert!(mem as isize != -1);
    // SAFETY: mem is a fresh RW mapping of len bytes.
    unsafe {
        // Touch the first TOUCH_KIB to emulate loading an image into guest RAM.
        let p = mem as *mut u8;
        for off in (0..touch_kib * 1024).step_by(4096) {
            *p.add(off) = 1;
        }
        *(mem as *mut u32) = 0xd4000002; // hvc #0
        assert_eq!(hv_vm_create(std::ptr::null_mut()), 0, "hv_vm_create");
        assert_eq!(hv_vm_map(mem, 0x8000_0000, len, 7), 0, "hv_vm_map");
        let mut vcpu = 0u64;
        let mut exit = std::ptr::null_mut();
        assert_eq!(hv_vcpu_create(&mut vcpu, &mut exit, std::ptr::null_mut()), 0);
        hv_vcpu_set_reg(vcpu, 31, 0x8000_0000); // PC
        hv_vcpu_set_reg(vcpu, 34, 0x3c5); // CPSR EL1h, masked
        assert_eq!(hv_vcpu_run(vcpu), 0, "hv_vcpu_run");
        if std::env::var_os("HVFORK_FOOTPRINT").is_some() {
            eprintln!("{{\"touch_kib\":{touch_kib},\"phys_footprint_after_run\":{}}}", footprint());
        }
        hv_vcpu_destroy(vcpu);
        hv_vm_destroy();
        munmap(mem, len);
    }
}

fn cpu_us(ru: &[u64; 18]) -> u64 {
    // struct rusage: ru_utime {sec: i64, usec: i32+pad}, ru_stime {...}
    ru[0] * 1_000_000 + (ru[1] & 0xffff_ffff) + ru[2] * 1_000_000 + (ru[3] & 0xffff_ffff)
}
fn minflt(ru: &[u64; 18]) -> u64 {
    ru[8] // utime(2) stime(2) maxrss ixrss idrss isrss minflt
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let mode = a[1].as_str();
    let n: usize = a.get(2).map(|s| s.parse().unwrap()).unwrap_or(1);
    let ram: usize = a.get(3).map(|s| s.parse().unwrap()).unwrap_or(32);
    let touch: usize = a.get(4).map(|s| s.parse().unwrap()).unwrap_or(0);
    match mode {
        "child" => {
            vm_once(ram, touch);
            std::process::exit(0);
        }
        "inproc" => {
            let mut before = [0u64; 18];
            // SAFETY: RUSAGE_SELF into a buffer at least sizeof(struct rusage).
            unsafe { getrusage(0, &mut before) };
            let t = std::time::Instant::now();
            for _ in 0..n {
                vm_once(ram, touch);
            }
            let mut after = [0u64; 18];
            // SAFETY: as above.
            unsafe { getrusage(0, &mut after) };
            println!(
                "{{\"mode\":\"inproc\",\"n\":{n},\"cpu_us_per_vm\":{:.1},\"wall_us_per_vm\":{:.1}}}",
                (cpu_us(&after) - cpu_us(&before)) as f64 / n as f64,
                t.elapsed().as_micros() as f64 / n as f64
            );
        }
        "spawn" | "fork" => {
            let exe = std::env::current_exe().unwrap();
            let mut cpu = Vec::new();
            let mut flt = Vec::new();
            let t = std::time::Instant::now();
            for _ in 0..n {
                let pid = if mode == "fork" {
                    // SAFETY: single-threaded parent; the child only runs vm_once and _exit.
                    let pid = unsafe { fork() };
                    if pid == 0 {
                        vm_once(ram, touch);
                        // SAFETY: terminate the forked child without running parent destructors.
                        unsafe { _exit(0) };
                    }
                    pid
                } else {
                    std::process::Command::new(&exe)
                        .args(["child", "1", &ram.to_string(), &touch.to_string()])
                        .spawn()
                        .unwrap()
                        .id() as i32
                };
                let mut st = 0;
                let mut ru = [0u64; 18];
                // SAFETY: our child; ru is larger than struct rusage (144 bytes).
                let r = unsafe { wait4(pid, &mut st, 0, &mut ru) };
                assert_eq!(r, pid);
                assert_eq!(st, 0, "child status");
                cpu.push(cpu_us(&ru));
                flt.push(minflt(&ru));
            }
            let wall = t.elapsed().as_micros() as f64 / n as f64;
            cpu.sort();
            flt.sort();
            println!(
                "{{\"mode\":\"{mode}\",\"n\":{n},\"ram_mib\":{ram},\"touch_kib\":{touch},\"child_cpu_us_p50\":{},\"child_cpu_us_p90\":{},\"child_minflt_p50\":{},\"wall_us_per_vm\":{wall:.1}}}",
                cpu[n / 2],
                cpu[n * 9 / 10],
                flt[n / 2]
            );
        }
        _ => panic!("mode"),
    }
}

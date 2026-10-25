use crate::{console as c, mmu as m};
use core::{
    arch::{asm, global_asm},
    ptr::{copy_nonoverlapping, write_bytes},
};
global_asm!(include_str!("vectors.S"));
mod packed {
    include!("packed.rs");
}
static mut BRK: usize = 0x680000;
unsafe fn pages(start: usize, end: usize, w: bool, x: bool) {
    unsafe {
        assert!(!(w && x));
        for va in (start & !4095..(end + 4095) & !4095).step_by(4096) {
            m::map(va, w, x);
        }
    }
}
pub unsafe fn run() -> ! {
    unsafe {
        for &(start, end, w, x) in packed::SEGMENTS {
            pages(start, end, w, x);
        }
        pages(0x1fe0000, 0x2000000, true, false);
        let strings = 0x1ff8000usize;
        let code = option_env!("JITK_SCRIPT").unwrap_or(include_str!("../bootstrap.js"));
        assert!(code.len() < 24000);
        let data = b"qjs\0--std\0--memory-limit\016777216\0-e\0";
        copy_nonoverlapping(data.as_ptr(), m::physical(strings) as *mut u8, data.len());
        copy_nonoverlapping(
            code.as_ptr(),
            m::physical(strings + 37) as *mut u8,
            code.len(),
        );
        let env = strings + 38 + code.len();
        copy_nonoverlapping(b"PATH=/\0".as_ptr(), m::physical(env) as *mut u8, 7);
        let random = strings + 30000;
        copy_nonoverlapping(crate::SEED.as_ptr(), m::physical(random) as *mut u8, 16);
        let initial = [
            6,
            strings,
            strings + 4,
            strings + 10,
            strings + 25,
            strings + 34,
            strings + 37,
            0,
            env,
            0,
            3,
            packed::PHDR,
            4,
            56,
            5,
            packed::PHNUM,
            6,
            4096,
            9,
            packed::ENTRY,
            11,
            0,
            12,
            0,
            13,
            0,
            14,
            0,
            23,
            0,
            25,
            random,
            0,
            0,
        ];
        let sp = (strings - initial.len() * 8) & !15;
        copy_nonoverlapping(
            initial.as_ptr(),
            m::physical(sp) as *mut usize,
            initial.len(),
        );
        #[cfg(feature = "probe")]
        {
            let code = include_bytes!(env!("JITK_PROBE"));
            copy_nonoverlapping(code.as_ptr(), m::physical(0x400000) as *mut u8, code.len());
        }
        m::protect_aliases();
        m::flush();
        // Publish data written through the kernel alias before executing user code.
        for va in (0x400000..0x650000).step_by(64) {
            asm!("dc cvau,{a}",a=in(reg) m::physical(va));
        }
        asm!("dsb ish", "ic iallu", "dsb ish", "isb");
        unsafe extern "C" {
            static vectors: u8;
        }
        let entry = if cfg!(feature = "probe") {
            0x400000
        } else {
            packed::ENTRY
        };
        crate::perf::mark(2);
        asm!("msr vbar_el1,{v}","msr sp_el0,{sp}","msr elr_el1,{entry}","msr spsr_el1,{mask}",".inst 0xd500419f","isb","eret",
         mask=in(reg) 0x3c0u64,v=in(reg) &raw const vectors,sp=in(reg) sp,entry=in(reg) entry,options(noreturn));
    }
}
unsafe fn access(va: usize, len: usize, w: bool) -> Option<usize> {
    unsafe {
        let end = va.checked_add(len)?;
        if va < 0x400000 || end > 0x2400000 {
            return None;
        }
        if len != 0 {
            for a in (va & !4095..=((end - 1) & !4095)).step_by(4096) {
                if !m::valid(a, w) {
                    return None;
                }
            }
        }
        Some(m::physical(va))
    }
}
unsafe fn output(va: usize, len: usize) -> isize {
    unsafe {
        if len == 0 {
            return 0;
        }
        if len > 1024 * 1024 {
            return -22;
        }
        match access(va, len, false) {
            Some(pa) => {
                let bytes = core::slice::from_raw_parts(pa as *const u8, len);
                if bytes.iter().any(|&b| b < 32 && b != 10) {
                    c::print("\x1efatal control byte\n");
                    crate::off();
                }
                if bytes.starts_with(b"FIRST") { crate::perf::mark(4); }
                crate::perf::observe(bytes);
                c::user_write(bytes);
                len as isize
            }
            None => -14,
        }
    }
}
unsafe fn dispatch(n: usize, a: &[usize]) -> isize {
    unsafe {
        match n {
            #[cfg(feature = "probe")]
            12345 => core::ptr::read_volatile(0x400000 as *const isize),
            #[cfg(feature = "probe")]
            12346 => {
                core::ptr::write_volatile(0x80080000 as *mut usize, 0);
                0
            }
            93 | 94 => {
                c::print("\x1eexit=");
                c::hex(a[0]);
                c::print("\n");
                crate::off()
            }
            96 => 1,
            29 => -25,
            57 => {
                if a[0] <= 2 {
                    0
                } else {
                    -9
                }
            }
            56 => -2,
            78 => -22,
            62 => -29,
            17 => {
                if a[1] < 2 {
                    return -34;
                }
                if let Some(pa) = access(a[0], 2, true) {
                    copy_nonoverlapping(b"/\0".as_ptr(), pa as *mut u8, 2);
                    2
                } else {
                    -14
                }
            }
            63 => {
                if a[0] != 0 {
                    return -9;
                }
                if a[2] > 1024 * 1024 {
                    return -22;
                }
                if let Some(pa) = access(a[1], a[2], true) {
                    c::read(core::slice::from_raw_parts_mut(pa as *mut u8, a[2])) as isize
                } else {
                    -14
                }
            }
            64 => {
                if a[0] == 1 || a[0] == 2 {
                    if a[0] == 2 {
                        a[2] as isize
                    } else {
                        output(a[1], a[2])
                    }
                } else {
                    -9
                }
            }
            65 | 66 => {
                if a[2] > 1024 {
                    return -22;
                }
                let Some(pa) = access(a[1], a[2] * 16, false) else {
                    return -14;
                };
                let mut total = 0;
                if n == 65 {
                    if a[0] != 0 {
                        return -9;
                    }
                    for i in 0..a[2] {
                        let io = (pa + i * 16) as *const usize;
                        let ptr = io.read_unaligned();
                        let len = io.add(1).read_unaligned();
                        if len != 0 {
                            return dispatch(63, &[0, ptr, len]);
                        }
                    }
                    return 0;
                }
                if a[0] != 1 && a[0] != 2 {
                    return -9;
                }
                // Validate the complete writev before emitting any prefix.
                if a[0] == 1 {
                    for i in 0..a[2] {
                        let io = (pa + i * 16) as *const usize;
                        let len = io.add(1).read_unaligned();
                        if len == 0 {
                            continue;
                        }
                        if len > 1024 * 1024 {
                            return -22;
                        }
                        let Some(p) = access(io.read_unaligned(), len, false) else {
                            return -14;
                        };
                        let bytes = core::slice::from_raw_parts(p as *const u8, len);
                        if bytes.iter().any(|&b| b < 32 && b != 10) {
                            c::print("\x1efatal control byte\n");
                            crate::off();
                        }
                    }
                }
                for i in 0..a[2] {
                    let io = (pa + i * 16) as *const usize;
                    let r = if a[0] == 2 {
                        io.add(1).read_unaligned() as isize
                    } else {
                        output(io.read_unaligned(), io.add(1).read_unaligned())
                    };
                    if r < 0 {
                        return if total > 0 { total } else { r };
                    }
                    total += r;
                }
                total
            }
            73 => {
                if a[1] > 64 {
                    return -22;
                }
                let pa = if a[1] == 0 {
                    0
                } else {
                    let Some(pa) = access(a[0], a[1] * 8, true) else {
                        return -14;
                    };
                    pa
                };
                let deadline = if a[2] == 0 {
                    u64::MAX
                } else {
                    let Some(t) = access(a[2], 16, false) else {
                        return -14;
                    };
                    let t = t as *const i64;
                    let sec = t.read_unaligned();
                    let ns = t.add(1).read_unaligned();
                    if sec < 0 || !(0..1_000_000_000).contains(&ns) {
                        return -22;
                    }
                    crate::wait::now_ns().saturating_add(
                        (sec as u64)
                            .saturating_mul(1_000_000_000)
                            .saturating_add(ns as u64),
                    )
                };
                loop {
                    c::service();
                    let mut ready = 0;
                    for i in 0..a[1] {
                        let f = (pa + i * 8) as *mut i32;
                        let fd = f.read_unaligned();
                        let ev = (f as *mut i16).add(2).read_unaligned();
                        let r = if fd < 0 {
                            0
                        } else if fd != 0 {
                            32
                        } else if c::available() && ev & 1 != 0 {
                            1
                        } else if c::eof() {
                            16
                        } else {
                            0
                        };
                        (f as *mut i16).add(3).write_unaligned(r);
                        if r != 0 {
                            ready += 1;
                        }
                    }
                    if ready != 0 || crate::wait::now_ns() >= deadline {
                        if ready != 0 {crate::perf::wake();}
                        return ready;
                    }
                    crate::wait::park(deadline);
                }
            }
            216 => -38,
            214 => {
                let want = a[0];
                if want >= 0x680000 && want <= 0x800000 {
                    pages(BRK, want.max(BRK), true, false);
                    BRK = want;
                    m::flush();
                }
                BRK as isize
            }
            222 => {
                if a[0] != 0 || a[1] == 0 || a[2] != 3 || a[3] & 0x20 == 0 || a[3] & 0x10 != 0 {
                    return -22;
                }
                let Some(len) = a[1].checked_add(4095).map(|x| x & !4095) else {
                    return -12;
                };
                let count = len / 4096;
                let mut run = 0;
                let mut base = 0;
                for va in (0x800000..0x1e00000).step_by(4096) {
                    run = if m::valid(va, false) { 0 } else { run + 1 };
                    if run == count {
                        base = va + 4096 - len;
                        break;
                    }
                }
                if base == 0 {
                    return -12;
                }
                let Some(end) = base.checked_add(len) else {
                    return -12;
                };
                if end > 0x1e00000 {
                    return -12;
                }
                pages(base, end, true, false);
                write_bytes(m::physical(base) as *mut u8, 0, len);
                m::flush();
                base as isize
            }
            215 => {
                if a[0] & 4095 != 0 || a[1] == 0 {
                    return -22;
                }
                let Some(end) = a[0].checked_add(a[1]).filter(|e| *e <= 0x1e00000) else {
                    return -22;
                };
                if a[0] < 0x800000 {
                    return -22;
                }
                for va in (a[0]..end).step_by(4096) {
                    m::unmap(va);
                }
                m::flush();
                0
            }
            113 => {
                let ns = crate::wait::now_ns() + if a[0] == 0 { crate::EPOCH_OFFSET } else { 0 };
                if a[0] != 0 && a[0] != 1 {
                    return -22;
                }
                if let Some(pa) = access(a[1], 16, true) {
                    let t = pa as *mut u64;
                    t.write_unaligned(ns / 1_000_000_000);
                    t.add(1).write_unaligned(ns % 1_000_000_000);
                    0
                } else {
                    -14
                }
            }
            _ => {
                c::print("\x1eENOSYS nr=");
                c::hex(n);
                c::print("\n");
                -38
            }
        }
    }
}
#[unsafe(no_mangle)]
unsafe extern "C" fn trap(frame: *mut usize) {
    unsafe {
        crate::perf::first_syscall();
        let f = core::slice::from_raw_parts_mut(frame, 33);
        let esr: u64;
        asm!("mrs {v},esr_el1",v=out(reg) esr);
        if esr >> 26 != 0x15 {
            let far: u64;
            asm!("mrs {v},far_el1",v=out(reg) far);
            c::print("\x1eFAULT esr=");
            c::hex(esr as usize);
            c::print(" far=");
            c::hex(far as usize);
            c::print(" pc=");
            c::hex(f[31]);
            c::print("\n");
            crate::off();
        }
        #[cfg(feature = "trace")]
        {
            c::print("\x1esys ");
            c::hex(f[8]);
            c::print("\n");
        }
        f[0] = dispatch(f[8], &f[..6]) as usize;
    }
}

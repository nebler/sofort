use crate::{console as c, mmu as m};
use core::{
    arch::{asm, global_asm},
    ptr::copy_nonoverlapping,
};
global_asm!(include_str!("vectors.S"));
mod packed {
    include!(concat!(env!("OUT_DIR"), "/packed.rs"));
}
pub(crate) use packed::{FS, FS_LEN, HEAP};
// brk owns [HEAP, MMAP); mmap owns [MMAP, 0x1e00000). The archive lies below HEAP.
pub(crate) const MMAP: usize = HEAP + 0x180000;
pub(crate) static mut BRK: usize = HEAP;
pub(crate) unsafe fn pages(start: usize, end: usize, w: bool, x: bool) {
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
        let mut cursor = strings;
        let mut initial = [0usize; 96];
        initial[0] = packed::ARGV.len();
        for (i, arg) in packed::ARGV.iter().enumerate() {
            initial[1 + i] = cursor;
            copy_nonoverlapping(arg.as_ptr(), m::physical(cursor) as *mut u8, arg.len());
            cursor += arg.len() + 1;
        }
        assert!(cursor < strings + 30000);
        let env = cursor;
        copy_nonoverlapping(b"PATH=/\0".as_ptr(), m::physical(env) as *mut u8, 7);
        let random = strings + 30000;
        copy_nonoverlapping(crate::SEED.as_ptr(), m::physical(random) as *mut u8, 16);
        let aux = [0, env, 0, 3, packed::PHDR, 4, 56, 5, packed::PHNUM, 6, 4096,
            9, packed::ENTRY, 11, 0, 12, 0, 13, 0, 14, 0, 23, 0, 25, random, 0, 0];
        let n = 1 + packed::ARGV.len();
        initial[n..n + aux.len()].copy_from_slice(&aux);
        let initial = &initial[..n + aux.len()];
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
        for va in (FS..FS + FS_LEN).step_by(4096) {
            m::readonly(m::physical(va));
        }
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
        asm!("msr vbar_el1,{v}","msr sp_el0,{sp}","msr elr_el1,{entry}","msr spsr_el1,{mask}",".inst 0xd500419f","isb","eret",
         mask=in(reg) 0x3c0u64,v=in(reg) &raw const vectors,sp=in(reg) sp,entry=in(reg) entry,options(noreturn));
    }
}
pub(crate) unsafe fn access(va: usize, len: usize, w: bool) -> Option<usize> {
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
pub(crate) unsafe fn output(va: usize, len: usize) -> isize {
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
                if bytes.iter().any(|&b| (b < 32 && b != 10) || b >= 127) {
                    c::print("\x1efatal control byte\n");
                    crate::off();
                }
                c::user_write(bytes);
                len as isize
            }
            None => -14,
        }
    }
}
#[unsafe(no_mangle)]
unsafe extern "C" fn trap(frame: *mut usize) {
    unsafe {
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
        let n = f[8];
        let args: [usize; 6] = f[..6].try_into().unwrap();
        crate::trace::enter(n, &args, f[31]);
        #[cfg(feature = "probe")]
        let ret = match n {
            12345 => core::ptr::read_volatile(0x400000 as *const isize),
            12346 => { core::ptr::write_volatile(0x80080000 as *mut usize, 0); 0 },
            12347 => { core::ptr::write_volatile(m::physical(FS) as *mut usize, 0); 0 },
            _ => crate::syscalls::dispatch(n, &args),
        };
        #[cfg(not(feature = "probe"))]
        let ret = crate::syscalls::dispatch(n, &args);
        crate::trace::exit(n, &args, ret);
        f[0] = ret as usize;

    }
}

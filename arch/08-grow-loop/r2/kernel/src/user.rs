use crate::{console as c, mmu as m};
use core::{
    arch::{asm, global_asm},
    ptr::{copy_nonoverlapping, write_bytes},
};
global_asm!(include_str!("vectors.S"));
static ELF: &[u8] = include_bytes!(env!("JITK_ELF"));
pub(crate) static mut BRK: usize = 0x680000;
pub(crate) static mut NEXT: usize = 0x800000;
fn u16at(o: usize) -> usize {
    u16::from_le_bytes(ELF[o..o + 2].try_into().unwrap()) as usize
}
fn u32at(o: usize) -> usize {
    u32::from_le_bytes(ELF[o..o + 4].try_into().unwrap()) as usize
}
fn u64at(o: usize) -> usize {
    u64::from_le_bytes(ELF[o..o + 8].try_into().unwrap()) as usize
}
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
        assert!(
            &ELF[..4] == b"\x7fELF"
                && ELF[4] == 2
                && ELF[5] == 1
                && u16at(18) == 183
                && u16at(16) == 2
        );
        let ph = u64at(32);
        let ents = u16at(54);
        let num = u16at(56);
        let mut phaddr = 0;
        assert!(ents == 56 && num <= 16 && ph + ents * num <= ELF.len());
        for i in 0..num {
            let h = ph + i * ents;
            if u32at(h) != 1 {
                continue;
            }
            let flags = u32at(h + 4);
            let off = u64at(h + 8);
            let va = u64at(h + 16);
            let fs = u64at(h + 32);
            let ms = u64at(h + 40);
            assert!(fs <= ms && off + fs <= ELF.len() && va >= 0x400000 && va + ms <= 0x680000);
            pages(va, va + ms, flags & 2 != 0, flags & 1 != 0);
            write_bytes(m::physical(va) as *mut u8, 0, ms);
            copy_nonoverlapping(ELF.as_ptr().add(off), m::physical(va) as *mut u8, fs);
            if ph >= off && ph + ents * num <= off + fs {
                phaddr = va + ph - off;
            }
        }
        assert!(phaddr != 0);
        pages(0x1fe0000, 0x2000000, true, false);
        let strings = 0x1fff000usize;
        let code = option_env!("JITK_SCRIPT").unwrap_or("print(\"hi\")");
        assert!(code.len() < 2048);
        let data = b"qjs\0--std\0-e\0";
        copy_nonoverlapping(data.as_ptr(), m::physical(strings) as *mut u8, data.len());
        copy_nonoverlapping(
            code.as_ptr(),
            m::physical(strings + 13) as *mut u8,
            code.len(),
        );
        let env = strings + 14 + code.len();
        copy_nonoverlapping(b"PATH=/\0".as_ptr(), m::physical(env) as *mut u8, 7);
        let random = strings + 3072;
        copy_nonoverlapping(crate::SEED.as_ptr(), m::physical(random) as *mut u8, 16);
        let initial = [
            4,
            strings,
            strings + 4,
            strings + 10,
            strings + 13,
            0,
            env,
            0,
            3,
            phaddr,
            4,
            ents,
            5,
            num,
            6,
            4096,
            9,
            u64at(24),
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
            u64at(24)
        };
        asm!("msr vbar_el1,{v}","msr sp_el0,{sp}","msr elr_el1,{entry}","msr spsr_el1,xzr",".inst 0xd500419f","isb","eret",
         v=in(reg) &raw const vectors,sp=in(reg) sp,entry=in(reg) entry,options(noreturn));
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
pub(crate) unsafe fn output(va: usize, len: usize, stderr: bool) -> isize {
    unsafe {
        if len > 1024 * 1024 {
            return -22;
        }
        match access(va, len, false) {
            Some(pa) => {
                let bytes = core::slice::from_raw_parts(pa as *const u8, len);
                if stderr {
                    #[cfg(feature="grow-trace")]
                    {
                        c::print("\x1e{\"v\":2,\"kind\":\"log\",\"hex\":\"");
                        let mut encoded = [0u8; 256];
                        for chunk in bytes.chunks(128) {
                            for (i,b) in chunk.iter().enumerate() {
                                encoded[i*2]=b"0123456789abcdef"[(b >> 4) as usize];
                                encoded[i*2+1]=b"0123456789abcdef"[(b & 15) as usize];
                            }
                            c::write(&encoded[..chunk.len()*2]);
                        }
                        c::print("\"}\n");
                    }
                    return len as isize;
                }
                if bytes.iter().any(|b| *b < 0x20 && *b != b'\n') {
                    c::print("\x1e{\"v\":2,\"kind\":\"fatal\",\"reason\":\"control-byte\"}\n");
                    crate::off();
                }
                c::write(bytes);
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
            c::print("FAULT esr=");
            c::hex(esr as usize);
            c::print(" far=");
            c::hex(far as usize);
            c::print(" pc=");
            c::hex(f[31]);
            c::print("\n");
            crate::off();
        }
        let n = f[8];
        let args: [usize; 6] = f[..6].try_into().unwrap();
        crate::trace::enter(n, &args, f[31]);
        let ret = crate::syscalls::dispatch(n, &args);
        crate::trace::exit(n, &args, ret);
        f[0] = ret as usize;
    }
}

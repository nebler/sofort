use crate::{console as c, mmu as m};
use core::{
    arch::{asm, global_asm},
    ptr::copy_nonoverlapping,
};
const ESR_CLASS_SHIFT: u32 = 26;
const ESR_SVC64: u64 = 0x15;
global_asm!(include_str!("vectors.S"));
mod packed {
    include!(concat!(env!("OUT_DIR"), "/packed.rs"));
}
pub(crate) use packed::{FS, FS_LEN, HEAP};
// brk owns [HEAP, MMAP); mmap owns [MMAP, crate::memory::MMAP_END). The archive lies below HEAP.
pub(crate) const MMAP: usize = HEAP + 0x180000;
pub(crate) static mut BRK: usize = HEAP;
/// # Safety
/// start/end delimit an admitted user region and cannot overflow page rounding. The sole
/// masked-IRQ EL1 context owns tables and flushes before EL0 resumes.
pub(crate) unsafe fn pages(start: usize, end: usize, w: bool, x: bool) {
    // SAFETY: start/end delimit an admitted user region and cannot overflow page rounding.
    // The sole masked-IRQ EL1 context owns tables and flushes before EL0 resumes.
    unsafe {
        assert!(!(w && x));
        for va in (start & !4095..(end + 4095) & !4095).step_by(4096) {
            m::map(va, w, x);
        }
    }
}
/// # Safety
/// Called once at EL1 with DAIF masked after MMU/console init. Packer-validated segments and
/// bounded argv map into disjoint backing; EL0 cannot run during stack construction.
pub unsafe fn run() -> ! {
    // SAFETY: Called once at EL1 with DAIF masked after MMU/console init. Packer-validated
    // segments and bounded argv map into disjoint backing; EL0 cannot run during stack
    // construction.
    unsafe {
        for &(start, end, w, x) in packed::SEGMENTS {
            pages(start, end, w, x);
        }
        pages(
            crate::memory::STACK_START,
            crate::memory::STACK_END,
            true,
            false,
        );
        #[cfg(feature = "transport-ring")]
        let mut native_args = [""; 32];
        #[cfg(feature = "transport-ring")]
        let args = if packed::ARGV == ["@ring-native"] {
            c::native_checkpoint();
            let n = c::native_args(&mut native_args);
            &native_args[..n]
        } else {
            packed::ARGV
        };
        #[cfg(not(feature = "transport-ring"))]
        let args = packed::ARGV;
        let strings = 0x1ff8000usize;
        let mut cursor = strings;
        let mut initial = [0usize; 96];
        initial[0] = args.len();
        for (i, arg) in args.iter().enumerate() {
            initial[1 + i] = cursor;
            copy_nonoverlapping(arg.as_ptr(), m::physical(cursor) as *mut u8, arg.len());
            cursor += arg.len() + 1;
        }
        assert!(cursor < strings + 30000);
        let env = cursor;
        copy_nonoverlapping(
            c"PATH=/".as_ptr().cast::<u8>(),
            m::physical(env) as *mut u8,
            7,
        );
        let random = strings + 30000;
        copy_nonoverlapping(
            (&raw const crate::SEED).cast::<u8>(),
            m::physical(random) as *mut u8,
            16,
        );
        let aux = [
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
        let n = 1 + args.len();
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
            copy_nonoverlapping(
                code.as_ptr(),
                m::physical(crate::memory::USER_BASE) as *mut u8,
                code.len(),
            );
        }
        m::protect_aliases();
        for va in (FS..FS + FS_LEN).step_by(4096) {
            m::readonly(m::physical(va));
        }
        m::flush();
        // Publish data written through the kernel alias before executing user code.
        #[cfg(feature = "transport-ring")]
        let cache_end = if c::native() {
            crate::memory::USER_BASE
        } else {
            0x650000
        };
        #[cfg(not(feature = "transport-ring"))]
        let cache_end = 0x650000;
        for va in (crate::memory::USER_BASE..cache_end).step_by(64) {
            asm!("dc cvau,{a}",a=in(reg) m::physical(va));
        }
        asm!("dsb ish", "ic iallu", "dsb ish", "isb");
        // SAFETY: these symbols are supplied by the guest linker/assembly with the
        // declared addresses and storage.
        unsafe extern "C" {
            static vectors: u8;
        }
        let entry = if cfg!(feature = "probe") {
            crate::memory::USER_BASE
        } else {
            packed::ENTRY
        };
        #[cfg(feature = "transport-ring")]
        crate::arch::enter_user(&raw const vectors, sp, entry);
        #[cfg(not(feature = "transport-ring"))]
        asm!("msr vbar_el1,{v}","msr sp_el0,{sp}","msr elr_el1,{entry}","msr spsr_el1,{mask}",".inst 0xd500419f","isb","eret",
         mask=in(reg) 0x3c0u64,v=in(reg) &raw const vectors,sp=in(reg) sp,entry=in(reg) entry,options(noreturn));
    }
}
pub(crate) fn access(va: usize, len: usize, w: bool) -> Option<usize> {
    let end = va.checked_add(len)?;
    if va < crate::memory::USER_BASE || end > crate::memory::USER_END {
        return None;
    }
    if len != 0 {
        for a in (va & !4095..=((end - 1) & !4095)).step_by(4096) {
            if !m::valid(a, w) {
                return None;
            }
        }
    }
    // Ring EL1 uses the validated user virtual mapping. Adjacent virtual
    // pages can have unrelated physical backing after arena relocation.
    // PAN is cleared only on the ring syscall path below.
    #[cfg(feature = "transport-ring")]
    {
        Some(va)
    }
    #[cfg(not(feature = "transport-ring"))]
    {
        Some(m::physical(va))
    }
}
pub(crate) fn output(va: usize, len: usize) -> isize {
    // SAFETY: EL0 is stopped on the sole masked-IRQ vCPU. access validates every source
    // page; the slice is used only until synchronous console copy completes.
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
/// # Safety
/// vectors.S supplies an aligned exclusive 33-word saved frame on the live EL1 stack with DAIF
/// masked. EL0 stays stopped, so checked user mappings cannot change during dispatch.
unsafe extern "C" fn trap(frame: *mut usize) {
    // SAFETY: vectors.S supplies an aligned exclusive 33-word saved frame on the live EL1
    // stack with DAIF masked. EL0 stays stopped, so checked user mappings cannot change
    // during dispatch.
    unsafe {
        #[cfg(not(feature = "transport-ring"))]
        let f = core::slice::from_raw_parts_mut(frame, 33);
        #[cfg(feature = "transport-ring")]
        let f = crate::arch::trap_frame(frame);
        let esr: u64;
        asm!("mrs {v},esr_el1",v=out(reg) esr);
        if esr >> ESR_CLASS_SHIFT != ESR_SVC64 {
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
        #[cfg(feature = "transport-ring")]
        asm!(".inst 0xd500409f", "isb", options(nostack)); // msr pan, #0
        #[cfg(feature = "trace")]
        {
            c::print("\x1esys ");
            c::hex(f[8]);
            c::print("\n");
        }
        let n = f[8];
        let args: [usize; 6] = f[..6].try_into().unwrap();
        #[cfg(feature = "transport-ring")]
        if let Some(ret) = crate::console::syscall(n, &args) {
            f[0] = ret as usize;
            return;
        }
        crate::trace::enter(n, &args, f[31]);
        #[cfg(feature = "probe")]
        let ret = match n {
            12345 => core::ptr::read_volatile(crate::memory::USER_BASE as *const isize),
            12346 => {
                core::ptr::write_volatile(crate::memory::PACKED_GPA as *mut usize, 0);
                0
            }
            12347 => {
                core::ptr::write_volatile(m::physical(FS) as *mut usize, 0);
                0
            }
            _ => crate::syscalls::dispatch(n, &args),
        };
        #[cfg(not(feature = "probe"))]
        let ret = crate::syscalls::dispatch(n, &args);
        crate::trace::exit(n, &args, ret);
        f[0] = ret as usize;
    }
}

use crate::{console as c, mmu as m};
use core::ptr::copy_nonoverlapping;
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
        #[cfg(feature = "transport-ring")]
        crate::console::heap_mapped(start, end);
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
        crate::arch::sync_icache(crate::memory::USER_BASE, cache_end);
        let entry = if cfg!(feature = "probe") {
            crate::memory::USER_BASE
        } else {
            packed::ENTRY
        };
        crate::arch::enter_user(sp, entry);
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
/// Ring builds: native stdout is a byte stream (`console::native_output`) and never
/// reaches here. JS-profile stdout has no reader: tenant code has no LOG path
/// (ABI-R7), so the buffer is checked as Linux would and dropped.
#[cfg(feature = "transport-ring")]
pub(crate) fn output(va: usize, len: usize) -> isize {
    crate::syscalls::discard(va, len)
}
#[cfg(not(feature = "transport-ring"))]
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
/// Core half of the syscall trap. The arch trap entry expands this with the
/// saved user frame (`&mut [usize]`, indexed by `arch::frame`) once per Linux
/// syscall; the result goes to the frame's return slot. It must be expanded
/// inside that entry's `unsafe` block, whose SAFETY contract (sole masked-IRQ
/// trap, user code stopped, user-access protection lifted on the ring path)
/// covers the console, ring and probe operations here. A macro rather than a
/// function: a call boundary changes how the trap is inlined and laid out
/// (ARCH.md, "Image identity").
macro_rules! syscall_entry {
    ($frame:expr) => {{
        use crate::arch::frame;
        let f: &mut [usize] = $frame;
        let n = f[frame::NR];
        let args: [usize; 6] = f[frame::ARGS..frame::ARGS + 6].try_into().unwrap();
        // ring::syscall checks every user range before access.
        #[cfg(feature = "transport-ring")]
        if let Some(ret) = crate::console::syscall(n, &args) {
            f[frame::RET] = ret as usize;
            return;
        }
        crate::trace::enter(n, &args, f[frame::PC]);
        // Probe-only isolation checks deliberately touch protected addresses; the
        // expected outcome is a fatal fault, reported by the arch trap entry.
        #[cfg(feature = "probe")]
        let ret = match n {
            12345 => core::ptr::read_volatile(crate::memory::USER_BASE as *const isize),
            12346 => {
                core::ptr::write_volatile(crate::memory::PACKED_GPA as *mut usize, 0);
                0
            }
            12347 => {
                core::ptr::write_volatile(crate::mmu::physical(crate::user::FS) as *mut usize, 0);
                0
            }
            _ => crate::syscalls::dispatch(n, &args),
        };
        #[cfg(not(feature = "probe"))]
        let ret = crate::syscalls::dispatch(n, &args);
        crate::trace::exit(n, &args, ret);
        f[frame::RET] = ret as usize;
    }};
}
pub(crate) use syscall_entry;

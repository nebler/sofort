//! Ring-only stage 1. All mutable backing lives in the selected stage-2 arena.
use core::arch::asm;

use crate::abi::arena::{BRK_BYTES, CANARY_BYTES, Class, DATA_BYTES, STACK_BYTES};

const CLASS: Class = if cfg!(ring_glue_4m) {
    Class::Glue4m
} else {
    Class::Glue2m
};
pub const ARENA: usize = crate::abi::ring::ARENA_GPA as usize;
pub const ARENA_BYTES: usize = CLASS.bytes();
const ARENA_TABLES: usize = ARENA_BYTES.div_ceil(0x200000);
const END: usize = ARENA + ARENA_BYTES;
const STACK: usize = END - CANARY_BYTES - STACK_BYTES;
const AF: u64 = 1 << 10;
const SH: u64 = 3 << 8;
const RO: u64 = 1 << 7;
const PXN: u64 = 1 << 53;
const UXN: u64 = 1 << 54;
const ADDRESS: u64 = 0x0000fffffffff000;
// link.ld places .data, .bss and the stack at this absolute symbol, so the
// image's arena is the ABI's arena GPA without a linker --defsym.
core::arch::global_asm!(".globl __ring_arena", ".set __ring_arena, {arena}", arena = const ARENA);

// Also identifies the physical layout to the offline snapshot preparer.
#[used]
#[unsafe(link_section = ".rodata.arena")]
static LAYOUT: [u64; crate::abi::arena::LAYOUT_WORDS] = CLASS.layout();
#[repr(C, align(4096))]
#[derive(Clone, Copy)]
struct Table([u64; 512]);
static mut ROOT: Table = Table([0; 512]);
static mut LOW: Table = Table([0; 512]);
static mut RAM: Table = Table([0; 512]);
static mut KERNEL: Table = Table([0; 512]);
static mut ARENA_TABLE: [Table; ARENA_TABLES] = [Table([0; 512]); ARENA_TABLES];
static mut DATA_VA: usize = 0;
static mut USER: [Table; 16] = [Table([0; 512]); 16];
// SAFETY: these symbols are supplied by the guest linker/assembly with the declared addresses
// and storage.
unsafe extern "C" {
    static __ro_start: u8;
    static __rw_start: u8;
    static __guard_start: u8;
    static __kernel_end: u8;
}
fn table(t: *const Table) -> u64 {
    t as u64 | 3
}
fn data_base() -> usize {
    (&raw const __kernel_end as usize + 4095) & !4095
}
fn brk_base() -> usize {
    data_base() + DATA_BYTES
}
fn mmap_base() -> usize {
    brk_base() + BRK_BYTES
}
pub fn heap_limit() -> usize {
    crate::user::HEAP + BRK_BYTES
}
pub fn mmap_limit() -> usize {
    crate::user::MMAP + STACK - mmap_base()
}
fn data_va() -> usize {
    // SAFETY: DATA_VA is initialized and read only on the sole masked-IRQ vCPU; no mutable
    // reference escapes.
    unsafe { DATA_VA }
}

/// # Safety
/// Called once at EL1 before EL0 with DAIF masked. Linker symbols and aligned tables are
/// mapped; this vCPU exclusively initializes stage-1 mappings.
pub unsafe fn init() {
    // SAFETY: Called once at EL1 before EL0 with DAIF masked. Linker symbols and aligned
    // tables are mapped; this vCPU exclusively initializes stage-1 mappings.
    unsafe {
        assert_eq!(&raw const __rw_start as usize, ARENA);
        assert!(
            mmap_base() + 0x80000 <= STACK,
            "ring kernel leaves <512 KiB mmap"
        );
        ROOT.0[0] = table(&raw const LOW);
        ROOT.0[2] = table(&raw const RAM);
        LOW.0[crate::abi::ring::DOORBELL_GPA as usize / 0x200000] =
            crate::abi::ring::DOORBELL_GPA | 1 | AF | 4 | PXN | UXN;
        // Immutable RAM is read-only even through the kernel's identity alias.
        for i in 0..16 {
            let pa = crate::memory::RAM_GPA as u64 + i as u64 * 0x200000;
            let writable = (ARENA as u64..END as u64).contains(&pa)
                || pa == crate::abi::ring::CONTROL_GPA & !0x1fffff;
            RAM.0[i] = pa | 1 | AF | SH | PXN | UXN | if writable { 0 } else { RO };
        }
        // Late-bound native archives have their own read-only stage-2 memslot
        // immediately after RAM. Keep the entire admitted 4 MiB EL1-only/RO.
        for i in 16..18 {
            RAM.0[i] = (crate::memory::RAM_GPA as u64 + i as u64 * 0x200000)
                | 1
                | AF
                | SH
                | RO
                | PXN
                | UXN;
        }
        RAM.0[0] = table(&raw const KERNEL);
        #[allow(
            clippy::needless_range_loop,
            reason = "The index selects both a RAM descriptor and its arena page table."
        )]
        for i in 0..ARENA_TABLES {
            RAM.0[(ARENA - crate::memory::RAM_GPA) / 0x200000 + i] =
                table(&raw const ARENA_TABLE[i]);
            for j in 0..512 {
                let pa = ARENA + i * 0x200000 + j * 4096;
                ARENA_TABLE[i].0[j] =
                    pa as u64 | 3 | AF | SH | PXN | UXN | if pa < END { 0 } else { RO };
            }
        }
        let guard = (&raw const __guard_start as usize - ARENA) / 4096;
        ARENA_TABLE[guard / 512].0[guard % 512] = 0;
        let ro = &raw const __ro_start as u64;
        for j in 0..512 {
            let pa = crate::memory::RAM_GPA as u64 + j as u64 * 4096;
            KERNEL.0[j] = pa | 3 | AF | SH | RO | UXN | if pa < ro { 0 } else { PXN };
        }
        asm!("msr mair_el1, {mair}", "msr tcr_el1, {tcr}", "msr ttbr0_el1, {root}",
            "dsb sy", "isb", "tlbi vmalle1", "dsb sy", "isb",
            "mrs x9, sctlr_el1", "orr x9,x9,#1", "orr x9,x9,#4", "orr x9,x9,#0x1000", "msr sctlr_el1,x9", "isb",
            mair=in(reg) 0x04ffu64, tcr=in(reg) (25u64|(1<<8)|(1<<10)|(3<<12)|(1<<23)|(2<<32)), root=in(reg) &raw const ROOT, out("x9") _);
    }
}

/// # Safety
/// The sole masked-IRQ EL1 context owns tables. va and W^X are asserted; writable backing stays
/// in the admitted arena and relocated copies are disjoint.
pub unsafe fn map(va: usize, write: bool, exec: bool) {
    // SAFETY: The sole masked-IRQ EL1 context owns tables. va and W^X are asserted; writable
    // backing stays in the admitted arena and relocated copies are disjoint.
    unsafe {
        assert!(
            (crate::memory::USER_BASE..crate::memory::USER_END).contains(&va) && !(write && exec)
        );
        let i = va / 0x200000 - 2;
        LOW.0[i + 2] = table(&raw const USER[i]);
        let pa = if write {
            if (crate::memory::STACK_START..crate::memory::STACK_END).contains(&va) {
                STACK + va - crate::memory::STACK_START
            } else if (crate::user::HEAP..heap_limit()).contains(&va) {
                brk_base() + va - crate::user::HEAP
            } else if (crate::user::MMAP..mmap_limit()).contains(&va) {
                mmap_base() + va - crate::user::MMAP
            } else {
                if DATA_VA == 0 {
                    DATA_VA = va;
                }
                assert!((data_va()..data_va() + DATA_BYTES).contains(&va));
                let pa = data_base() + va - data_va();
                core::ptr::copy_nonoverlapping(
                    (crate::memory::PACKED_GPA + va - crate::memory::USER_BASE) as *const u8,
                    pa as *mut u8,
                    4096,
                );
                pa
            }
        } else {
            crate::memory::PACKED_GPA + va - crate::memory::USER_BASE
        };
        USER[i].0[(va >> 12) & 511] = pa as u64
            | 3
            | AF
            | SH
            | (1 << 6)
            | if write { 0 } else { RO }
            | PXN
            | if exec { 0 } else { UXN };
    }
}
pub fn physical(va: usize) -> usize {
    // Early stack construction also uses this function after map().
    // SAFETY: va is in the kernel user-image range at each call. The sole masked-IRQ context
    // owns USER; only a copied descriptor is read.
    let p = unsafe { USER[va / 0x200000 - 2].0[(va >> 12) & 511] };
    if p & 3 == 3 {
        (p & ADDRESS) as usize + (va & 4095)
    } else {
        crate::memory::PACKED_GPA + va - crate::memory::USER_BASE
    }
}
/// # Safety
/// Called at EL1 on the sole vCPU after table updates and before resuming EL0; barriers
/// complete invalidation.
pub unsafe fn flush() {
    // SAFETY: Called at EL1 on the sole vCPU after table updates and before resuming EL0;
    // barriers complete invalidation.
    unsafe {
        asm!("dsb ishst", "tlbi vmalle1", "dsb ish", "isb");
    }
}
pub fn valid(va: usize, w: bool) -> bool {
    // SAFETY: The sole masked-IRQ syscall context owns USER and the checked range keeps the
    // descriptor index in bounds.
    unsafe {
        if !(crate::memory::USER_BASE..crate::memory::USER_END).contains(&va) {
            return false;
        }
        let p = USER[va / 0x200000 - 2].0[(va >> 12) & 511];
        p & 3 == 3 && (!w || p & RO == 0)
    }
}
/// # Safety
/// va is page-aligned and inside the mmap range checked by munmap. The sole masked-IRQ vCPU
/// owns USER and flushes before EL0 resumes.
pub unsafe fn unmap(va: usize) {
    // SAFETY: va is page-aligned and inside the mmap range checked by munmap. The sole
    // masked-IRQ vCPU owns USER and flushes before EL0 resumes.
    unsafe {
        USER[va / 0x200000 - 2].0[(va >> 12) & 511] = 0;
    }
}
/// # Safety
/// Called only during boot before EL0; immutable aliases already have read-only descriptors
/// established by init.
pub unsafe fn readonly(_pa: usize) { /* Immutable aliases are read-only at init. */
}
pub unsafe fn protect_aliases() { /* Stage 2 protects every non-arena page. */
}

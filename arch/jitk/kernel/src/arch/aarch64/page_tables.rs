//! Ring-only stage 1. All mutable backing lives in the selected stage-2 arena.
use core::arch::asm;

#[cfg(not(ring_glue_8m))]
pub const ARENA: usize = 0x81800000;
#[cfg(ring_glue_8m)]
pub const ARENA: usize = 0x81600000;
#[cfg(not(any(ring_glue_4m, ring_glue_8m)))]
pub const ARENA_BYTES: usize = 1_310_720;
#[cfg(ring_glue_4m)]
pub const ARENA_BYTES: usize = 2_621_440;
#[cfg(ring_glue_8m)]
pub const ARENA_BYTES: usize = 5_242_880;
const ARENA_TABLES: usize = ARENA_BYTES.div_ceil(0x200000);
const END: usize = ARENA + ARENA_BYTES;
const STACK: usize = END - 4096 - 0x20000;
const BRK_BYTES: usize = 0x10000;
const DATA_BYTES: usize = 0x10000;
const AF: u64 = 1 << 10;
const SH: u64 = 3 << 8;
const RO: u64 = 1 << 7;
const PXN: u64 = 1 << 53;
const UXN: u64 = 1 << 54;
const ADDRESS: u64 = 0x0000fffffffff000;

// Also identifies the physical layout to the offline snapshot preparer.
#[used]
#[unsafe(link_section = ".rodata.arena")]
static LAYOUT: [u64; 9] = [
    0x414e4552414b544a,
    2,
    if cfg!(ring_glue_8m) {
        8
    } else if cfg!(ring_glue_4m) {
        4
    } else {
        2
    },
    ARENA as u64,
    ARENA_BYTES as u64,
    81920,
    DATA_BYTES as u64,
    BRK_BYTES as u64,
    0x20000,
];
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
    unsafe { DATA_VA }
}

pub unsafe fn init() {
    unsafe {
        assert_eq!(&raw const __rw_start as usize, ARENA);
        assert!(
            mmap_base() + 0x80000 <= STACK,
            "ring kernel leaves <512 KiB mmap"
        );
        ROOT.0[0] = table(&raw const LOW);
        ROOT.0[2] = table(&raw const RAM);
        LOW.0[0x10000000 / 0x200000] = 0x10000000 | 1 | AF | 4 | PXN | UXN;
        // Immutable RAM is read-only even through the kernel's identity alias.
        for i in 0..16 {
            let pa = 0x80000000 + i as u64 * 0x200000;
            let writable = (ARENA as u64..END as u64).contains(&pa) || pa == 0x81c00000;
            RAM.0[i] = pa | 1 | AF | SH | PXN | UXN | if writable { 0 } else { RO };
        }
        // Late-bound native archives have their own read-only stage-2 memslot
        // immediately after RAM. Keep the entire admitted 4 MiB EL1-only/RO.
        for i in 16..18 {
            RAM.0[i] = (0x80000000 + i as u64 * 0x200000) | 1 | AF | SH | RO | PXN | UXN;
        }
        RAM.0[0] = table(&raw const KERNEL);
        for i in 0..ARENA_TABLES {
            RAM.0[(ARENA - 0x80000000) / 0x200000 + i] = table(&raw const ARENA_TABLE[i]);
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
            let pa = 0x80000000 + j as u64 * 4096;
            KERNEL.0[j] = pa | 3 | AF | SH | RO | UXN | if pa < ro { 0 } else { PXN };
        }
        asm!("msr mair_el1, {mair}", "msr tcr_el1, {tcr}", "msr ttbr0_el1, {root}",
            "dsb sy", "isb", "tlbi vmalle1", "dsb sy", "isb",
            "mrs x9, sctlr_el1", "orr x9,x9,#1", "orr x9,x9,#4", "orr x9,x9,#0x1000", "msr sctlr_el1,x9", "isb",
            mair=in(reg) 0x04ffu64, tcr=in(reg) (25u64|(1<<8)|(1<<10)|(3<<12)|(1<<23)|(2<<32)), root=in(reg) &raw const ROOT, out("x9") _);
    }
}

pub unsafe fn map(va: usize, write: bool, exec: bool) {
    unsafe {
        assert!((0x400000..0x2400000).contains(&va) && !(write && exec));
        let i = va / 0x200000 - 2;
        LOW.0[i + 2] = table(&raw const USER[i]);
        let pa = if write {
            if (0x1fe0000..0x2000000).contains(&va) {
                STACK + va - 0x1fe0000
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
                    (0x80080000 + va - 0x400000) as *const u8,
                    pa as *mut u8,
                    4096,
                );
                pa
            }
        } else {
            0x80080000 + va - 0x400000
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
    let p = unsafe { USER[va / 0x200000 - 2].0[(va >> 12) & 511] };
    if p & 3 == 3 {
        (p & ADDRESS) as usize + (va & 4095)
    } else {
        0x80080000 + va - 0x400000
    }
}
pub unsafe fn flush() {
    unsafe {
        asm!("dsb ishst", "tlbi vmalle1", "dsb ish", "isb");
    }
}
pub unsafe fn valid(va: usize, w: bool) -> bool {
    unsafe {
        if !(0x400000..0x2400000).contains(&va) {
            return false;
        }
        let p = USER[va / 0x200000 - 2].0[(va >> 12) & 511];
        p & 3 == 3 && (!w || p & RO == 0)
    }
}
pub unsafe fn unmap(va: usize) {
    unsafe {
        USER[va / 0x200000 - 2].0[(va >> 12) & 511] = 0;
    }
}
pub unsafe fn readonly(_pa: usize) { /* Immutable aliases are read-only at init. */
}
pub unsafe fn protect_aliases() { /* Stage 2 protects every non-arena page. */
}

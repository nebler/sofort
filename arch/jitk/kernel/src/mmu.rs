use core::arch::asm;
#[repr(C, align(4096))]
#[derive(Clone, Copy)]
struct Table([u64; 512]);
static mut ROOT: Table = Table([0; 512]);
static mut LOW: Table = Table([0; 512]);
static mut RAM: Table = Table([0; 512]);
static mut PAGES: [Table; 32] = [Table([0; 512]); 32];
#[cfg(feature = "qjs")]
static mut USER: [Table; 16] = [Table([0; 512]); 16];
// SAFETY: these symbols are supplied by the guest linker/assembly with the declared addresses
// and storage.
unsafe extern "C" {
    static __ro_start: u8;
    static __rw_start: u8;
    static __guard_start: u8;
}
const AF: u64 = 1 << 10;
const SH: u64 = 3 << 8;
const PXN: u64 = 1 << 53;
const UXN: u64 = 1 << 54;
/// # Safety
/// Only encodes the address of a stable, 4-KiB-aligned Table; it does not dereference t.
fn table(t: *const Table) -> u64 {
    t as u64 | 3
}
pub unsafe fn init() {
    // SAFETY: Called once at EL1 with DAIF masked before EL0. Linker symbols and aligned
    // static tables are mapped at their identity addresses; this vCPU owns all tables.
    unsafe {
        ROOT.0[0] = table(&raw const LOW);
        ROOT.0[2] = table(&raw const RAM);
        LOW.0[0x09e00000 / 0x200000] = 0x09e00000 | 1 | AF | 4 | PXN | UXN;
        LOW.0[0x0a000000 / 0x200000] = 0x0a000000 | 1 | AF | 4 | PXN | UXN;
        let ro = &raw const __ro_start as u64;
        let rw = &raw const __rw_start as u64;
        #[allow(
            clippy::needless_range_loop,
            reason = "The index selects both the RAM descriptor and its backing page table."
        )]
        for i in 0..32 {
            RAM.0[i] = table(&raw const PAGES[i]);
            for j in 0..512 {
                let pa = crate::memory::RAM_GPA as u64 + (i * 512 + j) as u64 * 4096;
                let perms = if pa < ro {
                    (1 << 7) | UXN
                } else if pa < rw {
                    (1 << 7) | PXN | UXN
                } else {
                    PXN | UXN
                };
                PAGES[i].0[j] = pa | 3 | AF | SH | perms;
            }
        }
        let guard = (&raw const __guard_start as usize - crate::memory::RAM_GPA) / 4096;
        PAGES[guard / 512].0[guard % 512] = 0;
        asm!("msr mair_el1, {mair}", "msr tcr_el1, {tcr}", "msr ttbr0_el1, {root}",
         "dsb sy", "isb", "tlbi vmalle1", "dsb sy", "isb",
         "mrs x9, sctlr_el1", "orr x9,x9,#1", "orr x9,x9,#4", "orr x9,x9,#0x1000", "msr sctlr_el1,x9", "isb",
         mair=in(reg) 0x04ffu64, tcr=in(reg) (25u64|(1<<8)|(1<<10)|(3<<12)|(1<<23)|(2<<32)), root=in(reg) &raw const ROOT, out("x9") _);
    }
}
#[cfg(feature = "qjs")]
/// # Safety
/// The sole masked-IRQ EL1 context owns page tables. va lies in the asserted user range;
/// permission updates are flushed before EL0 resumes.
pub unsafe fn map(va: usize, write: bool, exec: bool) {
    // SAFETY: The sole masked-IRQ EL1 context owns page tables. va lies in the asserted user
    // range; permission updates are flushed before EL0 resumes.
    unsafe {
        assert!((crate::memory::USER_BASE..crate::memory::USER_END).contains(&va));
        let i = va / 0x200000 - 2;
        LOW.0[i + 2] = table(&raw const USER[i]);
        let pa = physical(va);
        USER[i].0[(va >> 12) & 511] = pa as u64
            | 3
            | AF
            | SH
            | (1 << 6)
            | if write { 0 } else { 1 << 7 }
            | PXN
            | if exec { 0 } else { UXN };
    }
}
#[cfg(feature = "qjs")]
pub fn physical(va: usize) -> usize {
    crate::memory::PACKED_GPA + (va - crate::memory::USER_BASE)
}
#[cfg(feature = "qjs")]
/// # Safety
/// Called at EL1 on the sole vCPU after page-table writes and before user execution; barriers
/// complete the table walk invalidation.
pub unsafe fn flush() {
    // SAFETY: Called at EL1 on the sole vCPU after page-table writes and before user
    // execution; barriers complete the table walk invalidation.
    unsafe {
        asm!("dsb ishst", "tlbi vmalle1", "dsb ish", "isb");
    }
}
#[cfg(feature = "qjs")]
pub fn valid(va: usize, w: bool) -> bool {
    // SAFETY: The masked-IRQ syscall context is the only table reader/writer. va was bounded
    // to the user range by access or the mmap scan.
    unsafe {
        let i = va / 0x200000 - 2;
        let p = USER[i].0[(va >> 12) & 511];
        p & 3 == 3 && (!w || p & (1 << 7) == 0)
    }
}
#[cfg(feature = "qjs")]
/// # Safety
/// va is page-aligned and within the mmap range checked by munmap. The sole masked-IRQ vCPU
/// owns the table and flushes before resuming EL0.
pub unsafe fn unmap(va: usize) {
    // SAFETY: va is page-aligned and within the mmap range checked by munmap. The sole
    // masked-IRQ vCPU owns the table and flushes before resuming EL0.
    unsafe {
        USER[va / 0x200000 - 2].0[(va >> 12) & 511] = 0;
    }
}

#[cfg(feature = "qjs")]
/// # Safety
/// pa is an aligned RAM page backing a validated user/archive mapping; the sole masked-IRQ
/// context owns PAGES and flushes before EL0 resumes.
pub unsafe fn readonly(pa: usize) {
    // SAFETY: pa is an aligned RAM page backing a validated user/archive mapping; the sole
    // masked-IRQ context owns PAGES and flushes before EL0 resumes.
    unsafe {
        let index = (pa - crate::memory::RAM_GPA) / 4096;
        PAGES[index / 512].0[index % 512] |= 1 << 7;
    }
}
#[cfg(feature = "qjs")]
/// # Safety
/// Called during single-vCPU boot with EL0 stopped. Tables contain only validated mappings;
/// readonly updates PAGES, not the USER entries being read.
pub unsafe fn protect_aliases() {
    // SAFETY: Called during single-vCPU boot with EL0 stopped. Tables contain only validated
    // mappings; readonly updates PAGES, not the USER entries being read.
    unsafe {
        #[allow(
            clippy::needless_range_loop,
            reason = "The index addresses hardware table entries while readonly updates a different table."
        )]
        for i in 0..16 {
            for j in 0..512 {
                let p = USER[i].0[j];
                if p & 3 == 3 && p & (1 << 7) != 0 {
                    readonly((p & 0x0000fffffffff000) as usize);
                }
            }
        }
    }
}

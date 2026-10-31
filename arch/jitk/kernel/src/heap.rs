//! Ring builds: the user heap (brk, mmap, munmap, mremap).
//!
//! Every arena page from the user data copy to the stack is one pool
//! (`mmu::pool`). A heap page is any free pool page, mapped through the MMU
//! at whatever VA its mapping needs, so physical memory never fragments: a
//! request fails only when the pool has fewer free pages than it asks for.
//! User page tables come from the same pool. mmap VA ([`mmu::MMAP_VA`],
//! `USER_END`) is several times any class's pool, so its first-fit search
//! does not decide whether memory is available either. mremap moves page
//! descriptors, never bytes, so a block that grows is never held twice.
//!
//! Pages are taken lowest first: a run touches the fewest distinct arena
//! pages, which is what a dirty-page reset copies. A page is zeroed when it
//! is taken. All of this state is in the arena, so a reset restores it.
use crate::mmu as m;

const WORDS: usize = (m::ARENA_BYTES / 4096).div_ceil(64);
// One bit per pool page: set while a heap page or a page table holds it.
static mut USED: [u64; WORDS] = [0; WORDS];
// No free page below word LOWEST.
static mut LOWEST: usize = 0;
static mut IN_USE: usize = 0;
// The most pool pages in use at once, since boot: STATS heapPeakBytes.
static mut PEAK: usize = 0;
// No unmapped mmap page below this VA.
static mut FIRST_FREE: usize = m::MMAP_VA;

/// Free pool pages.
pub fn available() -> usize {
    // SAFETY: the sole masked-IRQ EL1 context owns the pool counters.
    m::pool().1 - unsafe { IN_USE }
}
/// The heap high-water in bytes: the most pool pages in use at once.
pub fn peak_bytes() -> u64 {
    // SAFETY: as available.
    unsafe { PEAK as u64 * 4096 }
}
/// Take the lowest free pool page, zeroed; None when the pool is empty.
///
/// # Safety
/// The sole masked-IRQ EL1 context owns the pool; the page is not mapped or
/// linked anywhere until the caller does so.
pub unsafe fn alloc() -> Option<usize> {
    // SAFETY: as above; pool pages are arena pages the kernel's identity map
    // makes writable at EL1.
    unsafe {
        let (base, pages) = m::pool();
        let mut w = LOWEST;
        while w < WORDS && USED[w] == !0 {
            w += 1;
        }
        LOWEST = w;
        if w == WORDS {
            return None;
        }
        let i = w * 64 + (!USED[w]).trailing_zeros() as usize;
        if i >= pages {
            return None;
        }
        USED[w] |= 1 << (i % 64);
        IN_USE += 1;
        if IN_USE > PEAK {
            PEAK = IN_USE;
            crate::console::heap_peak(peak_bytes());
        }
        let pa = base + i * 4096;
        core::ptr::write_bytes(pa as *mut u8, 0, 4096);
        Some(pa)
    }
}
/// Return pool page `pa`.
///
/// # Safety
/// `pa` was taken by `alloc` and no descriptor names it any more.
pub unsafe fn free(pa: usize) {
    // SAFETY: as above.
    unsafe {
        let (base, pages) = m::pool();
        let i = (pa - base) / 4096;
        assert!(pa.is_multiple_of(4096) && i < pages && USED[i / 64] & 1 << (i % 64) != 0);
        USED[i / 64] &= !(1 << (i % 64));
        IN_USE -= 1;
        LOWEST = LOWEST.min(i / 64);
    }
}
/// Pool pages a mapping of `pages` new pages at worst also needs for tables.
fn tables(pages: usize) -> usize {
    pages.div_ceil(512) + 1
}
/// Map `count` fresh pages at `va..`; false (with every page it mapped
/// unmapped again) if the pool ran out.
///
/// # Safety
/// The range is unmapped heap VA; the trap owns the tables and flushes.
unsafe fn populate(va: usize, count: usize) -> bool {
    // SAFETY: as above.
    unsafe {
        for i in 0..count {
            let ok = match alloc() {
                Some(pa) => {
                    m::map_page(va + i * 4096, pa) || {
                        free(pa);
                        false
                    }
                }
                None => false,
            };
            if !ok {
                release(va, i);
                return false;
            }
        }
        true
    }
}
/// Unmap `count` pages at `va..` (unmapped ones are skipped).
///
/// # Safety
/// The range is heap VA; the trap owns the tables and flushes.
unsafe fn release(va: usize, count: usize) {
    // SAFETY: as above.
    unsafe {
        for i in 0..count {
            m::unmap(va + i * 4096);
        }
        if va < FIRST_FREE && va >= m::MMAP_VA {
            FIRST_FREE = va;
        }
    }
}
/// The lowest mmap VA with `count` unmapped pages from it.
fn find(count: usize) -> Option<usize> {
    // SAFETY: the trap owns FIRST_FREE.
    let mut va = unsafe { FIRST_FREE };
    let mut start = va;
    let end = m::mmap_limit();
    while va < end {
        if va.is_multiple_of(0x200000) && m::block_empty(va) {
            va += 0x200000;
        } else if m::valid(va, false) {
            va += 4096;
            start = va;
        } else {
            va += 4096;
        }
        if va.min(end) - start >= count * 4096 {
            return Some(start);
        }
    }
    None
}
// One ENOMEM diagnostic per run (LOG records are budgeted per run).
static mut REPORTED: bool = false;
fn enomem(len: usize) {
    // SAFETY: the sole masked-IRQ trap owns REPORTED and the console.
    unsafe {
        #[cfg(feature = "heap-trace")]
        crate::heap_trace::enomem(len);
        if !REPORTED {
            REPORTED = true;
            crate::console::print("arena mmap ENOMEM bytes=");
            crate::console::hex(len);
            crate::console::print(" free=");
            crate::console::hex(available() * 4096);
            crate::console::print("\n");
        }
    }
}
fn mmap_range(va: usize, len: usize) -> bool {
    va.is_multiple_of(4096)
        && va >= m::MMAP_VA
        && va.checked_add(len).is_some_and(|e| e <= m::mmap_limit())
}

/// mmap of `len` (page-rounded) anonymous bytes; the caller checked flags.
pub fn mmap(len: usize) -> isize {
    let count = len / 4096;
    let Some(va) = find(count).filter(|_| available() >= count + tables(count)) else {
        enomem(len);
        return -12;
    };
    // SAFETY: find returned unmapped mmap VA; the trap owns the tables and
    // flushes before EL0 resumes.
    unsafe {
        if !populate(va, count) {
            m::flush();
            return -12;
        }
        if va == FIRST_FREE {
            FIRST_FREE = va + len;
        }
        m::flush();
    }
    va as isize
}
/// Map fresh pages at unmapped mmap VA `va..va + len` (page-aligned; the
/// grown mmap policies' `syscalls::map_zeroed`); false if the pool is short.
pub fn map_fixed(va: usize, len: usize) -> bool {
    let count = len / 4096;
    if available() < count + tables(count) {
        return false;
    }
    // SAFETY: the caller checked the range is unmapped mmap VA; the trap owns
    // the tables and flushes before EL0 resumes.
    unsafe {
        let ok = populate(va, count);
        m::flush();
        ok
    }
}
/// munmap: any page-aligned range of mmap VA; unmapped pages are skipped.
pub fn munmap(va: usize, len: usize) -> isize {
    let len = (len + 4095) & !4095;
    if len == 0 || !mmap_range(va, len) {
        return -22;
    }
    // SAFETY: mmap VA only (never the image, brk heap or stack); the trap
    // owns the tables and flushes before EL0 resumes.
    unsafe {
        release(va, len / 4096);
        m::flush();
    }
    0
}
/// mremap with flags 0 or MREMAP_MAYMOVE. A shrink unmaps the tail; a growth
/// maps the pages after the block if they are free, or else (MAYMOVE) moves
/// the block's descriptors to a new range and maps the rest there.
pub fn mremap(va: usize, old: usize, new: usize, flags: usize) -> isize {
    const MAYMOVE: usize = 1;
    let (old, new) = ((old + 4095) & !4095, (new + 4095) & !4095);
    if flags & !MAYMOVE != 0 || old == 0 || new == 0 || !mmap_range(va, old) {
        return -22;
    }
    if (va..va + old).step_by(4096).any(|p| m::page(p).is_none()) {
        return -14;
    }
    // SAFETY: the old range is mapped mmap VA; the trap owns the tables and
    // flushes before EL0 resumes.
    unsafe {
        if new <= old {
            release(va + new, (old - new) / 4096);
            m::flush();
            return va as isize;
        }
        let grow = (new - old) / 4096;
        if available() < grow + tables(new / 4096) {
            return -12;
        }
        let tail = va + old;
        if mmap_range(tail, new - old)
            && (tail..va + new).step_by(4096).all(|p| !m::valid(p, false))
        {
            let ok = populate(tail, grow);
            m::flush();
            return if ok { va as isize } else { -12 };
        }
        if flags & MAYMOVE == 0 {
            return -12;
        }
        let Some(to) = find(new / 4096) else {
            return -12;
        };
        // The check above leaves pages for every table of the new range and
        // for the new pages, and each take only returns pages, so neither the
        // move nor the growth can fail half-way.
        for i in 0..old / 4096 {
            let pa = m::take(va + i * 4096).unwrap();
            assert!(m::map_page(to + i * 4096, pa));
        }
        if va < FIRST_FREE {
            FIRST_FREE = va;
        }
        assert!(populate(to + old, grow));
        m::flush();
        to as isize
    }
}
/// brk: VA [HEAP, MMAP), pages from the pool. A break the pool cannot back
/// is refused (the old break is returned), as Linux does.
pub fn brk(want: usize, current: usize) -> usize {
    if want < crate::user::HEAP || want > m::heap_limit() {
        return current;
    }
    let (old_end, new_end) = ((current + 4095) & !4095, (want + 4095) & !4095);
    // SAFETY: brk VA only; the trap owns the tables and flushes before EL0
    // resumes. As Linux: pages above a lower break are unmapped, and pages it
    // maps again read as zero.
    unsafe {
        if new_end > old_end {
            let count = (new_end - old_end) / 4096;
            if available() < count + tables(count) || !populate(old_end, count) {
                m::flush();
                return current;
            }
        } else {
            for va in (new_end..old_end).step_by(4096) {
                m::unmap(va);
            }
        }
        m::flush();
    }
    want
}

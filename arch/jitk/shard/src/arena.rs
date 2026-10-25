//! Fixed physical contract for the ring-only glue-2m image.
pub const START: usize = 0x1800000;
pub const BYTES: usize = 1_310_720;
pub const END: usize = START + BYTES;
pub const CANARY: usize = END - 4096;
pub const RING_BYTES: usize = 81_920;
pub const LAYOUT: [u64; 4] = [
    0x414e4552414b544a,
    0x80000000 + START as u64,
    BYTES as u64,
    RING_BYTES as u64,
];
pub fn layout_bytes() -> Vec<u8> {
    LAYOUT.iter().flat_map(|v| v.to_le_bytes()).collect()
}
/// Stable memslots: immutable extents alternate with exactly two writable extents.
pub fn regions(ram: usize, ctrl: usize) -> [(usize, usize, bool); 5] {
    assert!(END < ctrl && ctrl + RING_BYTES < ram);
    [
        (0, START, false),
        (START, END, true),
        (END, ctrl, false),
        (ctrl, ctrl + RING_BYTES, true),
        (ctrl + RING_BYTES, ram, false),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_class_arena_and_rings_are_writable() {
        let regions = regions(32 << 20, 0x1d00000);
        assert_eq!(regions.first().unwrap().0, 0);
        assert_eq!(regions.last().unwrap().1, 32 << 20);
        for pair in regions.windows(2) {
            assert_eq!(pair[0].1, pair[1].0);
        }
        let writable: usize = regions
            .iter()
            .filter(|(_, _, writable)| *writable)
            .map(|(start, end, _)| end - start)
            .sum();
        assert_eq!(writable, 1_310_720 + 81_920);
        assert!(
            regions
                .iter()
                .all(|(start, end, _)| start % 4096 == 0 && end % 4096 == 0 && start < end)
        );
    }
}

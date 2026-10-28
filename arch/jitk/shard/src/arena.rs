//! Versioned physical contracts for ring-only images. No unbounded restore class.
//! The classes, their arena extents, layout record and memslot regions are
//! defined once in jitk-abi (`abi::arena`), which the kernel also links.
pub use jitk_abi::arena::Class;
/// The second writable extent: control page plus both rings.
pub const RING_BYTES: usize = crate::constants::ring::TRANSPORT_BYTES;

#[cfg(test)]
mod tests {
    use super::{Class, RING_BYTES};

    #[test]
    fn only_the_class_arena_and_rings_are_writable() {
        for class in Class::ALL {
            let regions = class.regions(32 << 20, 0x1d00000);
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
            assert_eq!(writable, class.bytes() + RING_BYTES);
            assert!(
                regions
                    .iter()
                    .all(|(start, end, _)| start % 4096 == 0 && end % 4096 == 0 && start < end)
            );
        }
    }

    #[test]
    fn layouts_reject_legacy_unknown_and_modified_bounds() {
        for class in Class::ALL {
            let bytes = class.layout_bytes();
            assert_eq!(Class::from_layout(&bytes), Some(class));
            for at in 0..bytes.len() {
                let mut changed = bytes;
                changed[at] ^= 0x80;
                assert_eq!(Class::from_layout(&changed), None);
            }
            assert_eq!(Class::from_layout(&bytes[..32]), None);
        }
    }
}

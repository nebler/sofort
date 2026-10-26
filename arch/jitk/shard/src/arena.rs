//! Versioned physical contracts for ring-only images. No unbounded restore class.
use crate::constants::ring;
pub const RING_BYTES: usize = ring::TRANSPORT_BYTES;
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Class {
    Glue2m,
    Glue4m,
}
impl Class {
    pub const ALL: [Self; 2] = [Self::Glue2m, Self::Glue4m];
    pub fn name(self) -> &'static str {
        match self {
            Self::Glue2m => "glue-2m",
            Self::Glue4m => "glue-4m",
        }
    }
    pub fn admission_bytes(self) -> u32 {
        match self {
            Self::Glue2m => 2 << 20,
            Self::Glue4m => 4 << 20,
        }
    }
    pub fn bytes(self) -> usize {
        match self {
            Self::Glue2m => 1_310_720,
            Self::Glue4m => 2_883_584,
        }
    }
    pub fn start(self) -> usize {
        ring::ARENA_OFFSET
    }
    pub fn end(self) -> usize {
        self.start() + self.bytes()
    }
    pub fn canary(self) -> usize {
        self.end() - 4096
    }
    pub fn layout_bytes(self) -> Vec<u8> {
        let mib = match self {
            Self::Glue2m => 2,
            Self::Glue4m => 4,
        };
        [
            0x414e4552414b544au64,
            2,
            mib,
            ring::RAM_GPA + self.start() as u64,
            self.bytes() as u64,
            RING_BYTES as u64,
            65536,
            65536,
            131072,
        ]
        .iter()
        .flat_map(|v| v.to_le_bytes())
        .collect()
    }
    pub fn from_layout(bytes: &[u8]) -> Option<Self> {
        Self::ALL.into_iter().find(|c| c.layout_bytes() == bytes)
    }
    /// Stable memslots: immutable extents alternate with two writable extents.
    pub fn regions(self, ram: usize, ctrl: usize) -> [(usize, usize, bool); 5] {
        let end = self.end();
        assert!(end < ctrl && ctrl + RING_BYTES < ram);
        [
            (0, self.start(), false),
            (self.start(), end, true),
            (end, ctrl, false),
            (ctrl, ctrl + RING_BYTES, true),
            (ctrl + RING_BYTES, ram, false),
        ]
    }
}

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
                let mut changed = bytes.clone();
                changed[at] ^= 0x80;
                assert_eq!(Class::from_layout(&changed), None);
            }
            assert_eq!(Class::from_layout(&bytes[..32]), None);
        }
    }
}

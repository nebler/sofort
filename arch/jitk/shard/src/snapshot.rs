//! Bounded, verified snapshot metadata; no VM or guest execution is needed to load it.
use crate::{arena, constants::ring::RAM_BYTES as RAM};
use std::{
    fs::File,
    io::{self, Read},
    sync::Arc,
};
pub struct Register {
    pub(crate) id: u64,
    pub(crate) data: Vec<u8>,
}
impl Register {
    pub fn id(&self) -> u64 {
        self.id
    }
    pub fn bytes(&self) -> &[u8] {
        &self.data
    }
}
pub struct Snapshot {
    pub memory: File,
    pub class: arena::Class,
    pub(crate) regs: Vec<Register>,
}
pub(crate) fn read_metadata(reader: impl Read, limit: usize) -> io::Result<Vec<u8>> {
    let mut bytes = Vec::new();
    reader.take((limit + 1) as u64).read_to_end(&mut bytes)?;
    if bytes.len() > limit {
        return Err(snapshot_error("snapshot metadata size bound"));
    }
    Ok(bytes)
}
fn snapshot_error(message: &'static str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}
fn parse_registers(b: &[u8]) -> io::Result<Vec<Register>> {
    if b.get(..8) != Some(b"JTKREGS2") {
        return Err(snapshot_error("snapshot register magic/truncated header"));
    }
    let mut remaining = &b[8..];
    let mut regs = Vec::new();
    let mut ids = std::collections::HashSet::new();
    while !remaining.is_empty() {
        let h = remaining
            .get(..16)
            .ok_or_else(|| snapshot_error("truncated register header"))?;
        // Fixed-size checked header slices; these conversions cannot fail.
        let id = u64::from_le_bytes(h[..8].try_into().unwrap());
        let n = u64::from_le_bytes(h[8..].try_into().unwrap());
        let width = 1u64 << ((id >> 52) & 15);
        if width > 256 || n != width || id >> 56 != 0x60 || !ids.insert(id) || regs.len() >= 2048 {
            return Err(snapshot_error("snapshot register width/identity/count"));
        }
        let data = remaining
            .get(16..16 + n as usize)
            .ok_or_else(|| snapshot_error("truncated register data"))?;
        regs.push(Register {
            id,
            data: data.to_vec(),
        });
        remaining = &remaining[16 + n as usize..];
    }
    if regs.len() <= 68 {
        return Err(snapshot_error("snapshot register count too small"));
    }
    Ok(regs)
}
impl Snapshot {
    /// Borrow immutable register values from this verified snapshot.
    pub fn registers(&self) -> impl Iterator<Item = (u64, &[u8])> {
        self.regs.iter().map(|reg| (reg.id, reg.data.as_slice()))
    }

    pub fn load(base: &str) -> io::Result<Arc<Self>> {
        let memory = File::open(format!("{base}.mem"))?;
        if memory.metadata()?.len() != RAM as u64 {
            return Err(snapshot_error("snapshot RAM length"));
        }
        let layout = read_metadata(File::open(format!("{base}.layout"))?, 72)?;
        let class = arena::Class::from_layout(&layout)
            .ok_or_else(|| snapshot_error("unsupported ring snapshot layout"))?;
        // The sidecar cannot select a different class than the linked image.
        use std::os::unix::fs::FileExt;
        let mut kernel = vec![0; 0x80000];
        memory.read_exact_at(&mut kernel, 0)?;
        if !kernel.windows(layout.len()).any(|b| b == layout) {
            return Err(snapshot_error("snapshot/layout mismatch"));
        }
        let b = read_metadata(File::open(format!("{base}.regs"))?, 8 + 2048 * (16 + 256))?;
        let regs = parse_registers(&b)?;
        Ok(Arc::new(Self {
            memory,
            regs,
            class,
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::{parse_registers, read_metadata};
    use std::io::{self, Read};
    #[test]
    fn snapshot_metadata_reads_are_bounded_before_allocation() {
        struct Endless {
            read: usize,
        }
        impl Read for Endless {
            fn read(&mut self, out: &mut [u8]) -> io::Result<usize> {
                assert!(self.read <= 73, "reader consumed beyond limit+1");
                let n = out.len().min(1024);
                out[..n].fill(0);
                self.read += n;
                Ok(n)
            }
        }
        assert!(read_metadata(Endless { read: 0 }, 72).is_err());
        assert_eq!(read_metadata(&b"abc"[..], 3).unwrap(), b"abc");
        assert!(read_metadata(&b"abcd"[..], 3).is_err());
    }
    fn register_bytes() -> Vec<u8> {
        let mut bytes = b"JTKREGS2".to_vec();
        for i in 0..69u64 {
            bytes.extend_from_slice(&(0x6030_0000_0010_0000 + i).to_le_bytes());
            bytes.extend_from_slice(&8u64.to_le_bytes());
            bytes.extend_from_slice(&0u64.to_le_bytes());
        }
        bytes
    }
    #[test]
    fn snapshot_registers_reject_truncation_and_corrupt_widths() {
        let good = register_bytes();
        assert!(parse_registers(&good).is_ok());
        for n in 0..good.len() {
            assert!(parse_registers(&good[..n]).is_err(), "prefix {n}");
        }
        for width in [0, 1, 7, 9, 256, u64::MAX] {
            let mut bad = good.clone();
            bad[16..24].copy_from_slice(&width.to_le_bytes());
            assert!(parse_registers(&bad).is_err());
        }
        let mut bad = good.clone();
        bad[8..16].copy_from_slice(&0x6090_0000_0010_0000u64.to_le_bytes());
        assert!(parse_registers(&bad).is_err());
        let mut bad = good.clone();
        bad.extend_from_slice(&good[8..32]);
        assert!(parse_registers(&bad).is_err(), "duplicate id");
        let mut bad = good;
        bad[0] = 0;
        assert!(parse_registers(&bad).is_err());
    }
}

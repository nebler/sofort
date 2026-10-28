//! Bounded, verified snapshot metadata; no VM or guest execution is needed to load it.
use crate::{
    arena,
    constants::{ABI_VERSION, ring::RAM_BYTES as RAM},
};
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
    /// Read-only view of `memory`, the source of copy-restore resets.
    #[cfg(target_os = "linux")]
    pub(crate) reference: Reference,
}
/// One `PROT_READ`, `MAP_SHARED` view of the snapshot file, shared by every slot
/// of this snapshot. The file is opened read-only, so the kernel refuses any
/// later `mprotect(PROT_WRITE)` of this view: nothing in the process can write
/// the bytes a reset copies from. Its clean pages are the same page-cache pages
/// that back untouched guest RAM.
#[cfg(target_os = "linux")]
pub(crate) struct Reference {
    ptr: *const u8,
}
// SAFETY: the view is immutable for its whole lifetime (read-only file, read-only
// shared mapping) and only raw-pointer reads are exposed.
#[cfg(target_os = "linux")]
unsafe impl Send for Reference {}
// SAFETY: as for Send; concurrent reads of immutable bytes do not race.
#[cfg(target_os = "linux")]
unsafe impl Sync for Reference {}
#[cfg(target_os = "linux")]
impl Reference {
    pub(crate) fn map(memory: &File) -> io::Result<Self> {
        use std::os::fd::AsRawFd;
        // SAFETY: memory is a live descriptor whose length was checked to be RAM;
        // the result is checked before use and owned by the returned Reference.
        let p = unsafe {
            libc::mmap(
                std::ptr::null_mut(),
                RAM,
                libc::PROT_READ,
                libc::MAP_SHARED,
                memory.as_raw_fd(),
                0,
            )
        };
        if p == libc::MAP_FAILED {
            return Err(io::Error::last_os_error());
        }
        Ok(Self { ptr: p.cast() })
    }
    /// Base of the RAM-sized read-only view.
    pub(crate) fn ptr(&self) -> *const u8 {
        self.ptr
    }
}
#[cfg(target_os = "linux")]
impl Drop for Reference {
    fn drop(&mut self) {
        // SAFETY: this owns the original mapping; every Slot that reads through it
        // holds the Arc<Snapshot> owning this Reference.
        unsafe {
            libc::munmap(self.ptr as *mut _, RAM);
        }
    }
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
/// The `abiVersion` of a prepared snapshot's `.identity` JSON (written by
/// shard/snapshot.ts, whose other fields Node verifies). Exactly one
/// `"abiVersion": <u32>` member; anything else is no version.
pub(crate) fn identity_abi_version(identity: &[u8]) -> Option<u32> {
    const KEY: &str = "\"abiVersion\"";
    let text = std::str::from_utf8(identity).ok()?;
    if text.matches(KEY).count() != 1 {
        return None;
    }
    let rest = text[text.find(KEY)? + KEY.len()..]
        .trim_start()
        .strip_prefix(':')?
        .trim_start();
    let digits = rest.bytes().take_while(u8::is_ascii_digit).count();
    if !rest[digits..].trim_start().starts_with([',', '}']) {
        return None;
    }
    rest[..digits].parse().ok()
}
/// Why a KVM register id lies outside the state the slot reset covers, if it
/// does. The reset restores the register list and RAM bytes of a PSCI-only
/// AArch64 vCPU; a snapshot from a vCPU with more features fails to load:
/// - coprocessor classes other than core, CCSIDR demux, system and the two
///   firmware classes, e.g. SVE (0x15: Z/P/FFR and the vector-length pseudo-reg);
/// - PAC keys, PMU, MTE (whose allocation tags in RAM are not restored) and SME
///   or SVE control system registers.
pub(crate) fn uncovered_register(id: u64) -> Option<&'static str> {
    match (id >> 16) & 0xfff {
        0x10 | 0x11 | 0x14 | 0x16 => return None,
        0x13 => {}
        0x15 => return Some("SVE"),
        _ => return Some("unknown register class"),
    }
    let e = id & 0xffff;
    let (op0, op1, crn, crm, op2) = (e >> 14, e >> 11 & 7, e >> 7 & 15, e >> 3 & 15, e & 7);
    match (op0, op1, crn, crm, op2) {
        (3, 0, 2, 1..=3, _) => Some("PAC key"),
        (3, _, 9, 12..=14, _) | (3, 3, 14, 8..=15, _) | (3, 0, 9, 9..=10, _) => Some("PMU/SPE"),
        (3, 0, 1, 0, 5 | 6) | (3, 0, 5, 6, 0 | 1) => Some("MTE"),
        (3, 0, 1, 2, 0 | 4 | 6) | (3, 3, 4, 2, 2) | (3, 3, 13, 0, 5) => Some("SVE/SME control"),
        _ => None,
    }
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
        if uncovered_register(id).is_some() {
            return Err(snapshot_error(
                "snapshot register outside the reset's coverage",
            ));
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

    /// [`Self::load`] a prepared snapshot whose `.identity` names this shard's
    /// ABI version (the production IPC path; offline harness snapshots have
    /// no identity).
    pub fn load_identified(base: &str) -> io::Result<Arc<Self>> {
        let identity = read_metadata(File::open(format!("{base}.identity"))?, 4096)?;
        match identity_abi_version(&identity) {
            Some(ABI_VERSION) => Self::load(base),
            found => Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!(
                    "prepared snapshot ABI version {} is not this shard's ABI version {ABI_VERSION}; run make -C arch/jitk/shard snapshot",
                    found.map_or("missing".to_string(), |v| v.to_string())
                ),
            )),
        }
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
            #[cfg(target_os = "linux")]
            reference: Reference::map(&memory)?,
            memory,
            regs,
            class,
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::{identity_abi_version, parse_registers, read_metadata, uncovered_register};
    use crate::constants::ABI_VERSION;
    use std::io::{self, Read};
    #[test]
    fn identity_abi_version_is_exact() {
        let identity = |v: &str| {
            format!(
                "{{\n  \"version\": 2,\n  \"abiVersion\": {v},\n  \"helperSha256\": \"00\"\n}}\n"
            )
        };
        assert_eq!(
            identity_abi_version(identity(&ABI_VERSION.to_string()).as_bytes()),
            Some(ABI_VERSION)
        );
        // A deliberately mismatched version is reported as itself, so
        // load_identified refuses it.
        assert_eq!(identity_abi_version(identity("7").as_bytes()), Some(7));
        assert_ne!(Some(7), Some(ABI_VERSION));
        for bad in ["\"8\"", "8.5", "-8", "", "99999999999"] {
            assert_eq!(
                identity_abi_version(identity(bad).as_bytes()),
                None,
                "{bad}"
            );
        }
        assert_eq!(identity_abi_version(b"{\"version\": 1}"), None);
        assert_eq!(
            identity_abi_version(b"{\"abiVersion\": 8, \"abiVersion\": 8}"),
            None
        );
        assert_eq!(identity_abi_version(b"{\"abiVersion\": 8}"), Some(8));
    }
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
    fn snapshots_with_state_the_reset_does_not_cover_are_rejected() {
        let sys = |op0: u64, op1: u64, crn: u64, crm: u64, op2: u64| {
            0x6030_0000_0013_0000 | op0 << 14 | op1 << 11 | crn << 7 | crm << 3 | op2
        };
        for id in [
            0x6030_0000_0010_0000u64, // core x0
            0x6020_0000_0011_0000,    // CCSIDR demux
            0x6030_0000_0014_0000,    // PSCI version
            0x6030_0000_0016_0000,    // firmware feature bitmap
            sys(3, 3, 13, 0, 2),      // TPIDR_EL0
            sys(3, 0, 1, 0, 0),       // SCTLR_EL1
            sys(3, 0, 0, 4, 0),       // ID_AA64PFR0_EL1
            sys(3, 3, 14, 3, 1),      // CNTV_CTL_EL0
            sys(3, 0, 2, 0, 0),       // TTBR0_EL1, next to the PAC keys
        ] {
            assert_eq!(uncovered_register(id), None, "{id:#x}");
        }
        for id in [
            0x6080_0000_0015_0000u64, // SVE Z0
            0x6040_0000_0015_ffff,    // SVE vector lengths
            0x6030_0000_0012_0000,    // not a class KVM defines for arm64
            sys(3, 0, 2, 1, 0),       // APIAKEYLO_EL1
            sys(3, 0, 2, 3, 1),       // APGAKEYHI_EL1
            sys(3, 3, 9, 12, 0),      // PMCR_EL0
            sys(3, 3, 14, 8, 0),      // PMEVCNTR0_EL0
            sys(3, 0, 9, 14, 1),      // PMINTENSET_EL1
            sys(3, 0, 1, 0, 6),       // GCR_EL1
            sys(3, 0, 5, 6, 0),       // TFSR_EL1
            sys(3, 0, 1, 2, 0),       // ZCR_EL1
            sys(3, 3, 4, 2, 2),       // SVCR
            sys(3, 3, 13, 0, 5),      // TPIDR2_EL0
        ] {
            assert!(uncovered_register(id).is_some(), "{id:#x}");
        }
        // One such id rejects a whole register file that is otherwise valid.
        let mut bytes = register_bytes();
        bytes.extend_from_slice(&sys(3, 3, 9, 12, 0).to_le_bytes());
        bytes.extend_from_slice(&8u64.to_le_bytes());
        bytes.extend_from_slice(&0u64.to_le_bytes());
        assert!(parse_registers(&bytes).is_err());
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

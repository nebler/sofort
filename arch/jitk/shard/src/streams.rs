//! Negotiated R7 native TX decoder. All cursors and budgets are host shadows.
use crate::constants::ring;
use ring::{HEADER_BYTES, RecordHeader};
pub use ring::{NATIVE_FEATURES as FEATURES, OUTPUT_LIMIT, RECORD_BYTES, RING_BYTES};

#[derive(Debug, PartialEq, Eq)]
pub struct Output {
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
    pub exit_code: u32,
    pub limited: bool,
}

pub struct Receiver {
    generation: u64,
    consumed: u64,
    limit: usize,
    stdout: Vec<u8>,
    stderr: Vec<u8>,
    completion: Option<(u32, bool)>,
    log_bytes: usize,
    records: usize,
}
impl Receiver {
    pub fn new(generation: u64, limit: usize) -> Result<Self, &'static str> {
        if generation == 0 || limit > OUTPUT_LIMIT {
            return Err("invalid native bind");
        }
        Ok(Self {
            generation,
            consumed: 0,
            limit,
            stdout: Vec::new(),
            stderr: Vec::new(),
            completion: None,
            log_bytes: 0,
            records: 0,
        })
    }
    pub fn consumed(&self) -> u64 {
        self.consumed
    }
    /// `copy` reads exactly dst.len() bytes, wrapping inside the fixed TX extent.
    /// Header and payload are each copied once; only those private copies are used.
    pub fn drain(
        &mut self,
        produced: u64,
        mut copy: impl FnMut(u64, &mut [u8]),
    ) -> Result<(), &'static str> {
        let available = produced
            .checked_sub(self.consumed)
            .ok_or("cursor reversal")?;
        if available > RING_BYTES as u64 || !produced.is_multiple_of(8) {
            return Err("invalid TX cursor");
        }
        while self.consumed < produced {
            let remaining = produced - self.consumed;
            if remaining < HEADER_BYTES as u64 || self.completion.is_some() {
                return Err("trailing or truncated record");
            }
            let mut h = [0; HEADER_BYTES];
            copy(self.consumed, &mut h);
            let h = RecordHeader::decode(&h);
            // remaining <= RING_BYTES (checked above), so it fits in usize.
            if !h.framed(remaining as usize) || h.generation != self.generation || h.cap != 0 {
                return Err("invalid native header");
            }
            let (len, kind, flags, offset, n) =
                (h.len as usize, h.kind, h.flags, h.id, h.n as usize);
            self.records += 1;
            if self.records > 65536 {
                return Err("native record budget");
            }
            // Allocation is at most 16,352 bytes, regardless of guest lengths.
            let mut b = vec![0; len - HEADER_BYTES];
            copy(self.consumed + HEADER_BYTES as u64, &mut b);
            if b[n..].iter().any(|b| *b != 0) {
                return Err("nonzero padding");
            }
            b.truncate(n);
            match kind {
                ring::STDOUT | ring::STDERR => {
                    if flags != 0 || n == 0 {
                        return Err("invalid byte record");
                    }
                    let used = self.stdout.len() + self.stderr.len();
                    if n > self.limit - used {
                        return Err("native output budget");
                    }
                    let dst = if kind == ring::STDOUT {
                        &mut self.stdout
                    } else {
                        &mut self.stderr
                    };
                    if offset != dst.len() as u64 {
                        return Err("stream offset mismatch");
                    }
                    dst.extend_from_slice(&b);
                }
                ring::NATIVE_EXIT => {
                    if flags != 0 || offset != 0 || n != 24 {
                        return Err("invalid native completion");
                    }
                    let status = u32::from_le_bytes(b[..4].try_into().unwrap());
                    let limited = u32::from_le_bytes(b[4..8].try_into().unwrap());
                    let stdout = u64::from_le_bytes(b[8..16].try_into().unwrap());
                    let stderr = u64::from_le_bytes(b[16..24].try_into().unwrap());
                    if status > 255
                        || limited > 1
                        || stdout != self.stdout.len() as u64
                        || stderr != self.stderr.len() as u64
                    {
                        return Err("completion totals/status");
                    }
                    self.completion = Some((status, limited == 1));
                }
                ring::LOG => {
                    // The diagnostic subset is canonical JSON, bounded separately.
                    const PREFIX: &[u8] = b"{\"level\":\"debug\",\"msg\":\"";
                    if flags != 1 || offset != 0 || !b.starts_with(PREFIX) || !b.ends_with(b"\"}") {
                        return Err("invalid JSON LOG");
                    }
                    let msg = &b[PREFIX.len()..b.len() - 2];
                    if msg.len() > 256 * 6
                        || !msg.len().is_multiple_of(6)
                        || msg.chunks(6).any(|c| {
                            &c[..4] != b"\\u00" || !c[4..].iter().all(u8::is_ascii_hexdigit)
                        })
                    {
                        return Err("invalid JSON LOG escape");
                    }
                    self.log_bytes += n;
                    if self.log_bytes > ring::LOG_BYTES {
                        return Err("LOG budget");
                    }
                    if std::env::var_os("JITK_NATIVE_DIAGNOSTICS").is_some() {
                        let decoded: Vec<u8> = msg
                            .as_chunks::<6>()
                            .0
                            .iter()
                            .map(|c| {
                                u8::from_str_radix(std::str::from_utf8(&c[4..]).unwrap(), 16)
                                    .unwrap()
                            })
                            .collect();
                        eprint!("{}", String::from_utf8_lossy(&decoded));
                    }
                }
                _ => return Err("unnegotiated native record kind"),
            }
            self.consumed = self.consumed.checked_add(len as u64).ok_or("TX overflow")?;
        }
        Ok(())
    }
    pub fn finish(&mut self, op: u32) -> Result<Option<Output>, &'static str> {
        if (op == ring::FINISH) != self.completion.is_some() {
            return Err("completion/doorbell mismatch");
        }
        if !matches!(op, 1..=3) {
            return Err("invalid native doorbell");
        }
        Ok(self.completion.take().map(|(exit_code, limited)| Output {
            stdout: std::mem::take(&mut self.stdout),
            stderr: std::mem::take(&mut self.stderr),
            exit_code,
            limited,
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::{Output, RECORD_BYTES, RING_BYTES, Receiver};
    fn record(kind: u16, offset: u64, b: &[u8]) -> Vec<u8> {
        let mut v = vec![0; (32 + b.len() + 7) & !7];
        let len = v.len() as u32;
        v[..4].copy_from_slice(&len.to_le_bytes());
        v[4..6].copy_from_slice(&kind.to_le_bytes());
        v[8..16].copy_from_slice(&9u64.to_le_bytes());
        v[16..24].copy_from_slice(&offset.to_le_bytes());
        v[24..28].copy_from_slice(&(b.len() as u32).to_le_bytes());
        v[32..32 + b.len()].copy_from_slice(b);
        v
    }
    fn drain(r: &mut Receiver, v: &[u8]) -> Result<(), &'static str> {
        let start = r.consumed;
        r.drain(start + v.len() as u64, |at, dst| {
            dst.copy_from_slice(&v[(at - start) as usize..(at - start) as usize + dst.len()])
        })
    }
    #[test]
    fn arbitrary_bytes_streams_and_status() {
        let mut r = Receiver::new(9, 99).unwrap();
        drain(&mut r, &record(6, 0, &[0, 255, 128, 10])).unwrap();
        drain(&mut r, &record(7, 0, b"err\0")).unwrap();
        drain(&mut r, &record(6, 4, b"tail")).unwrap();
        let mut b = [0; 24];
        b[..4].copy_from_slice(&42u32.to_le_bytes());
        b[8..16].copy_from_slice(&8u64.to_le_bytes());
        b[16..24].copy_from_slice(&4u64.to_le_bytes());
        drain(&mut r, &record(8, 0, &b)).unwrap();
        assert_eq!(
            r.finish(3).unwrap().unwrap(),
            Output {
                stdout: b"\0\xff\x80\ntail".to_vec(),
                stderr: b"err\0".to_vec(),
                exit_code: 42,
                limited: false
            }
        );
    }
    #[test]
    fn hostile_headers_and_cursors() {
        let good = record(6, 0, b"x");
        for (at, value) in [
            (0, 0),
            (1, 255),
            (4, 5),
            (6, 1),
            (8, 8),
            (16, 1),
            (24, 255),
            (28, 1),
            (39, 1),
        ] {
            let mut bad = good.clone();
            bad[at] = value;
            assert!(
                drain(&mut Receiver::new(9, 99).unwrap(), &bad).is_err(),
                "byte {at}"
            );
        }
        for prod in [1, 24, 32776, u64::MAX] {
            assert!(
                Receiver::new(9, 99)
                    .unwrap()
                    .drain(prod, |_, _| panic!("invalid cursor read"))
                    .is_err()
            );
        }
        let mut r = Receiver::new(9, 99).unwrap();
        drain(&mut r, &good).unwrap();
        assert!(r.drain(0, |_, _| panic!()).is_err());
        assert!(r.finish(3).is_err());
    }
    #[test]
    fn stream_budgets_duplicates_and_terminal_order() {
        let mut r = Receiver::new(9, 1).unwrap();
        drain(&mut r, &record(6, 0, b"x")).unwrap();
        assert!(drain(&mut r, &record(7, 0, b"y")).is_err());
        let mut r = Receiver::new(9, 99).unwrap();
        drain(&mut r, &record(6, 0, b"x")).unwrap();
        assert!(drain(&mut r, &record(6, 0, b"x")).is_err());
        let mut r = Receiver::new(9, 99).unwrap();
        let b = record(8, 0, &[0; 24]);
        drain(&mut r, &b).unwrap();
        assert!(drain(&mut r, &b).is_err());
        let mut r = Receiver::new(9, 99).unwrap();
        drain(&mut r, &record(8, 0, &[0; 24])).unwrap();
        assert!(r.finish(1).is_err());
    }
    #[test]
    fn wraps_and_repeated_credit() {
        let mut r = Receiver::new(9, 100000).unwrap();
        let mut ring = [0; RING_BYTES];
        let mut prod = 0u64;
        for _ in 0..1000 {
            let b = record(6, r.stdout.len() as u64, &[255; 33]);
            for (i, b) in b.iter().enumerate() {
                ring[(prod as usize + i) % RING_BYTES] = *b;
            }
            prod += b.len() as u64;
            r.drain(prod, |at, dst| {
                for (i, b) in dst.iter_mut().enumerate() {
                    *b = ring[(at as usize + i) % RING_BYTES]
                }
            })
            .unwrap();
        }
        assert_eq!(r.stdout.len(), 33000);
        assert_eq!(r.consumed, prod);
    }
    #[test]
    fn header_fuzz_never_reads_past_a_committed_record() {
        let mut rng = 0x765432109abcdefu64;
        for _ in 0..10000 {
            let mut b = record(6, 0, b"some bytes");
            for byte in &mut b[..32] {
                rng ^= rng << 13;
                rng ^= rng >> 7;
                rng ^= rng << 17;
                if rng & 3 == 0 {
                    *byte = (rng >> 8) as u8;
                }
            }
            let mut r = Receiver::new(9, 99).unwrap();
            let _ = r.drain(b.len() as u64, |at, dst| {
                assert!(dst.len() <= RECORD_BYTES);
                let at = at as usize;
                assert!(at <= b.len() && dst.len() <= b.len() - at);
                dst.copy_from_slice(&b[at..at + dst.len()]);
            });
        }
    }
    #[test]
    fn completion_and_log_contracts() {
        for (at, value) in [(1, 1), (4, 2), (8, 1), (16, 1)] {
            let mut bytes = [0; 24];
            bytes[at] = value;
            assert!(drain(&mut Receiver::new(9, 99).unwrap(), &record(8, 0, &bytes)).is_err());
        }
        for payload in [
            b"binary\0\xff".as_slice(),
            b"{\"level\":\"debug\",\"msg\":\"raw\"}",
        ] {
            let mut b = record(4, 0, payload);
            b[6] = 1;
            assert!(drain(&mut Receiver::new(9, 99).unwrap(), &b).is_err());
        }
        let mut b = record(4, 0, br#"{"level":"debug","msg":"\u0000\u00ff"}"#);
        b[6] = 1;
        drain(&mut Receiver::new(9, 99).unwrap(), &b).unwrap();
    }
}

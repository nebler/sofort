//! Opaque guest payload forwarding. The shard checks length, printable ASCII
//! and (at the call sites) identity; it never parses JSON. Node parses every
//! payload and is the only schema and policy authority, so a second validator
//! cannot disagree with it about what is valid (R9 N1).
use crate::constants::ring;

/// The guest bootstrap escapes everything outside 0x20..=0x7e as `\uXXXX`.
pub fn printable(bytes: &[u8]) -> bool {
    bytes.iter().all(|b| (32..=126).contains(b))
}
/// Whether a guest CALL or DONE record payload is forwarded to Node.
pub fn forwarded(kind: u16, bytes: &[u8]) -> bool {
    let max = match kind {
        ring::CALL => ring::CALL_BYTES,
        ring::DONE => ring::DONE_BYTES,
        _ => return false,
    };
    bytes.len() <= max && printable(bytes)
}
#[cfg(test)]
pub(crate) mod tests {
    use super::forwarded;
    use crate::constants::ring;
    /// `abi/guest-payloads.json`, shared with the executor's Node tests.
    /// Rows are one per line: `[kind, name, outcome, payload]`, where each
    /// payload code point is one byte. Only the escapes JSON.stringify emits
    /// for that file (`\"`, `\\`, `\uXXXX`) are decoded.
    pub(crate) fn corpus() -> Vec<(u16, String, String, Vec<u8>)> {
        let mut rows = Vec::new();
        for line in include_str!("../../abi/guest-payloads.json").lines() {
            let Some(row) = line.strip_prefix('[') else {
                continue;
            };
            let mut fields = Vec::new();
            let mut bytes = row.bytes();
            while let Some(b) = bytes.next() {
                if b != b'"' {
                    continue;
                }
                let mut field = Vec::new();
                loop {
                    match bytes.next().expect("unterminated corpus string") {
                        b'"' => break,
                        b'\\' => match bytes.next() {
                            Some(b'u') => {
                                let hex: Vec<u8> = bytes.by_ref().take(4).collect();
                                let s = std::str::from_utf8(&hex).unwrap();
                                field.push(
                                    u8::try_from(u16::from_str_radix(s, 16).unwrap()).unwrap(),
                                );
                            }
                            Some(e @ (b'"' | b'\\')) => field.push(e),
                            e => panic!("corpus escape {e:?}"),
                        },
                        b => field.push(b),
                    }
                }
                fields.push(field);
            }
            let [kind, name, outcome, payload] = <[Vec<u8>; 4]>::try_from(fields).unwrap();
            let kind = match &kind[..] {
                b"call" => ring::CALL,
                b"done" => ring::DONE,
                _ => panic!("corpus kind"),
            };
            let text = |v: Vec<u8>| String::from_utf8(v).unwrap();
            rows.push((kind, text(name), text(outcome), payload));
        }
        assert!(rows.len() >= 30, "corpus rows");
        rows
    }
    #[test]
    fn shared_corpus_forwarding() {
        for (kind, name, outcome, payload) in corpus() {
            assert!(
                ["ok", "node", "shard"].contains(&outcome.as_str()),
                "{name}"
            );
            assert_eq!(forwarded(kind, &payload), outcome != "shard", "{name}");
        }
    }
    #[test]
    fn bounds() {
        assert!(forwarded(ring::CALL, &[b'x'; ring::CALL_BYTES]));
        assert!(!forwarded(ring::CALL, &[b'x'; ring::CALL_BYTES + 1]));
        assert!(forwarded(ring::DONE, &[b'x'; ring::DONE_BYTES]));
        assert!(!forwarded(ring::DONE, &[b'x'; ring::DONE_BYTES + 1]));
        assert!(!forwarded(ring::LOG, b"x"));
    }
}

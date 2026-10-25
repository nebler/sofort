//! Public repair receipt: ChaCha20 block 1 with the 128-bit root repeated as
//! a 256-bit key. Block 0 stays in the guest's native repair frame.
pub fn receipt(seed: [u8; 16]) -> [u8; 16] {
    let mut s = [0u32; 16];
    s[..4].copy_from_slice(&[0x61707865, 0x3320646e, 0x79622d32, 0x6b206574]);
    for i in 0..8 {
        s[4 + i] = u32::from_le_bytes(seed[(i % 4) * 4..(i % 4) * 4 + 4].try_into().unwrap());
    }
    s[12] = 1;
    let mut x = s;
    fn qr(x: &mut [u32; 16], a: usize, b: usize, c: usize, d: usize) {
        x[a] = x[a].wrapping_add(x[b]);
        x[d] = (x[d] ^ x[a]).rotate_left(16);
        x[c] = x[c].wrapping_add(x[d]);
        x[b] = (x[b] ^ x[c]).rotate_left(12);
        x[a] = x[a].wrapping_add(x[b]);
        x[d] = (x[d] ^ x[a]).rotate_left(8);
        x[c] = x[c].wrapping_add(x[d]);
        x[b] = (x[b] ^ x[c]).rotate_left(7);
    }
    for _ in 0..10 {
        for (a, b, c, d) in [
            (0, 4, 8, 12),
            (1, 5, 9, 13),
            (2, 6, 10, 14),
            (3, 7, 11, 15),
            (0, 5, 10, 15),
            (1, 6, 11, 12),
            (2, 7, 8, 13),
            (3, 4, 9, 14),
        ] {
            qr(&mut x, a, b, c, d);
        }
    }
    let mut out = [0u8; 16];
    for i in 0..4 {
        out[4 * i..4 * i + 4].copy_from_slice(&x[i].wrapping_add(s[i]).to_le_bytes());
    }
    out
}

#[test]
fn chacha_zero_key_counter_one() {
    // Published ChaCha20 all-zero key/nonce, counter=1 (RFC 8439 appendix A.1).
    assert_eq!(
        receipt([0; 16]),
        [
            0x9f, 0x07, 0xe7, 0xbe, 0x55, 0x51, 0x38, 0x7a, 0x98, 0xba, 0x97, 0x7c, 0x73, 0x2d,
            0x08, 0x0d,
        ]
    );
}

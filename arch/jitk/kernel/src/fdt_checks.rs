use crate::fdt;
fn word(b: &mut Vec<u8>, n: u32) { b.extend_from_slice(&n.to_be_bytes()); }
fn begin(b: &mut Vec<u8>, name: &[u8]) {
    word(b, 1); b.extend_from_slice(name); b.push(0);
    while !b.len().is_multiple_of(4) { b.push(0); }
}
fn prop(b: &mut Vec<u8>, name: u32, v: &[u8]) {
    word(b, 3); word(b, v.len() as u32); word(b, name); b.extend_from_slice(v);
    while !b.len().is_multiple_of(4) { b.push(0); }
}
fn blob(epoch: &[u8]) -> Vec<u8> {
    let mut s = Vec::new();
    begin(&mut s, b"");
    prop(&mut s, 26, &[b"jitk.epoch_ns=".as_slice(), epoch, b"\0"].concat());
    begin(&mut s, b"console");
    prop(&mut s, 0, b"virtio,mmio\0");
    prop(&mut s, 11, &[0x0a000000u64.to_be_bytes(), 4096u64.to_be_bytes()].concat());
    word(&mut s, 2);
    begin(&mut s, b"gic");
    prop(&mut s, 0, b"arm,gic-v3\0");
    prop(&mut s, 11, &[0x08000000u64.to_be_bytes(), 4096u64.to_be_bytes(), 0x080a0000u64.to_be_bytes(), 4096u64.to_be_bytes()].concat());
    word(&mut s, 2); word(&mut s, 2); word(&mut s, 9);
    let strings = b"compatible\0reg\0interrupts\0bootargs\0";
    let mut h = vec![0u8; 40];
    for (at, value) in [(0,0xd00dfeed), (4, (40+s.len()+strings.len()) as u32), (8,40), (12,(40+s.len()) as u32), (20,17), (24,16), (32,strings.len() as u32), (36,s.len() as u32)] {
        h[at..at+4].copy_from_slice(&value.to_be_bytes());
    }
    h.extend(s); h.extend(strings); h
}
#[test]
fn bounded_fdt_and_decimal_bootargs() {
    let check = |b: &[u8]| fdt::parse(b);
    assert_eq!(check(&blob(b"123")).unwrap().epoch, 123);
    for epoch in [b":".as_slice(), b"18446744073709551616", b"", b"-1"] {
        assert!(check(&blob(epoch)).is_err(), "accepted malformed decimal {epoch:?}");
    }
    let good = blob(b"123");
    // Every truncated header/block and malformed name/length must fail closed.
    for (at, value) in [(8,u32::MAX), (12,u32::MAX), (32,u32::MAX), (36,u32::MAX), (48,u32::MAX), (52,u32::MAX)] {
        let mut b = good.clone(); b[at..at+4].copy_from_slice(&value.to_be_bytes());
        assert!(check(&b).is_err(), "accepted malformed field at {at}");
    }
    let mut unterminated = good.clone();
    unterminated[44..].fill(b'x');
    assert!(check(&unterminated).is_err());
    for end in 0..good.len() { assert!(check(&good[..end]).is_err()); }
}

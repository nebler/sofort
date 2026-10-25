// Read only a bounded FDT blob supplied by the VMM; take fresh entropy from bootargs.
pub unsafe fn seed(addr: usize) -> [u8; 16] {
    unsafe {
        assert!(addr >= 0x80000000 && addr + 40 <= 0x84000000);
        let header = core::slice::from_raw_parts(addr as *const u8, 40);
        let be = |o| u32::from_be_bytes(header[o..o + 4].try_into().unwrap()) as usize;
        assert!(be(0) == 0xd00dfeed);
        let size = be(4);
        assert!(size >= 40 && size <= 0x200000 && addr + size <= 0x84000000);
        let blob = core::slice::from_raw_parts(addr as *const u8, size);
        let mut cur = be(8);
        let strings = be(12);
        let strings_len = be(32);
        let structure_end = cur.checked_add(be(36)).unwrap();
        assert!(structure_end <= size && strings + strings_len <= size);
        while cur + 4 <= structure_end {
            let token = u32::from_be_bytes(blob[cur..cur + 4].try_into().unwrap());
            cur += 4;
            match token {
                1 => {
                    while cur < structure_end && blob[cur] != 0 {
                        cur += 1;
                    }
                    cur = (cur + 4) & !3;
                }
                2 | 4 => {}
                9 => break,
                3 => {
                    assert!(cur + 8 <= structure_end);
                    let len = u32::from_be_bytes(blob[cur..cur + 4].try_into().unwrap()) as usize;
                    let name =
                        u32::from_be_bytes(blob[cur + 4..cur + 8].try_into().unwrap()) as usize;
                    cur += 8;
                    assert!(cur + len <= structure_end && name < strings_len);
                    let tail = &blob[strings + name..strings + strings_len];
                    if tail.starts_with(b"bootargs\0") {
                        for window in blob[cur..cur + len].windows(42) {
                            if window.starts_with(b"jitk.seed=") {
                                let mut seed = [0; 16];
                                let hex = |b: u8| -> u8 {
                                    match b {
                                        b'0'..=b'9' => b - b'0',
                                        b'a'..=b'f' => b - b'a' + 10,
                                        _ => panic!(),
                                    }
                                };
                                for i in 0..16 {
                                    seed[i] =
                                        hex(window[10 + 2 * i]) * 16 + hex(window[11 + 2 * i]);
                                }
                                return seed;
                            }
                        }
                    }
                    cur = (cur + len + 3) & !3;
                }
                _ => panic!(),
            }
        }
        panic!()
    }
}

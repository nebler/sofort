// Trusted VMM FDT, bounded token walker; root uses two address/size cells.
pub struct Config {
    pub seed: [u8; 16],
    pub epoch: u64,
    pub counter: u64,
    pub console: usize,
    pub dist: usize,
    pub redist: usize,
    pub irq: u32,
    pub tick: u64,
}
fn be(b: &[u8], o: usize) -> usize {
    u32::from_be_bytes(b[o..o + 4].try_into().unwrap()) as usize
}
fn be64(b: &[u8], o: usize) -> usize {
    (be(b, o) << 32) | be(b, o + 4)
}
pub unsafe fn read(addr: usize) -> Config {
    unsafe {
        assert!((0x80000000..0x82000000).contains(&addr));
        let h = core::slice::from_raw_parts(addr as *const u8, 40);
        assert!(be(h, 0) == 0xd00dfeed && be(h, 4) <= 0x200000 && addr + be(h, 4) <= 0x82000000);
        let b = core::slice::from_raw_parts(addr as *const u8, be(h, 4));
        let mut c = Config {
            seed: [0; 16],
            epoch: 0,
            counter: 0,
            console: 0,
            dist: 0,
            redist: 0,
            irq: 0,
            tick: 1000,
        };
        let (mut pos, strings, end) = (be(h, 8), be(h, 12), be(h, 8) + be(h, 36));
        let mut reg = [0usize; 4];
        let mut irq = 0;
        let mut virt = false;
        let mut gic = false;
        while pos + 4 <= end {
            let token = be(b, pos);
            pos += 4;
            match token {
                1 => {
                    reg = [0; 4];
                    irq = 0;
                    virt = false;
                    gic = false;
                    while b[pos] != 0 {
                        pos += 1;
                    }
                    pos = (pos + 4) & !3;
                }
                2 => {
                    if virt {
                        c.console = reg[0];
                        c.irq = irq;
                    }
                    if gic {
                        c.dist = reg[0];
                        c.redist = reg[2];
                    }
                }
                3 => {
                    let len = be(b, pos);
                    let name = strings + be(b, pos + 4);
                    pos += 8;
                    assert!(pos + len <= end && name < b.len());
                    let v = &b[pos..pos + len];
                    if b[name..].starts_with(b"compatible\0") {
                        virt = v.starts_with(b"virtio,mmio\0");
                        gic = v.starts_with(b"arm,gic-v3\0");
                    } else if b[name..].starts_with(b"reg\0") && len >= 16 {
                        reg[0] = be64(v, 0);
                        reg[1] = be64(v, 8);
                        if len >= 32 {
                            reg[2] = be64(v, 16);
                            reg[3] = be64(v, 24);
                        }
                    } else if b[name..].starts_with(b"interrupts\0") && len >= 12 {
                        irq = be(v, 4) as u32 + if be(v, 0) == 0 { 32 } else { 16 };
                    } else if b[name..].starts_with(b"bootargs\0") {
                        for word in v.split(|&b| b == b' ' || b == 0) {
                            if word.starts_with(b"jitk.seed=") && word.len() == 42 {
                                let hex = |b: u8| match b {
                                    b'0'..=b'9' => b - b'0',
                                    b'a'..=b'f' => b - b'a' + 10,
                                    _ => panic!(),
                                };
                                for i in 0..16 {
                                    c.seed[i] = hex(word[10 + i * 2]) * 16 + hex(word[11 + i * 2]);
                                }
                            }
                            for (key, out) in [
                                (b"jitk.epoch_ns=".as_slice(), &mut c.epoch),
                                (b"jitk.counter=", &mut c.counter),
                                (b"jitk.tick_us=", &mut c.tick),
                            ] {
                                if word.starts_with(key) {
                                    *out = word[key.len()..].iter().fold(0u64, |n, &b| {
                                        n.checked_mul(10).unwrap() + u64::from(b - b'0')
                                    });
                                }
                            }
                        }
                    }
                    pos = (pos + len + 3) & !3;
                }
                4 => {}
                9 => break,
                _ => panic!(),
            }
        }
        assert!(c.console != 0 && c.dist != 0 && c.redist != 0 && c.epoch != 0);
        c
    }
}

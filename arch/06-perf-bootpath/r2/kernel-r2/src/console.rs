use core::{
    arch::asm,
    ptr::{read_volatile as rv, write_volatile as wv},
};
const N: usize = 8;
#[repr(C, align(4096))]
#[derive(Clone, Copy)]
struct Queue {
    desc: [u64; N * 2],
    avail: [u16; 3 + N],
    used: [u32; 2 + N * 2],
    buf: [u8; 1024],
}
const EMPTY: Queue = Queue {
    desc: [0; N * 2],
    avail: [0; 3 + N],
    used: [0; 2 + N * 2],
    buf: [0; 1024],
};
static mut QS: [Queue; 4] = [EMPTY; 4];
static mut BASE: usize = 0;
static mut CONTROL: [[u8; 256]; N] = [[0; 256]; N];
unsafe fn wr(off: usize, val: u32) {
    unsafe {
        asm!("str {v:w}, [{a}]",v=in(reg) val,a=in(reg) BASE+off,options(nostack));
    }
}
unsafe fn read32(addr: usize) -> u32 {
    let v: u32;
    unsafe {
        asm!("ldr {v:w}, [{a}]",v=out(reg) v,a=in(reg) addr,options(nostack));
    }
    v
}
unsafe fn rd(off: usize) -> u32 {
    unsafe { read32(BASE + off) }
}
unsafe fn barrier() {
    unsafe {
        asm!("dmb sy", options(nostack));
    }
}
unsafe fn address(off: usize, addr: usize) {
    unsafe {
        wr(off, addr as u32);
        wr(off + 4, (addr >> 32) as u32);
    }
}
pub unsafe fn init(base: usize) {
    unsafe {
        BASE = base;
        assert!(read32(BASE) == 0x74726976 && read32(BASE + 8) == 3);
        wr(0x70, 0);
        wr(0x70, 1);
        wr(0x70, 3);
        wr(0x24, 0);
        wr(0x20, 2); // MULTIPORT
        wr(0x24, 1);
        wr(0x20, 1); // VERSION_1
        wr(0x70, 11);
        if rd(0x70) & 8 == 0 {
            crate::off();
        }
        for i in 0..4 {
            wr(0x30, i as u32);
            wr(0x38, N as u32);
            let q = &mut QS[i];
            address(0x80, q.desc.as_ptr() as usize);
            address(0x90, q.avail.as_ptr() as usize);
            address(0xa0, q.used.as_ptr() as usize);
            wr(0x44, 1);
        }
        wr(0x70, 15);
        for _ in 0..N {
            post(2, 256, true);
        }
        post(0, 1024, true);
        control(0);
        while !STARTED {
            service();
            core::hint::spin_loop();
        }
    }
}
unsafe fn post(i: usize, len: usize, writable: bool) {
    unsafe {
        let q = &mut QS[i];
        let idx = rv(&q.avail[1]);
        let id = if i == 2 { idx as usize % N } else { 0 };
        let buffer = if i == 2 {
            CONTROL[id].as_ptr()
        } else {
            q.buf.as_ptr()
        };
        wv(&mut q.desc[id * 2], buffer as u64);
        wv(
            &mut q.desc[id * 2 + 1],
            len as u64 | if writable { 2u64 << 32 } else { 0 },
        );
        wv(&mut q.avail[2 + (idx as usize % N)], id as u16);
        barrier();
        wv(&mut q.avail[1], idx.wrapping_add(1));
        barrier();
        wr(0x50, i as u32);
    }
}
unsafe fn send(i: usize, bytes: &[u8]) {
    unsafe {
        for chunk in bytes.chunks(1024) {
            QS[i].buf[..chunk.len()].copy_from_slice(chunk);
            let used = (QS[i].used.as_ptr() as *const u16).add(1);
            let expected = rv(used).wrapping_add(1);
            post(i, chunk.len(), false);
            while rv(used) != expected {
                core::hint::spin_loop();
            }
            barrier();
        }
    }
}
unsafe fn control(event: u16) {
    unsafe {
        let b = [0, 0, 0, 0, event as u8, 0, 1, 0];
        send(3, &b);
    }
}
static mut USER_LINE_START: bool = true;
pub unsafe fn user_write(b: &[u8]) {
    unsafe {
        write(b);
        if let Some(&last) = b.last() {
            USER_LINE_START = last == 10;
        }
    }
}
pub unsafe fn print(s: &str) {
    unsafe {
        if s.starts_with("\x1e") && !USER_LINE_START {
            crate::off();
        }
        write(s.as_bytes());
    }
}
pub unsafe fn write(b: &[u8]) {
    unsafe {
        send(1, b);
    }
}
pub unsafe fn hex(n: usize) {
    unsafe {
        let mut b = [b'0'; 16];
        for i in 0..16 {
            b[15 - i] = b"0123456789abcdef"[(n >> (i * 4)) & 15];
        }
        write(&b);
    }
}

static mut STARTED: bool = false;
static mut RX_SEEN: u16 = 0;
static mut CTL_SEEN: u16 = 0;
static mut RX_LEN: usize = 0;
static mut RX_POS: usize = 0;
static mut EOF: bool = false;
pub unsafe fn service() {
    unsafe {
        let used = (QS[2].used.as_ptr() as *const u16).add(1);
        while rv(used) != CTL_SEEN {
            barrier();
            let len = rv(&QS[2].used[2 + (CTL_SEEN as usize % N) * 2]);
            let id = rv(&QS[2].used[1 + (CTL_SEEN as usize % N) * 2]) as usize;
            assert!(id < N);
            let b = &CONTROL[id];
            if len >= 8 && b[..4] == [0, 0, 0, 0] {
                let event = u16::from_le_bytes([b[4], b[5]]);
                let value = u16::from_le_bytes([b[6], b[7]]);

                if event == 1 {
                    control(3);
                    control(6);
                    STARTED = true;
                }
                if event == 6 {
                    EOF = value == 0;
                }
            }
            CTL_SEEN = CTL_SEEN.wrapping_add(1);
            post(2, 256, true);
        }
        if RX_LEN == 0 {
            let used = (QS[0].used.as_ptr() as *const u16).add(1);
            if rv(used) != RX_SEEN {
                barrier();
                RX_LEN = (rv(&QS[0].used[2 + (RX_SEEN as usize % N) * 2]) as usize).min(1024);
                RX_POS = 0;
                RX_SEEN = RX_SEEN.wrapping_add(1);
                if RX_LEN == 0 {
                    EOF = true;
                }
            }
        }
        let status = rd(0x60);
        if status != 0 {
            wr(0x64, status);
        }
    }
}
pub unsafe fn available() -> bool {
    unsafe { RX_POS < RX_LEN }
}
pub unsafe fn eof() -> bool {
    unsafe { EOF && RX_POS == RX_LEN }
}
pub unsafe fn read(dst: &mut [u8]) -> usize {
    unsafe {
        if dst.is_empty() {
            return 0;
        }
        loop {
            service();
            if available() {
                break;
            }
            if eof() {
                return 0;
            }
            crate::wait::park(u64::MAX);
        }
        let n = dst.len().min(RX_LEN - RX_POS);
        dst[..n].copy_from_slice(&QS[0].buf[RX_POS..RX_POS + n]);
        RX_POS += n;
        if RX_POS == RX_LEN {
            RX_POS = 0;
            RX_LEN = 0;
            post(0, 1024, true);
        }
        n
    }
}

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
pub unsafe fn init() {
    unsafe {
        for n in 0..32 {
            let b = 0x0a000000 + n * 0x200;
            if read32(b) == 0x74726976 && read32(b + 8) == 3 {
                BASE = b;
                break;
            }
        }
        if BASE == 0 {
            crate::off();
        }
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
        // Host control responses may be ignored for this fixed one-port topology,
        // but RX descriptors are posted so control output cannot stall.
        post(2, 1024, true);
        control(0);
        control(3);
        control(6);
    }
}
unsafe fn post(i: usize, len: usize, writable: bool) {
    unsafe {
        let q = &mut QS[i];
        wv(&mut q.desc[0], q.buf.as_ptr() as u64);
        wv(
            &mut q.desc[1],
            len as u64 | if writable { 2u64 << 32 } else { 0 },
        );
        let idx = rv(&q.avail[1]);
        wv(&mut q.avail[2 + (idx as usize % N)], 0);
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
pub unsafe fn print(s: &str) {
    unsafe {
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
// One posted RX descriptor shared by ppoll and read; readiness never consumes bytes.
static mut RX_POSTED: bool = false;
static mut RX_EXPECT: u16 = 0;
static mut RX_SLOT: usize = 0;
static mut RX_LEN: usize = 0;
static mut RX_OFF: usize = 0;
pub unsafe fn readable() -> bool {
    unsafe {
        if RX_OFF < RX_LEN { return true; }
        if !RX_POSTED {
            let used = (QS[0].used.as_ptr() as *const u16).add(1);
            let before = rv(used);
            RX_EXPECT = before.wrapping_add(1);
            RX_SLOT = before as usize % N;
            post(0,1024,true);
            RX_POSTED = true;
        }
        let used = (QS[0].used.as_ptr() as *const u16).add(1);
        if rv(used) != RX_EXPECT { return false; }
        barrier();
        RX_LEN = (rv(&QS[0].used[2 + RX_SLOT * 2]) as usize).min(1024);
        RX_OFF = 0;
        RX_POSTED = false;
        RX_LEN != 0
    }
}
#[cfg(feature = "qjs")]
pub unsafe fn read(dst: &mut [u8]) -> usize {
    unsafe {
        if dst.is_empty() { return 0; }
        while !readable() { core::hint::spin_loop(); }
        let len = dst.len().min(RX_LEN-RX_OFF);
        dst[..len].copy_from_slice(&QS[0].buf[RX_OFF..RX_OFF+len]);
        RX_OFF += len;
        len
    }
}

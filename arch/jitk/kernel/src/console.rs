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
/// # Safety
/// BASE is the initialized, mapped virtio MMIO base; off is an aligned 32-bit register offset
/// in that device.
unsafe fn wr(off: usize, val: u32) {
    // SAFETY: BASE is the initialized, mapped virtio MMIO base; off is an aligned 32-bit
    // register offset in that device.
    unsafe {
        asm!("str {v:w}, [{a}]",v=in(reg) val,a=in(reg) BASE+off,options(nostack));
    }
}
/// # Safety
/// addr is an aligned readable 32-bit MMIO register in the mapped console device.
unsafe fn read32(addr: usize) -> u32 {
    let v: u32;
    // SAFETY: addr is an aligned readable 32-bit MMIO register in the mapped console device.
    unsafe {
        asm!("ldr {v:w}, [{a}]",v=out(reg) v,a=in(reg) addr,options(nostack));
    }
    v
}
/// # Safety
/// BASE is initialized and off selects an aligned readable virtio register.
unsafe fn rd(off: usize) -> u32 {
    // SAFETY: BASE is initialized and off selects an aligned readable virtio register.
    unsafe { read32(BASE + off) }
}
unsafe fn barrier() {
    // SAFETY: Execution is at EL1; the barrier orders guest queue accesses against device
    // DMA without lending memory references.
    unsafe {
        asm!("dmb sy", options(nostack));
    }
}
/// # Safety
/// off and off+4 select the two address registers; addr is a stable identity-mapped queue
/// allocation.
unsafe fn address(off: usize, addr: usize) {
    // SAFETY: off and off+4 select the two address registers; addr is a stable
    // identity-mapped queue allocation.
    unsafe {
        wr(off, addr as u32);
        wr(off + 4, (addr >> 32) as u32);
    }
}
/// # Safety
/// Called once before EL0 on the sole masked-IRQ vCPU. base is mapped virtio MMIO; queue
/// storage remains pinned for the VM lifetime.
pub unsafe fn init(base: usize) {
    // SAFETY: Called once before EL0 on the sole masked-IRQ vCPU. base is mapped virtio
    // MMIO; queue storage remains pinned for the VM lifetime.
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
        #[allow(
            clippy::needless_range_loop,
            reason = "Queue indices are the virtio MMIO queue selector and index QS."
        )]
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
/// # Safety
/// The sole masked-IRQ vCPU owns queue i (0..4), len fits its pinned buffer, and any prior
/// device use has completed. Publication follows descriptor initialization.
unsafe fn post(i: usize, len: usize, writable: bool) {
    // SAFETY: The sole masked-IRQ vCPU owns queue i (0..4), len fits its pinned buffer, and
    // any prior device use has completed. Publication follows descriptor initialization.
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
/// # Safety
/// Queue i is a TX queue (1 or 3) exclusively owned by this masked-IRQ context. Each pinned
/// buffer is reused only after the device publishes completion.
unsafe fn send(i: usize, bytes: &[u8]) {
    // SAFETY: Queue i is a TX queue (1 or 3) exclusively owned by this masked-IRQ context.
    // Each pinned buffer is reused only after the device publishes completion.
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
/// # Safety
/// The initialized control TX queue is exclusively owned by this masked-IRQ context; send waits
/// for device completion before returning.
unsafe fn control(event: u16) {
    // SAFETY: The initialized control TX queue is exclusively owned by this masked-IRQ
    // context; send waits for device completion before returning.
    unsafe {
        let b = [0, 0, 0, 0, event as u8, 0, 1, 0];
        send(3, &b);
    }
}
static mut USER_LINE_START: bool = true;
/// # Safety
/// Console initialization is complete and the sole masked-IRQ context owns TX and line-boundary
/// state; b stays readable through synchronous send.
pub unsafe fn user_write(b: &[u8]) {
    // SAFETY: Console initialization is complete and the sole masked-IRQ context owns TX and
    // line-boundary state; b stays readable through synchronous send.
    unsafe {
        write(b);
        if let Some(&last) = b.last() {
            USER_LINE_START = last == 10;
            if USER_LINE_START {
                record(&[]);
            }
        }
    }
}
// Dev traces wait for a complete EL0 line; never splice records into that line.
static mut RECORDS: [u8; 16384] = [0; 16384];
static mut RECORD_LEN: usize = 0;
/// # Safety
/// Only this masked-IRQ context accesses the trace buffer. Checked bounds precede writes; write
/// does not reenter record or retain a buffer reference.
pub unsafe fn record(b: &[u8]) {
    // SAFETY: Only this masked-IRQ context accesses the trace buffer. Checked bounds precede
    // writes; write does not reenter record or retain a buffer reference.
    unsafe {
        if USER_LINE_START {
            write(&RECORDS[..RECORD_LEN]);
            RECORD_LEN = 0;
            write(b);
        } else {
            if RECORD_LEN + b.len() > 16384 {
                crate::off();
            }
            RECORDS[RECORD_LEN..RECORD_LEN + b.len()].copy_from_slice(b);
            RECORD_LEN += b.len();
        }
    }
}
/// # Safety
/// The initialized TX queue and line-boundary state belong to this masked-IRQ context; write
/// completes before s can be released.
pub unsafe fn print(s: &str) {
    // SAFETY: The initialized TX queue and line-boundary state belong to this masked-IRQ
    // context; write completes before s can be released.
    unsafe {
        if s.starts_with("\x1e") && !USER_LINE_START {
            crate::off();
        }
        write(s.as_bytes());
    }
}
/// # Safety
/// The initialized console TX queue is exclusively owned by the sole masked-IRQ context; send
/// completes before b is released.
pub unsafe fn write(b: &[u8]) {
    // SAFETY: The initialized console TX queue is exclusively owned by the sole masked-IRQ
    // context; send completes before b is released.
    unsafe {
        send(1, b);
    }
}
/// # Safety
/// The initialized TX queue is exclusively owned by this masked-IRQ context; the stack buffer
/// remains live until synchronous write completes.
pub unsafe fn hex(n: usize) {
    // SAFETY: The initialized TX queue is exclusively owned by this masked-IRQ context; the
    // stack buffer remains live until synchronous write completes.
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
/// # Safety
/// Only the masked-IRQ vCPU touches RX/control cursors. Device publication is read with
/// volatile accesses and barriers; buffers are reposted after their last read.
pub unsafe fn service() {
    // SAFETY: Only the masked-IRQ vCPU touches RX/control cursors. Device publication is
    // read with volatile accesses and barriers; buffers are reposted after their last read.
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
/// # Safety
/// RX cursors are initialized and accessed only by this masked-IRQ context; no references into
/// RX state escape.
pub unsafe fn available() -> bool {
    // SAFETY: RX cursors are initialized and accessed only by this masked-IRQ context; no
    // references into RX state escape.
    unsafe { RX_POS < RX_LEN }
}
pub unsafe fn eof() -> bool {
    // SAFETY: RX/EOF state is initialized and accessed only by this masked-IRQ context; no
    // references escape.
    unsafe { EOF && RX_POS == RX_LEN }
}
/// # Safety
/// The sole masked-IRQ context owns RX state; service establishes completed DMA before copying,
/// and dst is disjoint from the pinned queue buffers.
pub unsafe fn read(dst: &mut [u8]) -> usize {
    // SAFETY: The sole masked-IRQ context owns RX state; service establishes completed DMA
    // before copying, and dst is disjoint from the pinned queue buffers.
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

//! The virtio-mmio (version 2) console device that `hvf console` offers the
//! console kernel profile: MULTIPORT with one port, the subset
//! kernel/src/console.rs drives. Receive/transmit queues 0/1, control queues
//! 2/3 (DEVICE_READY -> DEVICE_ADD). Every queue is serviced synchronously at
//! the guest's QueueNotify store, so a transmit is complete when the vCPU
//! resumes.
//!
//! Platform-neutral: guest RAM is a byte slice at a guest-physical base and
//! the host side is a [`Port`], so the descriptor walk is unit-tested and
//! fuzzed on any host (`fuzz::virtio_console`). Everything in guest RAM, and
//! every register value, is guest-controlled: a malformed queue is an error
//! (the runner stops the VM), never a panic, an out-of-RAM access or
//! unbounded host work.
use std::{
    collections::VecDeque,
    io::{self, ErrorKind, Read, Write},
    sync::atomic::{Ordering, fence},
    time::Duration,
};

/// Largest queue size the device offers (QueueNumMax).
pub const QUEUE_MAX: u32 = 256;
/// Host input moved into one receive buffer at most.
const INPUT_CHUNK: usize = 1 << 16;
/// Control messages the guest has not given a receive buffer for. A driver
/// answers each DEVICE_ADD before it can send the next DEVICE_READY, so more
/// is a guest that never posts control receive buffers.
const CONTROL_BACKLOG: usize = QUEUE_MAX as usize;
const RX: usize = 0;
const TX: usize = 1;
const CONTROL_RX: usize = 2;
const CONTROL_TX: usize = 3;
const VIRTQ_DESC_F_NEXT: u16 = 1;
const VIRTQ_DESC_F_WRITE: u16 = 2;
const VIRTQ_DESC_F_INDIRECT: u16 = 4;
/// virtio_console_control events.
const DEVICE_READY: u16 = 0;
const DEVICE_ADD: u16 = 1;

/// The host end of the console port.
pub trait Port: Read + Write {
    /// Wait at most `wait` (None: without limit) for input or its end; true
    /// when a `read` would not block.
    fn readable(&mut self, wait: Option<Duration>) -> bool;
}

fn err(m: impl Into<String>) -> io::Error {
    io::Error::other(m.into())
}

/// `len` bytes of `ram` (mapped at guest-physical `base`) at guest-physical
/// `gpa + off`.
fn range(ram: &mut [u8], base: u64, gpa: u64, off: u64, len: usize) -> io::Result<&mut [u8]> {
    gpa.checked_add(off)
        .and_then(|a| a.checked_sub(base))
        .and_then(|o| usize::try_from(o).ok())
        .and_then(|s| ram.get_mut(s..s.checked_add(len)?))
        .ok_or_else(|| err(format!("guest range {gpa:#x}+{off:#x}+{len} outside RAM")))
}

#[derive(Default, Clone, Copy, Debug)]
struct Queue {
    num: u32,
    ready: bool,
    desc: u64,
    avail: u64,
    used: u64,
    last_avail: u16,
    used_idx: u16,
}
impl Queue {
    fn live(&self) -> bool {
        self.ready && self.num > 0
    }
    /// Ring position of a free-running index (num is 1..=QUEUE_MAX).
    fn slot(&self, idx: u16) -> u64 {
        u64::from(idx % self.num as u16)
    }
}

/// One descriptor of a chain: guest address, length, device-writable.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Segment {
    addr: u64,
    len: u32,
    writable: bool,
}

/// The device over guest RAM `ram` (mapped at guest-physical `base`) and a
/// host `port`.
pub struct Console<M, P> {
    ram: M,
    base: u64,
    port: P,
    status: u32,
    device_sel: u32,
    queue_sel: usize,
    queues: [Queue; 4],
    /// Control messages for the guest, waiting for a control receive buffer.
    control: VecDeque<[u8; 8]>,
    input_eof: bool,
    /// A receive buffer was used since the last `interrupt`.
    wake: bool,
}
impl<M: AsMut<[u8]>, P: Port> Console<M, P> {
    pub fn new(ram: M, base: u64, port: P) -> Self {
        Self {
            ram,
            base,
            port,
            status: 0,
            device_sel: 0,
            queue_sel: 0,
            queues: Default::default(),
            control: VecDeque::new(),
            input_eof: false,
            wake: false,
        }
    }
    pub fn port(&mut self) -> &mut P {
        &mut self.port
    }

    fn at(&mut self, gpa: u64, off: u64, len: usize) -> io::Result<&mut [u8]> {
        range(self.ram.as_mut(), self.base, gpa, off, len)
    }
    fn load<const N: usize>(&mut self, gpa: u64, off: u64) -> io::Result<[u8; N]> {
        Ok(self.at(gpa, off, N)?.try_into().unwrap())
    }
    fn store(&mut self, gpa: u64, off: u64, bytes: &[u8]) -> io::Result<()> {
        self.at(gpa, off, bytes.len())?.copy_from_slice(bytes);
        Ok(())
    }
    fn avail_idx(&mut self, qi: usize) -> io::Result<u16> {
        let q = self.queues[qi];
        Ok(u16::from_le_bytes(self.load(q.avail, 2)?))
    }
    fn pending(&mut self, qi: usize) -> io::Result<bool> {
        Ok(self.queues[qi].live() && self.avail_idx(qi)? != self.queues[qi].last_avail)
    }
    /// The next available chain of a pending queue, without consuming it:
    /// its head and segments. At most `num` descriptors, each in the table.
    fn chain(&mut self, qi: usize) -> io::Result<(u16, Vec<Segment>)> {
        let q = self.queues[qi];
        let head = u16::from_le_bytes(self.load(q.avail, 4 + 2 * q.slot(q.last_avail))?);
        let (mut id, mut segs) = (head, Vec::new());
        for _ in 0..q.num {
            if u32::from(id) >= q.num {
                return Err(err(format!("queue {qi}: descriptor {id} out of range")));
            }
            let d: [u8; 16] = self.load(q.desc, 16 * u64::from(id))?;
            let flags = u16::from_le_bytes([d[12], d[13]]);
            if flags & VIRTQ_DESC_F_INDIRECT != 0 {
                return Err(err(format!(
                    "queue {qi}: indirect descriptor not negotiated"
                )));
            }
            segs.push(Segment {
                addr: u64::from_le_bytes(d[..8].try_into().unwrap()),
                len: u32::from_le_bytes(d[8..12].try_into().unwrap()),
                writable: flags & VIRTQ_DESC_F_WRITE != 0,
            });
            if flags & VIRTQ_DESC_F_NEXT == 0 {
                return Ok((head, segs));
            }
            id = u16::from_le_bytes([d[14], d[15]]);
        }
        Err(err(format!("queue {qi}: descriptor chain loops")))
    }
    /// Consume the next available chain of a pending queue.
    fn pop(&mut self, qi: usize) -> io::Result<(u16, Vec<Segment>)> {
        let chain = self.chain(qi)?;
        let q = &mut self.queues[qi];
        q.last_avail = q.last_avail.wrapping_add(1);
        Ok(chain)
    }
    /// Return chain `head` to the guest with `len` bytes written.
    fn push(&mut self, qi: usize, head: u16, len: u32) -> io::Result<()> {
        let q = self.queues[qi];
        let entry = 4 + 8 * q.slot(q.used_idx);
        let mut element = [0; 8];
        element[..4].copy_from_slice(&u32::from(head).to_le_bytes());
        element[4..].copy_from_slice(&len.to_le_bytes());
        self.store(q.used, entry, &element)?;
        // The element is visible before the index that publishes it.
        fence(Ordering::SeqCst);
        let idx = q.used_idx.wrapping_add(1);
        self.store(q.used, 2, &idx.to_le_bytes())?;
        self.queues[qi].used_idx = idx;
        // A receive or control-receive buffer is what an interrupt would
        // announce (`interrupt`).
        self.wake |= qi == RX || qi == CONTROL_RX;
        Ok(())
    }
    fn notify(&mut self, qi: usize) -> io::Result<()> {
        match qi {
            RX => self.pump(Some(Duration::ZERO)).map(|_| ()),
            TX => {
                while self.pending(TX)? {
                    let (head, segs) = self.pop(TX)?;
                    for s in segs.into_iter().filter(|s| !s.writable) {
                        let bytes = range(self.ram.as_mut(), self.base, s.addr, 0, s.len as usize)?;
                        self.port.write_all(bytes)?;
                    }
                    self.push(TX, head, 0)?;
                }
                self.port.flush()
            }
            CONTROL_RX => self.deliver_control(),
            CONTROL_TX => {
                while self.pending(CONTROL_TX)? {
                    let (head, segs) = self.pop(CONTROL_TX)?;
                    // One virtio_console_control per buffer: id u32, event
                    // u16, value u16.
                    if let Some(s) = segs.iter().find(|s| !s.writable && s.len >= 8) {
                        let event = u16::from_le_bytes(self.load(s.addr, 4)?);
                        if event == DEVICE_READY {
                            if self.control.len() >= CONTROL_BACKLOG {
                                return Err(err("control messages without receive buffers"));
                            }
                            let mut add = [0; 8];
                            add[4..6].copy_from_slice(&DEVICE_ADD.to_le_bytes());
                            add[6..].copy_from_slice(&1u16.to_le_bytes());
                            self.control.push_back(add);
                        }
                    }
                    self.push(CONTROL_TX, head, 0)?;
                }
                self.deliver_control()
            }
            _ => Ok(()),
        }
    }
    fn deliver_control(&mut self) -> io::Result<()> {
        while !self.control.is_empty() && self.pending(CONTROL_RX)? {
            let (head, segs) = self.pop(CONTROL_RX)?;
            let s = *segs
                .iter()
                .find(|s| s.writable && s.len >= 8)
                .ok_or_else(|| err("control buffer too small"))?;
            let msg = self.control.pop_front().expect("non-empty");
            self.store(s.addr, 0, &msg)?;
            self.push(CONTROL_RX, head, 8)?;
        }
        Ok(())
    }
    /// Move host input into the next receive buffer, waiting at most `wait`
    /// (None: until input) when there is a buffer to fill. A zero-length used
    /// buffer is the end of input (kernel console.rs `service`). Whether a
    /// buffer was used.
    fn pump(&mut self, wait: Option<Duration>) -> io::Result<bool> {
        if self.input_eof || !self.pending(RX)? || !self.port.readable(wait) {
            return Ok(false);
        }
        let (head, segs) = self.chain(RX)?;
        let s = *segs
            .iter()
            .find(|s| s.writable && s.len > 0)
            .ok_or_else(|| err("receive buffer not writable"))?;
        let len = (s.len as usize).min(INPUT_CHUNK);
        self.at(s.addr, 0, len)?;
        let mut buf = vec![0u8; len];
        let n = match self.port.read(&mut buf) {
            Ok(n) => n.min(len),
            Err(e) if e.kind() == ErrorKind::Interrupted => return Ok(false),
            Err(_) => 0,
        };
        self.pop(RX)?;
        if n == 0 {
            self.input_eof = true;
        } else {
            self.store(s.addr, 0, &buf[..n])?;
        }
        self.push(RX, head, n as u32)?;
        Ok(true)
    }
    /// What an interrupt would announce to a guest waiting in WFI: a receive
    /// buffer used since the last call, or input that fills one within
    /// `wait` (None: until input).
    pub fn interrupt(&mut self, wait: Option<Duration>) -> io::Result<bool> {
        Ok(std::mem::take(&mut self.wake) || self.pump(wait)?)
    }
    /// A 32-bit register load at `off` in the device's MMIO page.
    pub fn read(&mut self, off: u64) -> io::Result<u32> {
        let q = self.queues[self.queue_sel];
        Ok(match off {
            0x00 => 0x7472_6976, // "virt"
            0x04 => 2,           // version
            0x08 => 3,           // console
            0x0c => 0x554d_4551, // vendor "QEMU"
            // MULTIPORT; VERSION_1.
            0x10 => [1 << 1, 1]
                .get(self.device_sel as usize)
                .copied()
                .unwrap_or(0),
            0x34 => QUEUE_MAX,
            0x44 => u32::from(q.ready),
            0x60 => {
                // The guest's console service: input it can pick up now.
                self.pump(Some(Duration::ZERO))?;
                0
            }
            0x70 => self.status,
            // virtio_console_config.max_nr_ports.
            0x104 => 1,
            _ => 0,
        })
    }
    /// A 32-bit register store of `v` at `off` in the device's MMIO page.
    pub fn write(&mut self, off: u64, v: u32) -> io::Result<()> {
        let q = &mut self.queues[self.queue_sel];
        let lo = |a: &mut u64| *a = (*a & !0xffff_ffff) | u64::from(v);
        let hi = |a: &mut u64| *a = (*a & 0xffff_ffff) | u64::from(v) << 32;
        match off {
            0x14 => self.device_sel = v,
            0x30 if v < 4 => self.queue_sel = v as usize,
            0x30 => return Err(err(format!("queue {v} does not exist"))),
            0x38 if (1..=QUEUE_MAX).contains(&v) => q.num = v,
            0x44 => q.ready = v == 1,
            0x50 => return self.notify(v as usize),
            0x70 if v == 0 => {
                self.status = 0;
                self.queues = Default::default();
            }
            0x70 => self.status = v,
            0x80 => lo(&mut q.desc),
            0x84 => hi(&mut q.desc),
            0x90 => lo(&mut q.avail),
            0x94 => hi(&mut q.avail),
            0xa0 => lo(&mut q.used),
            0xa4 => hi(&mut q.used),
            // Feature selection and acknowledgements need no state.
            _ => {}
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    pub const BASE: u64 = 0x8000_0000;
    pub const RAM_BYTES: usize = 1 << 16;

    /// The host end: queued input chunks (an empty chunk is the end of
    /// input), captured output.
    #[derive(Default)]
    pub struct TestPort {
        pub input: VecDeque<Vec<u8>>,
        pub output: Vec<u8>,
        /// The next read fails with EINTR.
        pub interrupt: bool,
    }
    impl Read for TestPort {
        fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
            if std::mem::take(&mut self.interrupt) {
                return Err(ErrorKind::Interrupted.into());
            }
            let Some(mut chunk) = self.input.pop_front() else {
                return Ok(0);
            };
            let n = chunk.len().min(buf.len());
            buf[..n].copy_from_slice(&chunk[..n]);
            if n < chunk.len() {
                self.input.push_front(chunk.split_off(n));
            }
            Ok(n)
        }
    }
    impl Write for TestPort {
        fn write(&mut self, b: &[u8]) -> io::Result<usize> {
            self.output.write(b)
        }
        fn flush(&mut self) -> io::Result<()> {
            Ok(())
        }
    }
    impl Port for TestPort {
        fn readable(&mut self, _: Option<Duration>) -> bool {
            !self.input.is_empty()
        }
    }

    pub type Device = Console<Vec<u8>, TestPort>;

    /// A guest driver laid out like kernel/src/console.rs: per queue a page
    /// at `queue_gpa(i)` holding the descriptor table, the available ring at
    /// +0x100, the used ring at +0x200, and buffers from +0x400.
    pub struct Driver {
        pub dev: Device,
        posted: [u16; 4],
    }
    pub const N: u32 = 8;
    pub fn queue_gpa(i: usize) -> u64 {
        BASE + 0x1000 * (i as u64 + 1)
    }
    pub fn buffer_gpa(i: usize, id: u16) -> u64 {
        queue_gpa(i) + 0x400 + 0x100 * u64::from(id)
    }
    impl Driver {
        /// Reset, features, and the four queues set up and ready.
        pub fn new() -> Self {
            let mut d = Self {
                dev: Console::new(vec![0; RAM_BYTES], BASE, TestPort::default()),
                posted: [0; 4],
            };
            for (off, v) in [(0x70, 0), (0x70, 1), (0x70, 3), (0x70, 11)] {
                d.mmio(off, v);
            }
            for i in 0..4 {
                let q = queue_gpa(i);
                d.mmio(0x30, i as u32);
                d.mmio(0x38, N);
                for (off, gpa) in [(0x80, q), (0x90, q + 0x100), (0xa0, q + 0x200)] {
                    d.mmio(off, gpa as u32);
                    d.mmio(off + 4, (gpa >> 32) as u32);
                }
                d.mmio(0x44, 1);
            }
            d.mmio(0x70, 15);
            d
        }
        pub fn mmio(&mut self, off: u64, v: u32) {
            self.dev.write(off, v).unwrap();
        }
        pub fn poke(&mut self, gpa: u64, bytes: &[u8]) {
            self.dev.store(gpa, 0, bytes).unwrap();
        }
        pub fn peek(&mut self, gpa: u64, n: usize) -> Vec<u8> {
            self.dev.at(gpa, 0, n).unwrap().to_vec()
        }
        /// Descriptor `id` of queue `i`.
        pub fn desc(&mut self, i: usize, id: u16, addr: u64, len: u32, flags: u16, next: u16) {
            let mut d = [0; 16];
            d[..8].copy_from_slice(&addr.to_le_bytes());
            d[8..12].copy_from_slice(&len.to_le_bytes());
            d[12..14].copy_from_slice(&flags.to_le_bytes());
            d[14..].copy_from_slice(&next.to_le_bytes());
            self.poke(queue_gpa(i) + 16 * u64::from(id), &d);
        }
        /// Make chain `head` available on queue `i` (no notify).
        pub fn offer(&mut self, i: usize, head: u16) {
            let idx = self.posted[i];
            self.poke(
                queue_gpa(i) + 0x104 + 2 * u64::from(idx % N as u16),
                &head.to_le_bytes(),
            );
            self.posted[i] = idx.wrapping_add(1);
            self.poke(queue_gpa(i) + 0x102, &self.posted[i].to_le_bytes());
        }
        /// Queue `i`'s used index and its used elements (id, len) so far.
        pub fn used(&mut self, i: usize) -> (u16, Vec<(u32, u32)>) {
            let idx = u16::from_le_bytes(self.peek(queue_gpa(i) + 0x202, 2).try_into().unwrap());
            let elements = (0..idx.min(N as u16))
                .map(|k| {
                    let e = self.peek(queue_gpa(i) + 0x204 + 8 * u64::from(k), 8);
                    (
                        u32::from_le_bytes(e[..4].try_into().unwrap()),
                        u32::from_le_bytes(e[4..].try_into().unwrap()),
                    )
                })
                .collect();
            (idx, elements)
        }
        /// Post a one-descriptor buffer `id` of `len` bytes on queue `i`.
        pub fn post(&mut self, i: usize, id: u16, len: u32, writable: bool) -> u64 {
            let gpa = buffer_gpa(i, id);
            let flags = if writable { VIRTQ_DESC_F_WRITE } else { 0 };
            self.desc(i, id, gpa, len, flags, 0);
            self.offer(i, id);
            gpa
        }
        /// Transmit `bytes` on queue `i` (TX or control TX) as buffer 0.
        pub fn send(&mut self, i: usize, bytes: &[u8]) -> io::Result<()> {
            let gpa = buffer_gpa(i, 0);
            self.poke(gpa, bytes);
            self.desc(i, 0, gpa, bytes.len() as u32, 0, 0);
            self.offer(i, 0);
            self.dev.write(0x50, i as u32)
        }
        /// The kernel's start: control receive buffers, one receive buffer,
        /// DEVICE_READY; the device answers DEVICE_ADD.
        pub fn handshake(&mut self) {
            for id in 0..N as u16 {
                self.post(CONTROL_RX, id, 256, true);
            }
            self.post(RX, 0, 1024, true);
            self.send(CONTROL_TX, &[0, 0, 0, 0, 0, 0, 1, 0]).unwrap();
        }
    }

    #[test]
    fn identity_and_features() {
        let mut d = Driver::new();
        let r = |d: &mut Driver, off| d.dev.read(off).unwrap();
        assert_eq!(
            [r(&mut d, 0), r(&mut d, 4), r(&mut d, 8), r(&mut d, 0x34)],
            [0x7472_6976, 2, 3, QUEUE_MAX]
        );
        for (sel, features) in [(0, 2), (1, 1), (2, 0), (u32::MAX, 0)] {
            d.mmio(0x14, sel);
            assert_eq!(r(&mut d, 0x10), features, "feature word {sel}");
        }
        assert_eq!((r(&mut d, 0x70), r(&mut d, 0x104)), (15, 1));
    }

    #[test]
    fn handshake_answers_device_ready_with_device_add() {
        let mut d = Driver::new();
        d.handshake();
        assert_eq!(d.used(CONTROL_TX), (1, vec![(0, 0)]));
        assert_eq!(d.used(CONTROL_RX), (1, vec![(0, 8)]));
        assert_eq!(
            d.peek(buffer_gpa(CONTROL_RX, 0), 8),
            [0, 0, 0, 0, 1, 0, 1, 0]
        );
        // PORT_READY and PORT_OPEN need no answer.
        d.send(CONTROL_TX, &[0, 0, 0, 0, 3, 0, 1, 0]).unwrap();
        assert_eq!(d.used(CONTROL_RX).0, 1);
    }

    #[test]
    fn device_add_waits_for_a_control_receive_buffer() {
        let mut d = Driver::new();
        d.send(CONTROL_TX, &[0, 0, 0, 0, 0, 0, 1, 0]).unwrap();
        assert_eq!(d.used(CONTROL_RX).0, 0);
        d.post(CONTROL_RX, 0, 256, true);
        d.mmio(0x50, CONTROL_RX as u32);
        assert_eq!(d.used(CONTROL_RX), (1, vec![(0, 8)]));
    }

    #[test]
    fn transmit_writes_readable_segments_in_chain_order() {
        let mut d = Driver::new();
        let (a, b, c) = (buffer_gpa(TX, 0), buffer_gpa(TX, 1), buffer_gpa(TX, 2));
        d.poke(a, b"hel");
        d.poke(b, b"XXXX");
        d.poke(c, b"lo\n");
        d.desc(TX, 3, a, 3, VIRTQ_DESC_F_NEXT, 5);
        d.desc(TX, 5, b, 4, VIRTQ_DESC_F_NEXT | VIRTQ_DESC_F_WRITE, 1);
        d.desc(TX, 1, c, 3, 0, 0);
        d.offer(TX, 3);
        d.mmio(0x50, TX as u32);
        assert_eq!(d.dev.port().output, b"hello\n");
        assert_eq!(d.used(TX), (1, vec![(3, 0)]));
        // Nothing new is available: a second notify writes nothing.
        d.mmio(0x50, TX as u32);
        assert_eq!(d.dev.port().output, b"hello\n");
    }

    #[test]
    fn receive_fills_buffers_then_reports_the_end_of_input() {
        let mut d = Driver::new();
        d.dev.port().input = VecDeque::from([b"abc".to_vec(), Vec::new()]);
        let gpa = d.post(RX, 0, 2, true);
        d.mmio(0x50, RX as u32);
        assert_eq!(d.used(RX), (1, vec![(0, 2)]));
        assert_eq!(d.peek(gpa, 2), b"ab");
        assert!(
            d.dev.interrupt(Some(Duration::ZERO)).unwrap(),
            "used buffer"
        );
        // Input the buffer could not take stays for the next one, which a
        // waiting guest gets as an interrupt.
        d.post(RX, 1, 16, true);
        assert!(d.dev.interrupt(Some(Duration::ZERO)).unwrap(), "input");
        assert_eq!(d.used(RX).1[1], (1, 1));
        assert_eq!(d.peek(buffer_gpa(RX, 1), 1), b"c");
        // The end of input is a zero-length used buffer, then nothing more.
        d.post(RX, 2, 16, true);
        assert_eq!(d.dev.read(0x60).unwrap(), 0);
        assert_eq!(d.used(RX).1[2], (2, 0));
        d.dev.port().input.push_back(b"late".to_vec());
        d.post(RX, 3, 16, true);
        d.mmio(0x50, RX as u32);
        assert_eq!(d.used(RX).0, 3);
    }

    #[test]
    fn interrupted_input_leaves_the_buffer_posted() {
        let mut d = Driver::new();
        d.dev.port().input.push_back(b"x".to_vec());
        d.dev.port().interrupt = true;
        d.post(RX, 0, 8, true);
        assert!(!d.dev.interrupt(Some(Duration::ZERO)).unwrap());
        assert_eq!(d.used(RX).0, 0);
        assert!(d.dev.interrupt(Some(Duration::ZERO)).unwrap());
        assert_eq!(d.used(RX), (1, vec![(0, 1)]));
    }

    #[test]
    fn a_used_receive_buffer_wakes_one_wait() {
        let mut d = Driver::new();
        d.handshake();
        assert!(d.dev.interrupt(Some(Duration::ZERO)).unwrap(), "DEVICE_ADD");
        assert!(!d.dev.interrupt(Some(Duration::ZERO)).unwrap());
    }

    fn fails(d: &mut Driver, qi: usize, what: &str) {
        let e = d.dev.write(0x50, qi as u32).unwrap_err().to_string();
        assert!(e.contains(what), "{e:?} does not say {what:?}");
    }

    #[test]
    fn hostile_chains_are_errors() {
        // A head outside the descriptor table.
        let mut d = Driver::new();
        d.offer(TX, N as u16);
        fails(&mut d, TX, "descriptor 8 out of range");
        // A next index outside the table.
        let mut d = Driver::new();
        d.desc(TX, 0, buffer_gpa(TX, 0), 1, VIRTQ_DESC_F_NEXT, 9);
        d.offer(TX, 0);
        fails(&mut d, TX, "descriptor 9 out of range");
        // A chain that loops (0 -> 1 -> 0) ends after num descriptors.
        let mut d = Driver::new();
        d.desc(TX, 0, buffer_gpa(TX, 0), 1, VIRTQ_DESC_F_NEXT, 1);
        d.desc(TX, 1, buffer_gpa(TX, 1), 1, VIRTQ_DESC_F_NEXT, 0);
        d.offer(TX, 0);
        fails(&mut d, TX, "loops");
        assert!(
            d.dev.port().output.is_empty(),
            "no partial write of a bad chain"
        );
        // Indirect descriptors were not negotiated.
        let mut d = Driver::new();
        d.desc(TX, 0, buffer_gpa(TX, 0), 16, VIRTQ_DESC_F_INDIRECT, 0);
        d.offer(TX, 0);
        fails(&mut d, TX, "indirect");
    }

    #[test]
    fn addresses_outside_ram_are_errors() {
        let end = BASE + RAM_BYTES as u64;
        for (addr, len) in [
            (BASE - 1, 2),
            (end - 1, 2),
            (BASE, u32::MAX),
            (u64::MAX, 1),
            (0, 1),
        ] {
            let mut d = Driver::new();
            d.desc(TX, 0, addr, len, 0, 0);
            d.offer(TX, 0);
            fails(&mut d, TX, "outside RAM");
        }
        // Ring addresses that overflow when indexed.
        for reg in [0x80, 0x90, 0xa0] {
            let mut d = Driver::new();
            d.post(TX, 0, 1, false);
            d.mmio(0x30, TX as u32);
            d.mmio(reg, u32::MAX);
            d.mmio(reg + 4, u32::MAX);
            fails(&mut d, TX, "outside RAM");
        }
    }

    #[test]
    fn unusable_receive_buffers_are_errors() {
        for (len, writable) in [(16, false), (0, true)] {
            let mut d = Driver::new();
            d.dev.port().input.push_back(b"x".to_vec());
            d.post(RX, 0, len, writable);
            fails(&mut d, RX, "receive buffer not writable");
            assert_eq!(d.dev.port().input.len(), 1, "input not consumed");
        }
        let mut d = Driver::new();
        d.dev.port().input.push_back(b"x".to_vec());
        d.desc(
            RX,
            0,
            BASE + RAM_BYTES as u64 - 1,
            16,
            VIRTQ_DESC_F_WRITE,
            0,
        );
        d.offer(RX, 0);
        fails(&mut d, RX, "outside RAM");
        assert_eq!(d.dev.port().input.len(), 1, "input not consumed");
        // A control receive buffer too small for a message.
        let mut d = Driver::new();
        d.post(CONTROL_RX, 0, 4, true);
        assert!(
            d.send(CONTROL_TX, &[0; 8])
                .unwrap_err()
                .to_string()
                .contains("control buffer too small")
        );
    }

    #[test]
    fn device_ready_floods_are_bounded() {
        // A guest that never posts control receive buffers but keeps
        // offering DEVICE_READY, each buffer holding many messages: one
        // answer per buffer, and the backlog is bounded.
        let mut d = Driver::new();
        let gpa = buffer_gpa(CONTROL_TX, 0);
        d.poke(gpa, &[0; 0x400]);
        d.desc(CONTROL_TX, 0, gpa, 0x400, 0, 0);
        let mut e = None;
        for _ in 0..=CONTROL_BACKLOG {
            d.offer(CONTROL_TX, 0);
            if let Err(x) = d.dev.write(0x50, CONTROL_TX as u32) {
                e = Some(x.to_string());
                break;
            }
        }
        assert_eq!(
            e.as_deref(),
            Some("control messages without receive buffers")
        );
        assert_eq!(d.dev.control.len(), CONTROL_BACKLOG);
    }

    #[test]
    fn registers_reject_bad_queues_and_reset_clears_them() {
        let mut d = Driver::new();
        assert!(d.dev.write(0x30, 4).is_err());
        d.mmio(0x30, TX as u32);
        for bad in [0, QUEUE_MAX + 1] {
            d.mmio(0x38, bad);
            assert_eq!(d.dev.queues[TX].num, N, "QueueNum {bad} ignored");
        }
        assert_eq!(d.dev.read(0x44).unwrap(), 1);
        d.mmio(0x70, 0);
        assert_eq!(d.dev.read(0x44).unwrap(), 0);
        assert_eq!(d.dev.read(0x70).unwrap(), 0);
        // A queue that is not live is never walked.
        d.offer(TX, N as u16);
        d.mmio(0x50, TX as u32);
        // Notifying a queue that does not exist does nothing.
        d.mmio(0x50, 7);
    }
}

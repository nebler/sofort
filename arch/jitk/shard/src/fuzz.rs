//! Fuzz harnesses for the shard's parsers of untrusted bytes: the guest's TX
//! ring (JS profile, `Slot::decode_exit`, and native, `streams::Receiver`),
//! the console kernel's virtio queues (`virtio_console`), IPC records from
//! an engine process or Node (`service`), and native requests, whose files
//! are tenant data (`inputs`).
//!
//! Each harness reads its input as a small program of guest (or peer)
//! actions, drives the decoder the way its engine does, and panics only when
//! an invariant breaks. A decoder error ends the program, as it ends the run.
//! libFuzzer drives them from `fuzz/` (`make fuzz-smoke`, `make fuzz`);
//! `cargo test` replays every seed and every regression input. Seeds are
//! generated (`seeds`, written by `fuzz-seeds`) from the shared hostile
//! corpus `abi/guest-payloads.json` and the decoders' unit-test vectors.
use crate::constants::{ipc as wire, ring};
use crate::hv::{ArchState, Exit, Memory, Vcpu, Vm};
use crate::service::{self, Assembler, Message, Phase, State};
use crate::slot::{REQUEST, Request, ResetReport, Slot, Step};
use crate::virtio_console::{Console, Port, TX_NOTIFY_BYTES};
use crate::{inputs, payload, streams};
use std::{
    collections::VecDeque,
    fs::File,
    io::{self, ErrorKind, Read, Write},
    sync::OnceLock,
    time::Duration,
};

/// A harness: arbitrary bytes in, the number of events its decoder accepted
/// out (calls, messages, records, completions).
pub type Harness = fn(&[u8]) -> usize;
/// Every harness by target name (the binaries in `fuzz/fuzz_targets`).
pub const TARGETS: [(&str, Harness); 5] = [
    ("ring_tx", ring_tx),
    ("native_tx", native_tx),
    ("virtio_console", virtio_console),
    ("ipc_records", ipc_records),
    ("native_request", native_request),
];

/// The input as a stream of little-endian fields; None once it runs out.
struct Input<'a>(&'a [u8]);
impl<'a> Input<'a> {
    fn bytes(&mut self, n: usize) -> &'a [u8] {
        let (b, rest) = self.0.split_at(n.min(self.0.len()));
        self.0 = rest;
        b
    }
    fn array<const N: usize>(&mut self) -> Option<[u8; N]> {
        self.bytes(N).try_into().ok()
    }
    fn u8(&mut self) -> Option<u8> {
        self.array::<1>().map(|[b]| b)
    }
    fn u16(&mut self) -> Option<u16> {
        self.array().map(u16::from_le_bytes)
    }
    fn u32(&mut self) -> Option<u32> {
        self.array().map(u32::from_le_bytes)
    }
    fn u64(&mut self) -> Option<u64> {
        self.array().map(u64::from_le_bytes)
    }
}
/// Builds harness inputs (seeds, regressions) field by field.
#[derive(Default)]
struct Program(Vec<u8>);
impl Program {
    fn op(mut self, tag: u8) -> Self {
        self.0.push(tag);
        self
    }
    fn u16(mut self, v: u16) -> Self {
        self.0.extend_from_slice(&v.to_le_bytes());
        self
    }
    fn u32(mut self, v: u32) -> Self {
        self.0.extend_from_slice(&v.to_le_bytes());
        self
    }
    fn u64(mut self, v: u64) -> Self {
        self.0.extend_from_slice(&v.to_le_bytes());
        self
    }
    fn bytes(mut self, b: &[u8]) -> Self {
        self.0.extend_from_slice(b);
        self
    }
    /// A u16 length, then the bytes.
    fn chunk(self, b: &[u8]) -> Self {
        self.u16(b.len() as u16).bytes(b)
    }
}

/// A record of the guest rings (shard/ABI-R7.md): header and zero-padded
/// payload.
fn record(kind: u16, flags: u16, generation: u64, id: u64, cap: u32, b: &[u8]) -> Vec<u8> {
    let len = ring::record_len(b.len());
    let h = ring::RecordHeader {
        len: len as u32,
        kind,
        flags,
        generation,
        id,
        n: b.len() as u32,
        cap,
    };
    let mut v = h.encode().to_vec();
    v.extend_from_slice(b);
    v.resize(len, 0);
    v
}

// --- ring_tx: the JS profile's TX ring (Slot::decode_exit, Slot::reply). ---

/// A VM that never runs: the decoder and the reply path touch only RAM.
struct Stopped;
struct NoRegisters;
impl ArchState for NoRegisters {
    fn decode(_: &[u8]) -> io::Result<Self> {
        Ok(Self)
    }
    fn encode(&self) -> Vec<u8> {
        Vec::new()
    }
}
impl Vcpu for Stopped {
    type State = NoRegisters;
    fn save(&self) -> io::Result<NoRegisters> {
        unreachable!("decoding never saves registers")
    }
    fn load(&mut self, _: &NoRegisters) -> io::Result<()> {
        unreachable!("decoding never loads registers")
    }
    fn reset(&mut self, _: &NoRegisters) -> io::Result<()> {
        unreachable!("decoding never resets")
    }
    fn mismatches(&self, _: &NoRegisters) -> Vec<u64> {
        Vec::new()
    }
    fn run(&mut self) -> io::Result<Exit> {
        unreachable!("the harness plays the guest")
    }
    fn set_entry(&mut self, _: u64) -> io::Result<()> {
        Ok(())
    }
    fn redirect(&mut self, _: u64, _: u64, _: u64) -> io::Result<()> {
        unreachable!("no fault probes")
    }
}
impl Vm for Stopped {
    type Vcpu = Stopped;
    unsafe fn map(&mut self, _: u64, _: *mut u8, _: usize, _: crate::hv::Region) -> io::Result<()> {
        Ok(())
    }
    fn vcpu(&mut self) -> io::Result<Stopped> {
        Ok(Stopped)
    }
    fn restore_memory(&mut self, _: &Memory<'_, NoRegisters>) -> io::Result<ResetReport> {
        unreachable!("decoding never resets")
    }
    fn discard_memory(&mut self, _: &Memory<'_, NoRegisters>) -> io::Result<()> {
        unreachable!("decoding never resets")
    }
}
/// A RAM-sized sparse file, unlinked, mapped privately by every slot.
fn ram_file() -> &'static File {
    static FILE: OnceLock<File> = OnceLock::new();
    FILE.get_or_init(|| {
        let path = std::env::temp_dir().join(format!("jitk-fuzz-ram-{}", std::process::id()));
        let f = File::options()
            .read(true)
            .write(true)
            .create_new(true)
            .open(&path)
            .expect("fuzz RAM file");
        std::fs::remove_file(&path).unwrap();
        f.set_len(ring::RAM_BYTES as u64).unwrap();
        f
    })
}

const GENERATION: u64 = 2;
/// ring_tx steps (tag byte modulo 5).
const TX_APPEND: u8 = 0; // u16 n, n bytes: the guest writes them at its TX producer and advances it
const TX_CURSOR: u8 = 1; // u64: the guest sets its TX producer
const TX_DOORBELL: u8 = 2; // u32 op: the guest rings the doorbell
const TX_REPLY: u8 = 3; // u16 n, n bytes: Node answers the oldest open call
const TX_READ_RX: u8 = 4; // u64: the guest sets its RX consumer (u64::MAX: all produced)

/// The guest's TX ring and doorbells, and Node's replies, on a slot whose
/// RX ring holds a run source (first byte: its length in KiB).
pub fn ring_tx(data: &[u8]) -> usize {
    let mut s = Slot::boot_on(Stopped, ram_file()).expect("fuzz slot");
    let mut input = Input(data);
    let source = "x".repeat((usize::from(input.u8().unwrap_or(0)) << 10).min(ring::SOURCE_LIMIT));
    s.bind(GENERATION, &source, &mut io::repeat(0));
    let mut open = VecDeque::new();
    let mut events = 0;
    while let Some(tag) = input.u8() {
        let ok = match tag % 5 {
            TX_APPEND => input.u16().map(|n| {
                let b = input.bytes(n.into());
                // The guest's cursor arithmetic wraps; every whole ring of
                // `b` starts at the same ring offset.
                let prod = s.load(ring::TX_PRODUCER);
                let at = (prod % ring::RING_BYTES as u64) as usize;
                for chunk in b.chunks(ring::RING_BYTES) {
                    let first = chunk.len().min(ring::RING_BYTES - at);
                    s.copy(REQUEST + at, &chunk[..first]);
                    s.copy(REQUEST, &chunk[first..]);
                }
                s.store(ring::TX_PRODUCER, prod.wrapping_add(b.len() as u64));
                true
            }),
            TX_CURSOR => input.u64().map(|p| {
                s.store(ring::TX_PRODUCER, p);
                true
            }),
            TX_DOORBELL => input.u32().map(|op| match s.decode_exit(op) {
                Ok(Some(step)) => {
                    let prod = s.load(ring::TX_PRODUCER);
                    events += accepted(&step, prod, s.load(ring::TX_CONSUMER), &mut open);
                    // The engine stops the guest at its completion.
                    op != ring::FINISH
                }
                Ok(None) => unreachable!("decode_exit always returns a step"),
                Err(_) => false,
            }),
            TX_REPLY => input.u16().map(|n| {
                let bytes = input.bytes(n.into()).to_vec();
                match open.pop_front() {
                    Some(id) => s.reply(&Request { id, bytes }).is_ok(),
                    None => true,
                }
            }),
            TX_READ_RX => input.u64().map(|c| {
                let c = if c == u64::MAX {
                    s.load(ring::RX_PRODUCER)
                } else {
                    c
                };
                s.store(ring::RX_CONSUMER, c);
                true
            }),
            _ => unreachable!(),
        };
        if ok != Some(true) {
            break;
        }
    }
    events
}
/// What a decoded step promises the shard: forwarded messages are bounded
/// printable ASCII, call ids are the next ones, a completion comes only with
/// FINISH and no open call, and TX is consumed up to the producer.
fn accepted(step: &Step, prod: u64, consumed: u64, open: &mut VecDeque<u64>) -> usize {
    assert_eq!(consumed, prod, "a decoded doorbell consumes all of TX");
    for r in &step.requests {
        assert!(payload::forwarded(ring::CALL, &r.bytes));
        assert!(open.back().is_none_or(|&last| r.id > last));
        open.push_back(r.id);
    }
    for l in &step.logs {
        assert!(payload::forwarded(ring::CONSOLE, l));
    }
    if let Some(done) = &step.finish {
        assert!(step.op == ring::FINISH && step.requests.is_empty());
        assert!(payload::forwarded(ring::DONE, done.as_bytes()));
    }
    step.requests.len() + step.logs.len() + usize::from(step.finish.is_some())
}

// --- native_tx: the native profile's TX ring (streams::Receiver). ---

/// native_tx steps (tag byte modulo 4); the first u32 is the output limit.
const NATIVE_APPEND: u8 = 0; // u16 n, n bytes at the producer
const NATIVE_CURSOR: u8 = 1; // u64: the producer
const NATIVE_DRAIN: u8 = 2; // the host drains to the producer
const NATIVE_FINISH: u8 = 3; // u32 op: the guest's doorbell

/// The native profile's TX ring: records drained at each doorbell, wrapping
/// in the fixed extent, then the doorbell that ends the run.
pub fn native_tx(data: &[u8]) -> usize {
    let mut input = Input(data);
    let limit = input.u32().unwrap_or(0) as usize % (streams::OUTPUT_LIMIT + 1);
    let mut r = streams::Receiver::new(GENERATION, limit).unwrap();
    let mut tx = vec![0u8; streams::RING_BYTES];
    let (mut produced, mut written, mut events) = (0u64, 0u64, 0);
    while let Some(tag) = input.u8() {
        let ok = match tag % 4 {
            NATIVE_APPEND => input.u16().map(|n| {
                for &b in input.bytes(n.into()) {
                    tx[(written % streams::RING_BYTES as u64) as usize] = b;
                    written += 1;
                }
                produced = written;
                true
            }),
            NATIVE_CURSOR => input.u64().map(|p| {
                produced = p;
                true
            }),
            NATIVE_DRAIN => {
                let start = r.consumed();
                Some(
                    r.drain(produced, |at, dst| {
                        // Only produced, unconsumed bytes, one record at most.
                        assert!(dst.len() <= streams::RECORD_BYTES);
                        assert!(at >= start && at + dst.len() as u64 <= produced);
                        for (i, d) in dst.iter_mut().enumerate() {
                            *d = tx[((at + i as u64) % streams::RING_BYTES as u64) as usize];
                        }
                    })
                    .is_ok(),
                )
            }
            NATIVE_FINISH => input.u32().map(|op| match r.finish(op) {
                Ok(Some(out)) => {
                    assert!(out.stdout.len() + out.stderr.len() <= limit);
                    assert!(out.exit_code <= 255);
                    events += 1;
                    false
                }
                Ok(None) => true,
                Err(_) => false,
            }),
            _ => unreachable!(),
        };
        events += usize::from(ok == Some(true) && tag % 4 == NATIVE_DRAIN);
        if ok != Some(true) {
            break;
        }
    }
    events
}

// --- virtio_console: the console kernel's virtqueues (virtio_console). ---

const CONSOLE_BASE: u64 = 0x8000_0000;
const CONSOLE_RAM: usize = 1 << 16;
/// virtio_console steps (tag byte modulo 5).
const MMIO_WRITE: u8 = 0; // u16 offset, u32 value
const MMIO_READ: u8 = 1; // u16 offset
const RAM_WRITE: u8 = 2; // u16 offset into RAM, u16 n, n bytes
const HOST_INPUT: u8 = 3; // u16 n, n bytes of host input (0: the end of input)
const WAIT: u8 = 4; // the guest waits in WFI

/// Host input as the fuzzer supplies it; reads stop at the end of what is
/// queued so far.
#[derive(Default)]
struct FuzzPort {
    input: VecDeque<Vec<u8>>,
    output: usize,
}
impl Read for FuzzPort {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        match self.input.pop_front() {
            None => Err(ErrorKind::WouldBlock.into()),
            Some(mut chunk) => {
                let n = chunk.len().min(buf.len());
                buf[..n].copy_from_slice(&chunk[..n]);
                if n < chunk.len() {
                    self.input.push_front(chunk.split_off(n));
                }
                Ok(n)
            }
        }
    }
}
impl Write for FuzzPort {
    fn write(&mut self, b: &[u8]) -> io::Result<usize> {
        self.output += b.len();
        Ok(b.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}
impl Port for FuzzPort {
    fn readable(&mut self, _: Option<Duration>) -> bool {
        !self.input.is_empty()
    }
}
/// MMIO accesses, guest RAM writes and host input against the console
/// device; every access stays in RAM (a slice) and every error is the VM's
/// end.
pub fn virtio_console(data: &[u8]) -> usize {
    run_console(data).1
}
type FuzzConsole = Console<Vec<u8>, FuzzPort>;
/// The device after `data`, and the steps it accepted.
fn run_console(data: &[u8]) -> (FuzzConsole, usize) {
    let mut dev = Console::new(vec![0u8; CONSOLE_RAM], CONSOLE_BASE, FuzzPort::default());
    let mut input = Input(data);
    let mut events = 0;
    while let Some(tag) = input.u8() {
        let ok = match tag % 5 {
            MMIO_WRITE => input.u16().zip(input.u32()).map(|(off, v)| {
                let before = dev.port().output;
                let ok = dev.write(u64::from(off & 0x1fc), v).is_ok();
                // One store (a QueueNotify) is bounded host work.
                assert!(dev.port().output - before <= TX_NOTIFY_BYTES);
                ok
            }),
            MMIO_READ => input
                .u16()
                .map(|off| dev.read(u64::from(off & 0x1fc)).is_ok()),
            RAM_WRITE => input.u16().zip(input.u16()).map(|(off, n)| {
                let b = input.bytes(n.into());
                let at = usize::from(off).min(CONSOLE_RAM - b.len().min(CONSOLE_RAM));
                let n = b.len().min(CONSOLE_RAM - at);
                dev.ram_mut()[at..at + n].copy_from_slice(&b[..n]);
                true
            }),
            HOST_INPUT => input.u16().map(|n| {
                dev.port().input.push_back(input.bytes(n.into()).to_vec());
                true
            }),
            WAIT => Some(dev.interrupt(Some(Duration::ZERO)).is_ok()),
            _ => unreachable!(),
        };
        if ok != Some(true) {
            break;
        }
        events += 1;
    }
    (dev, events)
}

// --- ipc_records: IPC records (service::Message, Assembler, State). ---

/// A stream of IPC records, as the HVF zygote reads them from an engine
/// process (or either peer from the other): decoded and reassembled; each
/// message drives one slot's state machine as the zygote and the Linux
/// reactor do.
pub fn ipc_records(data: &[u8]) -> usize {
    let (mut a, mut slot, mut rest, mut events) = (Assembler::default(), State::default(), data, 0);
    while rest.len() >= wire::HEADER_BYTES {
        let n = service::u32_at(rest, wire::LENGTH_AT) as usize;
        let Some(record) = rest.get(..wire::HEADER_BYTES + n.min(wire::PAYLOAD + 1)) else {
            break;
        };
        let Ok((m, more)) = Message::decode(record) else {
            break;
        };
        assert_eq!(m.bytes, record[wire::HEADER_BYTES..], "the whole payload");
        if !more {
            assert_eq!(m.encode().unwrap(), record, "a final record round trips");
        }
        rest = &rest[record.len()..];
        match a.push(m, more) {
            Ok(Some(m)) => {
                assert!(m.bytes.len() <= wire::MESSAGE_BYTES);
                events += usize::from(deliver(&mut slot, &m));
            }
            Ok(None) => {}
            Err(_) => break,
        }
    }
    events
}
/// One message's effect on its slot's state; whether it was accepted.
fn deliver(s: &mut State, m: &Message) -> bool {
    let charge = jitk_abi::arena::Class::Glue2m.admission_bytes();
    let accepted = match m.kind {
        service::START => s.start(m, 0, charge).map(|(_, source)| {
            assert!(source.len() <= ring::SOURCE_LIMIT);
            true
        }),
        service::CALL => s.call(m.id.into(), &m.bytes),
        service::LOG => s.log(&m.bytes),
        service::REPLY => s.reply(m, jitk_abi::arena::Class::Glue2m.reply_bytes()),
        service::CANCEL => s.cancel(m).map(|_| true),
        service::DONE | service::ERROR => s.complete(),
        service::RELEASED | service::QUARANTINED => {
            let why = (m.kind == service::QUARANTINED)
                .then(|| String::from_utf8_lossy(&m.bytes).into_owned());
            service::released(s, 0, why).map(|r| {
                // What Node is told: RELEASED, or a bounded printable reason.
                assert!(r.kind == service::RELEASED || s.phase == Phase::Quarantined);
                assert!(r.bytes.len() <= wire::ERROR_BYTES && payload::printable(&r.bytes));
                true
            })
        }
        _ => Ok(false),
    };
    accepted.unwrap_or(false)
}

// --- native_request: native worker requests (inputs::decode, serve). ---

/// A native request as one frame and as a frame stream: decoding either
/// yields a bounded run (argv, archive), and every response frame is
/// well-formed.
pub fn native_request(data: &[u8]) -> usize {
    let mut events = 0;
    if let Ok(run) = inputs::decode(data) {
        assert!((1..=ring::MAX_ARGS).contains(&run.args.len()));
        assert!(run.archive.len() <= inputs::MAX_ARCHIVE && run.archive.starts_with(b"JITKFS01"));
        events += 1;
    }
    let mut out = Vec::new();
    let _ = inputs::serve(&mut &data[..], &mut out, |run, generation| {
        assert!(generation > 1 && !run.tool.is_empty());
        Ok(streams::Output {
            stdout: run.args.concat().into_bytes(),
            stderr: Vec::new(),
            exit_code: 0,
            limited: false,
        })
    });
    let mut frames = Input(&out);
    while let Some(n) = frames.u32() {
        assert!(
            frames.bytes(n as usize).len() == n as usize,
            "a whole frame"
        );
        events += 1;
    }
    events
}

// --- Seeds and regression inputs. ---

/// Valid inputs that reach deep into each decoder: libFuzzer's starting
/// corpus (`fuzz-seeds`) and `cargo test`'s replay set.
pub fn seeds(target: &str) -> Vec<Vec<u8>> {
    match target {
        "ring_tx" => payload::corpus()
            .into_iter()
            .map(|row| ring_program(&row).0)
            .collect(),
        "native_tx" => native_seeds(),
        "virtio_console" => vec![console_program().0],
        "ipc_records" => ipc_seeds(),
        "native_request" => {
            let one = native_request_bytes(&["data/a", "data/b", "empty"]);
            let mut framed = (one.len() as u32).to_le_bytes().to_vec();
            framed.extend_from_slice(&one);
            framed.extend_from_slice(&framed.clone());
            vec![one, framed]
        }
        _ => panic!("unknown fuzz target {target}"),
    }
}
/// A JS run of one corpus row: a call answered and then completion, a
/// completion, or a console line then completion.
fn ring_program((kind, _, _, payload): &crate::payload::Row) -> Program {
    let message = |kind, id, cap, b: &[u8]| {
        let n = ring::records(b.len());
        (0..n)
            .flat_map(|i| {
                let part = &b[(i * ring::MAX_PAYLOAD).min(b.len())
                    ..((i + 1) * ring::MAX_PAYLOAD).min(b.len())];
                let more = if i + 1 < n { ring::MORE } else { 0 };
                record(kind, ring::JSON_UTF8 | more, GENERATION, id, cap, part)
            })
            .collect::<Vec<u8>>()
    };
    let done = message(ring::DONE, 0, 0, br#"{"ok":1}"#);
    let p = Program::default().op(1); // a 1 KiB source
    let p = match *kind {
        ring::CALL => p
            .op(TX_APPEND)
            .chunk(&message(ring::CALL, 1, ring::CALL_CAP, payload))
            .op(TX_DOORBELL)
            .u32(ring::SUBMIT)
            .op(TX_READ_RX)
            .u64(u64::MAX)
            .op(TX_REPLY)
            .chunk(br#"{"ok":2}"#),
        ring::CONSOLE => p
            .op(TX_APPEND)
            .chunk(&message(ring::CONSOLE, 0, 0, payload))
            .op(TX_DOORBELL)
            .u32(ring::SUBMIT),
        _ => p
            .op(TX_APPEND)
            .chunk(&message(ring::DONE, 0, 0, payload))
            .op(TX_DOORBELL)
            .u32(ring::FINISH),
    };
    p.op(TX_APPEND)
        .chunk(&done)
        .op(TX_DOORBELL)
        .u32(ring::FINISH)
}
fn native_seeds() -> Vec<Vec<u8>> {
    let r = |kind, flags, offset, b: &[u8]| record(kind, flags, GENERATION, offset, 0, b);
    let exit = |status: u32, out: u64, err: u64| {
        let mut b = [0u8; 24];
        b[..4].copy_from_slice(&status.to_le_bytes());
        b[8..16].copy_from_slice(&out.to_le_bytes());
        b[16..].copy_from_slice(&err.to_le_bytes());
        r(ring::NATIVE_EXIT, 0, 0, &b)
    };
    // The escaped diagnostic "A\n", as the kernel writes it.
    let msg = [r"\u00", "41", r"\u00", "0a"].concat();
    let log = format!(r#"{{"level":"debug","msg":"{msg}"}}"#);
    let log = r(ring::LOG, 1, 0, log.as_bytes());
    let run = |records: &[Vec<u8>]| {
        let mut p = Program::default().u32(1 << 16);
        for rec in records {
            p = p.op(NATIVE_APPEND).chunk(rec).op(NATIVE_DRAIN);
        }
        p.op(NATIVE_FINISH).u32(ring::FINISH).0
    };
    vec![
        run(&[
            r(ring::STDOUT, 0, 0, &[0, 255, 128, 10]),
            r(ring::STDERR, 0, 0, b"err\0"),
            log,
            r(ring::STDOUT, 0, 4, b"tail"),
            exit(42, 8, 4),
        ]),
        // Records that wrap the ring.
        run(&(0..40)
            .map(|i| r(ring::STDOUT, 0, i * 1000, &[b'x'; 1000]))
            .chain([exit(0, 40_000, 0)])
            .collect::<Vec<_>>()),
    ]
}
/// kernel/src/console.rs's start (queues, control buffers, DEVICE_READY),
/// one line out, host input in, then the end of input.
fn console_program() -> Program {
    let queue = |i: u64| CONSOLE_BASE + 0x1000 * (i + 1);
    let mut p = Program::default();
    let mmio = |p: Program, off: u16, v: u32| p.op(MMIO_WRITE).u16(off).u32(v);
    let poke =
        |p: Program, gpa: u64, b: &[u8]| p.op(RAM_WRITE).u16((gpa - CONSOLE_BASE) as u16).chunk(b);
    // A one-descriptor buffer of `len` bytes at `buf`, offered as avail[idx].
    let buffer = |p: Program, i: u64, idx: u16, buf: u64, len: u32, flags: u16| {
        let mut d = buf.to_le_bytes().to_vec();
        d.extend_from_slice(&len.to_le_bytes());
        d.extend_from_slice(&flags.to_le_bytes());
        d.extend_from_slice(&0u16.to_le_bytes());
        let p = poke(p, queue(i) + 16 * u64::from(idx), &d);
        let p = poke(p, queue(i) + 0x104 + 2 * u64::from(idx), &idx.to_le_bytes());
        poke(p, queue(i) + 0x102, &(idx + 1).to_le_bytes())
    };
    for v in [0, 1, 3, 11] {
        p = mmio(p, 0x70, v);
    }
    for i in 0..4u64 {
        p = mmio(p, 0x30, i as u32);
        p = mmio(p, 0x38, 8);
        for (off, gpa) in [
            (0x80, queue(i)),
            (0x90, queue(i) + 0x100),
            (0xa0, queue(i) + 0x200),
        ] {
            p = mmio(mmio(p, off, gpa as u32), off + 4, 0);
        }
        p = mmio(p, 0x44, 1);
    }
    p = mmio(p, 0x70, 15);
    p = buffer(p, 2, 0, queue(2) + 0x400, 256, 2);
    p = buffer(p, 0, 0, queue(0) + 0x400, 1024, 2);
    p = poke(p, queue(3) + 0x400, &[0, 0, 0, 0, 0, 0, 1, 0]);
    p = mmio(buffer(p, 3, 0, queue(3) + 0x400, 8, 0), 0x50, 3);
    p = poke(p, queue(1) + 0x400, b"hello\n");
    p = mmio(buffer(p, 1, 0, queue(1) + 0x400, 6, 0), 0x50, 1);
    p = p
        .op(HOST_INPUT)
        .chunk(b"input\n")
        .op(MMIO_READ)
        .u16(0x60)
        .op(WAIT);
    p = buffer(p, 0, 1, queue(0) + 0x800, 1024, 2);
    p.op(HOST_INPUT).chunk(b"").op(WAIT)
}
fn ipc_seeds() -> Vec<Vec<u8>> {
    let m = |kind, id, b: Vec<u8>| Message::new(kind, 0, 1, id, b).encode().unwrap();
    let mut start = vec![0u8; wire::START_HEADER_BYTES];
    start[8..12].copy_from_slice(&(ring::MAX_CALLS as u32).to_le_bytes());
    start[12..16].copy_from_slice(&(ring::CALL_BYTES as u32).to_le_bytes());
    start[16..20].copy_from_slice(&3u32.to_le_bytes());
    start[20..24].copy_from_slice(
        &jitk_abi::arena::Class::Glue2m
            .admission_bytes()
            .to_le_bytes(),
    );
    start.extend_from_slice(b"1+1");
    let mut seeds: Vec<Vec<u8>> = payload::corpus()
        .into_iter()
        .map(|(kind, _, _, payload)| {
            let kind = match kind {
                ring::CALL => service::CALL,
                ring::CONSOLE => service::LOG,
                _ => service::DONE,
            };
            let id = u64::from(kind == service::CALL);
            [m(service::START, 0, start.clone()), m(kind, id, payload)].concat()
        })
        .collect();
    // A run with a reply in three records, a cancel and its release.
    seeds.push(
        [
            m(service::START, 0, start.clone()),
            m(service::CALL, 1, b"[\"call\",\"ns\",\"fn\",[]]".to_vec()),
            m(service::REPLY, 1, vec![b'7'; 2 * wire::PAYLOAD + 5]),
            m(service::CANCEL, 0, Vec::new()),
            m(service::QUARANTINED, 0, b"reset failed".to_vec()),
        ]
        .concat(),
    );
    seeds
}
/// A native request (inputs.rs) for busybox with these input files.
fn native_request_bytes(paths: &[&str]) -> Vec<u8> {
    let text = |b: &mut Vec<u8>, s: &str| {
        b.extend_from_slice(&(s.len() as u16).to_le_bytes());
        b.extend_from_slice(s.as_bytes());
    };
    let mut b = inputs::MAGIC.to_vec();
    b.extend_from_slice(&1000u32.to_le_bytes());
    text(&mut b, "busybox");
    b.extend_from_slice(&1u16.to_le_bytes());
    text(&mut b, "busybox");
    b.extend_from_slice(&(paths.len() as u16).to_le_bytes());
    for p in paths {
        text(&mut b, p);
        b.extend_from_slice(&3u32.to_le_bytes());
        b.extend_from_slice(b"a\0b");
    }
    b
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seeds_replay() {
        for (name, harness) in TARGETS {
            let seeds = seeds(name);
            assert!(!seeds.is_empty(), "{name}");
            for seed in seeds {
                harness(&seed);
            }
        }
    }

    /// Inputs libFuzzer found, kept as tests.
    #[test]
    fn regressions() {
        // The guest's TX producer just below u64::MAX, then a write at it:
        // the harness wraps the guest's cursor arithmetic; the shard refuses
        // the cursor.
        let p = Program::default()
            .op(0)
            .op(TX_CURSOR)
            .u64(u64::MAX - 3)
            .op(TX_APPEND)
            .chunk(&[1; 40])
            .op(TX_DOORBELL)
            .u32(ring::SUBMIT);
        assert_eq!(ring_tx(&p.0), 0);
    }

    /// The ring seeds play the shared corpus as the shard judges it: every
    /// payload but the `shard` rows is forwarded, then the run completes.
    #[test]
    fn ring_seeds_follow_the_shared_corpus() {
        for row in payload::corpus() {
            let events = ring_tx(&ring_program(&row).0);
            let expected = match (row.0, row.2.as_str()) {
                (_, "shard") => 0,
                (ring::DONE, _) => 1,
                _ => 2,
            };
            assert_eq!(events, expected, "{}", row.1);
        }
    }

    fn events(name: &str) -> Vec<usize> {
        let harness = TARGETS.iter().find(|t| t.0 == name).unwrap().1;
        seeds(name).iter().map(|s| harness(s)).collect()
    }

    #[test]
    fn seeds_reach_their_decoders() {
        // Five records drained, then the completion; 41, then it.
        assert_eq!(events("native_tx"), [6, 42]);
        // Every IPC seed admits its START; the last also its call, reply,
        // cancel and quarantine.
        let ipc = events("ipc_records");
        assert!(ipc.iter().all(|&n| n >= 1) && *ipc.last().unwrap() == 5);
        // One request decoded; two framed requests answered.
        assert_eq!(events("native_request"), [1, 2]);
    }

    /// The console seed is the kernel's protocol: every step succeeds, the
    /// line goes out, DEVICE_ADD comes back, input and then its end arrive.
    #[test]
    fn console_seed_runs_the_kernel_protocol() {
        let program = console_program().0;
        let (mut dev, events) = run_console(&program);
        let mut steps = 0;
        let mut input = Input(&program);
        while let Some(tag) = input.u8() {
            steps += 1;
            match tag % 5 {
                MMIO_WRITE => drop((input.u16(), input.u32())),
                MMIO_READ => drop(input.u16()),
                RAM_WRITE => drop((input.u16(), input.u16().map(|n| input.bytes(n.into())))),
                HOST_INPUT => drop(input.u16().map(|n| input.bytes(n.into()))),
                _ => {}
            }
        }
        assert_eq!(events, steps);
        assert_eq!(dev.port().output, 6);
        // Queue i's used index and the lengths of its used elements.
        let used = |dev: &mut FuzzConsole, i: usize| {
            let b = &dev.ram_mut()[0x1000 * (i + 1) + 0x200..];
            let idx = u16::from_le_bytes([b[2], b[3]]);
            let lens: Vec<u32> = (0..usize::from(idx))
                .map(|k| u32::from_le_bytes(b[8 + 8 * k..12 + 8 * k].try_into().unwrap()))
                .collect();
            (idx, lens)
        };
        assert_eq!(used(&mut dev, 2), (1, vec![8]), "DEVICE_ADD");
        assert_eq!(used(&mut dev, 0), (2, vec![6, 0]), "input, then its end");
        assert_eq!(&dev.ram_mut()[0x1400..0x1406], b"input\n");
    }
}

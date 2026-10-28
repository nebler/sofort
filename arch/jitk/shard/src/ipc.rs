//! Node/shard SPSC queues. Fixed geometry, private cursor shadows and bounded
//! copies: peer-owned metadata never supplies a pointer or allocation size.
use std::{
    fs::File,
    io,
    os::fd::{AsRawFd, FromRawFd},
    ptr,
    sync::atomic::{
        AtomicU64,
        Ordering::{Acquire, Release},
    },
};

use crate::constants::ipc::{
    BYTES, DATA, RECORD, REGION, RX_CONSUMER, RX_PRODUCER, TX_CONSUMER, TX_PRODUCER,
};
pub use crate::constants::ipc::{
    CALL, CANCEL, CAPACITY, DONE, ERROR, PAYLOAD, PING, QUARANTINED, READY, RELEASED, REPLY, START,
};

use libc::{fcntl, mmap, munmap, poll, pollfd as PollFd, read, write};

fn invalid(message: &'static str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}
fn validate_memory(file: &File) -> io::Result<()> {
    const REQUIRED_SEALS: i32 = libc::F_SEAL_SEAL | libc::F_SEAL_SHRINK | libc::F_SEAL_GROW; // SEAL, SHRINK, GROW; peer writes remain allowed.
    // SAFETY: F_GET_SEALS takes no variadic argument and does not mutate the fd.
    let seals = unsafe { fcntl(file.as_raw_fd(), libc::F_GET_SEALS) };
    if seals < 0 {
        return Err(io::Error::last_os_error());
    }
    if file.metadata()?.len() != BYTES as u64 || seals & REQUIRED_SEALS != REQUIRED_SEALS {
        return Err(invalid("IPC requires exact sealed memfd geometry"));
    }
    Ok(())
}
pub fn u32_at(b: &[u8], at: usize) -> u32 {
    u32::from_le_bytes(b[at..at + 4].try_into().unwrap())
}
pub fn u64_at(b: &[u8], at: usize) -> u64 {
    u64::from_le_bytes(b[at..at + 8].try_into().unwrap())
}
#[derive(Debug)]
pub struct Message {
    pub kind: u32,
    pub slot: u32,
    pub generation: u64,
    pub id: u32,
    pub bytes: Vec<u8>,
}
impl Message {
    pub fn new(kind: u32, slot: usize, generation: u64, id: u64, bytes: Vec<u8>) -> Self {
        Self {
            kind,
            slot: slot as u32,
            generation,
            id: id as u32,
            bytes,
        }
    }
    fn decode(copy: &[u8; RECORD]) -> io::Result<Self> {
        let n = u32_at(copy, 20) as usize;
        if n > PAYLOAD || u64_at(copy, 24) != 0 {
            return Err(invalid("IPC record length/reserved"));
        }
        Ok(Self {
            kind: u32_at(copy, 0),
            slot: u32_at(copy, 4),
            generation: u64_at(copy, 8),
            id: u32_at(copy, 16),
            bytes: copy[32..32 + n].to_vec(),
        })
    }
}
#[derive(Clone)]
pub struct Notify(std::sync::Arc<File>);
impl Notify {
    pub fn signal(&self) {
        let one = 1u64.to_ne_bytes();
        loop {
            // SAFETY: The eventfd is held live by Arc<File> and one is a
            // readable eight-byte value for the duration of write.
            let n = unsafe { write(self.0.as_raw_fd(), one.as_ptr().cast(), 8) };
            if n == 8 {
                return;
            }
            match io::Error::last_os_error().raw_os_error() {
                Some(libc::EINTR) => continue,
                Some(libc::EAGAIN) => return,
                e => panic!("IPC eventfd write: {e:?}"),
            }
        }
    }
}
pub struct Endpoint {
    memory: *mut u8,
    _file: File,
    incoming: Notify,
    outgoing: Notify,
    tx: u64,
    peer: u64,
    rx: u64,
}
impl Endpoint {
    /// Takes ownership of inherited descriptors. The sealed size prevents SIGBUS
    /// even if the peer attempts to truncate its copy of the memfd.
    ///
    /// # Safety
    /// Descriptors 3, 4 and 5 must be live and uniquely transferred to this
    /// endpoint: a memfd, incoming eventfd and outgoing eventfd respectively.
    /// Call once, before other code can adopt or close these descriptors.
    pub unsafe fn inherited() -> io::Result<Self> {
        // SAFETY: The caller transfers unique ownership of live inherited
        // descriptors 3/4/5. Mapping uses the exact validated, size-sealed memfd
        // extent and is checked before access.
        let file = unsafe { File::from_raw_fd(3) };
        // SAFETY: inherited() transfers the live incoming eventfd exactly once.
        let incoming = Notify(std::sync::Arc::new(unsafe { File::from_raw_fd(4) }));
        // SAFETY: inherited() transfers the live outgoing eventfd exactly once.
        let outgoing = Notify(std::sync::Arc::new(unsafe { File::from_raw_fd(5) }));
        validate_memory(&file)?;
        // SAFETY: The caller transfers unique ownership of live inherited
        // descriptors 3/4/5. Mapping uses the exact validated, size-sealed memfd
        // extent and is checked before access.
        let memory = unsafe {
            mmap(
                ptr::null_mut(),
                BYTES,
                libc::PROT_READ | libc::PROT_WRITE,
                libc::MAP_SHARED,
                3,
                0,
            )
            .cast::<u8>()
        };
        if memory as isize == -1 {
            return Err(io::Error::last_os_error());
        }
        Ok(Self {
            memory,
            _file: file,
            incoming,
            outgoing,
            tx: 0,
            peer: 0,
            rx: 0,
        })
    }
    fn cursor(&self, offset: usize) -> &AtomicU64 {
        // SAFETY: Only the four fixed, aligned AtomicU64 control offsets are
        // supplied. They lie in the live, size-sealed mapping and are accessed
        // atomically by both peers.
        unsafe { &*self.memory.add(offset).cast() }
    }
    pub fn notifier(&self) -> Notify {
        self.incoming.clone()
    }
    pub fn receive(&mut self) -> io::Result<Option<Message>> {
        let produced = self.cursor(RX_PRODUCER).load(Acquire);
        if produced < self.rx || produced - self.rx > CAPACITY {
            return Err(invalid("IPC producer cursor"));
        }
        if produced == self.rx {
            return Ok(None);
        }
        let mut copy = [0u8; RECORD];
        // SAFETY: The host-selected ring index is within the fixed mapping, disjoint
        // from copy. Acquire observed peer publication; this SPSC consumer returns
        // credit only after the copy.
        unsafe {
            ptr::copy_nonoverlapping(
                self.memory
                    .add(DATA + (self.rx % CAPACITY) as usize * RECORD),
                copy.as_mut_ptr(),
                RECORD,
            );
        }
        let message = Message::decode(&copy)?;
        self.rx += 1;
        self.cursor(RX_CONSUMER).store(self.rx, Release);
        self.outgoing.signal(); // return queue credit, even when no response is ready
        Ok(Some(message))
    }
    pub fn send(&mut self, message: &Message) -> io::Result<bool> {
        if message.bytes.len() > PAYLOAD {
            return Err(invalid("IPC local payload bound"));
        }
        let consumed = self.cursor(TX_CONSUMER).load(Acquire);
        if consumed < self.peer
            || consumed > self.tx
            || self.tx - consumed > CAPACITY
            || self.tx == u64::MAX
        {
            return Err(invalid("IPC consumer cursor"));
        }
        self.peer = consumed;
        if self.tx - consumed == CAPACITY {
            return Ok(false);
        }
        let mut header = [0u8; 32];
        header[0..4].copy_from_slice(&message.kind.to_le_bytes());
        header[4..8].copy_from_slice(&message.slot.to_le_bytes());
        header[8..16].copy_from_slice(&message.generation.to_le_bytes());
        header[16..20].copy_from_slice(&message.id.to_le_bytes());
        header[20..24].copy_from_slice(&(message.bytes.len() as u32).to_le_bytes());
        let at = DATA + REGION + (self.tx % CAPACITY) as usize * RECORD;
        // SAFETY: The header and bounded payload are disjoint from the fixed mapped
        // TX slot; checked consumer credit gives this SPSC producer ownership until
        // release publication.
        unsafe {
            ptr::copy_nonoverlapping(header.as_ptr(), self.memory.add(at), 32);
            ptr::copy_nonoverlapping(
                message.bytes.as_ptr(),
                self.memory.add(at + 32),
                message.bytes.len(),
            );
        }
        self.tx += 1;
        self.cursor(TX_PRODUCER).store(self.tx, Release);
        self.outgoing.signal();
        Ok(true)
    }
    pub fn wait(&self) -> io::Result<()> {
        let fd = self.incoming.0.as_raw_fd();
        let mut p = PollFd {
            fd,
            events: libc::POLLIN,
            revents: 0,
        };
        // A bounded liveness check also notices an unexpectedly dead watchdog.
        // SAFETY: The pollfd and eight-byte eventfd buffer are live and writable for
        // their respective calls; no pointer escapes.
        let n = unsafe { poll(&mut p, 1, 100) };
        if n < 0 && io::Error::last_os_error().raw_os_error() != Some(libc::EINTR) {
            return Err(io::Error::last_os_error());
        }
        let mut value = 0u64;
        // SAFETY: The pollfd and eight-byte eventfd buffer are live and writable for
        // their respective calls; no pointer escapes.
        unsafe {
            read(fd, (&mut value as *mut u64).cast(), 8);
        }
        Ok(())
    }
}
impl Drop for Endpoint {
    fn drop(&mut self) {
        // SAFETY: Endpoint exclusively owns this mapping; no reference into it
        // escapes Endpoint, and it is unmapped once.
        unsafe {
            munmap(self.memory.cast(), BYTES);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        BYTES, CAPACITY, DATA, Endpoint, Message, Notify, PAYLOAD, RECORD, REPLY, RX_CONSUMER,
        RX_PRODUCER, START, TX_CONSUMER, validate_memory,
    };
    use libc::{eventfd, memfd_create};
    use libc::{fcntl, mmap};
    use std::{
        fs::File,
        os::fd::{AsRawFd, FromRawFd},
        ptr,
        sync::atomic::Ordering::{Acquire, Release},
    };
    #[test]
    fn rejects_regular_files_and_missing_seals() {
        let path = std::env::current_dir()
            .unwrap()
            .join(format!("jitk-seals-{}", std::process::id()));
        let file = File::options()
            .read(true)
            .write(true)
            .create_new(true)
            .open(&path)
            .unwrap();
        std::fs::remove_file(path).unwrap();
        file.set_len(BYTES as u64).unwrap();
        assert!(
            validate_memory(&file).is_err(),
            "regular files must never pass F_GET_SEALS"
        );
        // SAFETY: a static NUL-terminated name, and ownership of the new fd transfers to File.
        let file = unsafe {
            File::from_raw_fd(memfd_create(
                c"jitk-seal-test".as_ptr().cast(),
                libc::MFD_CLOEXEC | libc::MFD_ALLOW_SEALING,
            ))
        };
        file.set_len(BYTES as u64).unwrap();
        assert!(validate_memory(&file).is_err());
        for seal in [1, 2, 4] {
            // Add SEAL last, so the intermediate missing-seal cases stay testable.
            let bit = match seal {
                1 => 2,
                2 => 4,
                _ => 1,
            };
            assert_eq!(
                // SAFETY: The memfd is live and uniquely owned; F_ADD_SEALS
                // accepts the named scalar bit without retaining a pointer.
                unsafe { fcntl(file.as_raw_fd(), libc::F_ADD_SEALS, bit) },
                0
            );
            assert_eq!(validate_memory(&file).is_ok(), seal == 4);
        }
    }
    fn endpoint() -> Endpoint {
        // SAFETY: The anonymous mapping is checked before access. eventfd returns
        // fresh descriptors transferred once into File; these are local test
        // endpoints with no competing owners.
        let memory = unsafe {
            mmap(
                ptr::null_mut(),
                BYTES,
                libc::PROT_READ | libc::PROT_WRITE,
                libc::MAP_SHARED | libc::MAP_ANONYMOUS,
                -1,
                0,
            )
            .cast::<u8>()
        };
        assert_ne!(memory as isize, -1);
        // SAFETY: The anonymous mapping is checked before access. eventfd returns
        // fresh descriptors transferred once into File; these are local test
        // endpoints with no competing owners.
        let incoming = Notify(std::sync::Arc::new(unsafe {
            File::from_raw_fd(eventfd(0, libc::EFD_CLOEXEC | libc::EFD_NONBLOCK))
        }));
        // SAFETY: The anonymous mapping is checked before access. eventfd returns
        // fresh descriptors transferred once into File; these are local test
        // endpoints with no competing owners.
        let outgoing = Notify(std::sync::Arc::new(unsafe {
            File::from_raw_fd(eventfd(0, libc::EFD_CLOEXEC | libc::EFD_NONBLOCK))
        }));
        Endpoint {
            memory,
            _file: File::open("/dev/null").unwrap(),
            incoming,
            outgoing,
            tx: 0,
            peer: 0,
            rx: 0,
        }
    }
    #[test]
    fn private_cursor_shadows_and_wrapped_records() {
        let mut e = endpoint();
        assert!(e.receive().unwrap().is_none());
        for cursor in [CAPACITY + 1, u64::MAX] {
            e.cursor(RX_PRODUCER).store(cursor, Release);
            assert!(e.receive().is_err());
        }
        e.cursor(RX_PRODUCER).store(0, Release);
        let message = Message::new(REPLY, 0, 1, 1, vec![]);
        e.cursor(TX_CONSUMER).store(1, Release);
        assert!(e.send(&message).is_err());
        e.cursor(TX_CONSUMER).store(0, Release);
        e.tx = 2;
        e.peer = 1;
        assert!(e.send(&message).is_err());
        e.tx = 0;
        e.peer = 0;
        for i in 0..128u64 {
            let mut record = [0u8; RECORD];
            record[0..4].copy_from_slice(&START.to_le_bytes());
            record[8..16].copy_from_slice(&1u64.to_le_bytes());
            record[16..20].copy_from_slice(&(i as u32).to_le_bytes());
            // SAFETY: The local test mapping contains the entire host-selected
            // RX slot; the stack record is disjoint, and publication follows
            // this copy.
            unsafe {
                ptr::copy_nonoverlapping(
                    record.as_ptr(),
                    e.memory.add(DATA + (i % CAPACITY) as usize * RECORD),
                    RECORD,
                );
            }
            e.cursor(RX_PRODUCER).store(i + 1, Release);
            assert_eq!(e.receive().unwrap().unwrap().id, i as u32);
            assert_eq!(e.cursor(RX_CONSUMER).load(Acquire), i + 1);
        }
        e.cursor(RX_PRODUCER).store(127, Release);
        assert!(e.receive().is_err());
    }
    #[test]
    fn hostile_lengths_and_reserved_fields() {
        let mut copy = [0u8; RECORD];
        copy[20..24].copy_from_slice(&u32::MAX.to_le_bytes());
        assert!(Message::decode(&copy).is_err());
        copy[20..24].fill(0);
        copy[24] = 1;
        assert!(Message::decode(&copy).is_err());
        copy[24] = 0;
        copy[20..24].copy_from_slice(&(PAYLOAD as u32).to_le_bytes());
        assert_eq!(Message::decode(&copy).unwrap().bytes.len(), PAYLOAD);
    }
}

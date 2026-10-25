//! Node/shard SPSC queues. Fixed geometry, private cursor shadows and bounded
//! copies: peer-owned metadata never supplies a pointer or allocation size.
use std::{
    ffi::c_void,
    fs::File,
    io,
    os::fd::{AsRawFd, FromRawFd},
    ptr,
    sync::atomic::{
        AtomicU64,
        Ordering::{Acquire, Release},
    },
};

pub const CAPACITY: u64 = 64;
pub const PAYLOAD: usize = 16384;
const RECORD: usize = 32 + PAYLOAD;
const REGION: usize = CAPACITY as usize * RECORD;
const BYTES: usize = 4096 + 2 * REGION;
pub const START: u32 = 1;
pub const REPLY: u32 = 2;
pub const CANCEL: u32 = 3;
pub const CALL: u32 = 16;
pub const DONE: u32 = 17;
pub const ERROR: u32 = 18;
pub const RELEASED: u32 = 19;
pub const READY: u32 = 20;
pub const PING: u32 = 21; // offline IPC/policy latency probe; never a guest capability

unsafe extern "C" {
    fn mmap(addr: *mut c_void, len: usize, prot: i32, flags: i32, fd: i32, off: i64)
    -> *mut c_void;
    fn munmap(addr: *mut c_void, len: usize) -> i32;
    fn fcntl(fd: i32, cmd: i32, ...) -> i32;
    fn read(fd: i32, data: *mut c_void, n: usize) -> isize;
    fn write(fd: i32, data: *const c_void, n: usize) -> isize;
    fn poll(fds: *mut PollFd, count: usize, timeout: i32) -> i32;
}
#[repr(C)]
struct PollFd {
    fd: i32,
    events: i16,
    revents: i16,
}
fn invalid(message: &'static str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
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
            let n = unsafe { write(self.0.as_raw_fd(), one.as_ptr().cast(), 8) };
            if n == 8 {
                return;
            }
            match io::Error::last_os_error().raw_os_error() {
                Some(4) => continue,
                Some(11) => return,
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
    pub unsafe fn inherited() -> io::Result<Self> {
        let file = unsafe { File::from_raw_fd(3) };
        let incoming = Notify(std::sync::Arc::new(unsafe { File::from_raw_fd(4) }));
        let outgoing = Notify(std::sync::Arc::new(unsafe { File::from_raw_fd(5) }));
        if file.metadata()?.len() != BYTES as u64 || unsafe { fcntl(3, 1034) } & 7 != 7 {
            return Err(invalid("IPC requires exact sealed memfd geometry"));
        }
        let memory = unsafe { mmap(ptr::null_mut(), BYTES, 3, 1, 3, 0).cast::<u8>() };
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
        unsafe { &*self.memory.add(offset).cast() }
    }
    pub fn notifier(&self) -> Notify {
        self.incoming.clone()
    }
    pub fn receive(&mut self) -> io::Result<Option<Message>> {
        let produced = self.cursor(64).load(Acquire);
        if produced < self.rx || produced - self.rx > CAPACITY {
            return Err(invalid("IPC producer cursor"));
        }
        if produced == self.rx {
            return Ok(None);
        }
        let mut copy = [0u8; RECORD];
        unsafe {
            ptr::copy_nonoverlapping(
                self.memory
                    .add(4096 + (self.rx % CAPACITY) as usize * RECORD),
                copy.as_mut_ptr(),
                RECORD,
            );
        }
        let message = Message::decode(&copy)?;
        self.rx += 1;
        self.cursor(128).store(self.rx, Release);
        self.outgoing.signal(); // return queue credit, even when no response is ready
        Ok(Some(message))
    }
    pub fn send(&mut self, message: &Message) -> io::Result<bool> {
        if message.bytes.len() > PAYLOAD {
            return Err(invalid("IPC local payload bound"));
        }
        let consumed = self.cursor(256).load(Acquire);
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
        let at = 4096 + REGION + (self.tx % CAPACITY) as usize * RECORD;
        unsafe {
            ptr::copy_nonoverlapping(header.as_ptr(), self.memory.add(at), 32);
            ptr::copy_nonoverlapping(
                message.bytes.as_ptr(),
                self.memory.add(at + 32),
                message.bytes.len(),
            );
        }
        self.tx += 1;
        self.cursor(192).store(self.tx, Release);
        self.outgoing.signal();
        Ok(true)
    }
    pub fn wait(&self) -> io::Result<()> {
        let fd = self.incoming.0.as_raw_fd();
        let mut p = PollFd {
            fd,
            events: 1,
            revents: 0,
        };
        // A bounded liveness check also notices an unexpectedly dead watchdog.
        let n = unsafe { poll(&mut p, 1, 100) };
        if n < 0 && io::Error::last_os_error().raw_os_error() != Some(4) {
            return Err(io::Error::last_os_error());
        }
        let mut value = 0u64;
        unsafe {
            read(fd, (&mut value as *mut u64).cast(), 8);
        }
        Ok(())
    }
}
impl Drop for Endpoint {
    fn drop(&mut self) {
        unsafe {
            munmap(self.memory.cast(), BYTES);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
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

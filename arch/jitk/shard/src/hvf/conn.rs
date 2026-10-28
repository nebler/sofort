//! IPC records over a stream socket (macOS): the Linux shard's records
//! (service::Message) framed back to back, as Node's PipeChannel writes them.
//! Reads go into one bounded buffer (at most one record plus one read);
//! writes queue up to a bound and drain without blocking, so a peer that stops
//! reading never stalls the zygote's poll loop.
use crate::service::{HEADER_BYTES, Message, PAYLOAD, invalid, u32_at};
use std::{
    collections::VecDeque,
    io,
    os::fd::{AsRawFd, OwnedFd, RawFd},
};

/// One read: large enough for a full record.
const CHUNK: usize = 64 << 10;

pub struct Conn {
    fd: OwnedFd,
    input: Vec<u8>,
    output: VecDeque<Vec<u8>>,
    /// Bytes of output's front already written.
    written: usize,
    /// Queued records before `queue` fails.
    bound: usize,
}
impl Conn {
    pub fn new(fd: OwnedFd, bound: usize) -> Self {
        Self {
            fd,
            input: Vec::new(),
            output: VecDeque::new(),
            written: 0,
            bound,
        }
    }
    pub fn fd(&self) -> RawFd {
        self.fd.as_raw_fd()
    }
    pub fn set_nonblocking(&self) -> io::Result<()> {
        // SAFETY: F_GETFL on an owned descriptor; no further arguments.
        let flags = unsafe { libc::fcntl(self.fd(), libc::F_GETFL) };
        if flags < 0 {
            return Err(io::Error::last_os_error());
        }
        // SAFETY: F_SETFL on an owned descriptor with a scalar flag word.
        if unsafe { libc::fcntl(self.fd(), libc::F_SETFL, flags | libc::O_NONBLOCK) } < 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(())
    }
    /// One read into the input buffer. Ok(false): end of stream. A
    /// non-blocking socket with nothing to read returns Ok(true).
    pub fn fill(&mut self) -> io::Result<bool> {
        if self.input.len() > HEADER_BYTES + PAYLOAD {
            return Err(invalid("IPC stream buffer bound"));
        }
        let at = self.input.len();
        self.input.resize(at + CHUNK, 0);
        let result = loop {
            // SAFETY: the buffer has CHUNK writable bytes after `at`.
            let n = unsafe { libc::read(self.fd(), self.input.as_mut_ptr().add(at).cast(), CHUNK) };
            if n >= 0 {
                break Ok(n as usize);
            }
            match io::Error::last_os_error() {
                e if e.kind() == io::ErrorKind::Interrupted => continue,
                e if e.kind() == io::ErrorKind::WouldBlock => break Ok(usize::MAX),
                e => break Err(e),
            }
        };
        match result {
            Ok(usize::MAX) => {
                self.input.truncate(at);
                Ok(true)
            }
            Ok(n) => {
                self.input.truncate(at + n);
                Ok(n != 0)
            }
            Err(e) => {
                self.input.truncate(at);
                Err(e)
            }
        }
    }
    /// The next complete record in the input buffer, if any.
    pub fn next(&mut self) -> io::Result<Option<Message>> {
        if self.input.len() < HEADER_BYTES {
            return Ok(None);
        }
        let n = u32_at(&self.input, crate::constants::ipc::LENGTH_AT) as usize;
        if n > PAYLOAD {
            return Err(invalid("IPC record length/reserved"));
        }
        if self.input.len() < HEADER_BYTES + n {
            return Ok(None);
        }
        let m = Message::decode(&self.input[..HEADER_BYTES + n])?;
        self.input.drain(..HEADER_BYTES + n);
        Ok(Some(m))
    }
    /// Queue a record; past the bound the peer is not reading and the caller
    /// fails it.
    pub fn queue(&mut self, m: &Message) -> io::Result<()> {
        if self.output.len() >= self.bound {
            return Err(invalid("IPC stream writer bound"));
        }
        self.output.push_back(m.encode()?);
        Ok(())
    }
    pub fn pending(&self) -> bool {
        !self.output.is_empty()
    }
    /// Write queued records until done or the socket would block.
    pub fn flush(&mut self) -> io::Result<()> {
        while let Some(front) = self.output.front() {
            let rest = &front[self.written..];
            // SAFETY: rest is a live readable slice.
            let n = unsafe { libc::write(self.fd(), rest.as_ptr().cast(), rest.len()) };
            if n < 0 {
                match io::Error::last_os_error() {
                    e if e.kind() == io::ErrorKind::Interrupted => continue,
                    e if e.kind() == io::ErrorKind::WouldBlock => return Ok(()),
                    e => return Err(e),
                }
            }
            self.written += n as usize;
            if self.written == front.len() {
                self.output.pop_front();
                self.written = 0;
            }
        }
        Ok(())
    }
}
/// Write one record on a blocking socket (the engine child's main thread).
pub fn send(fd: RawFd, m: &Message) -> io::Result<()> {
    let b = m.encode()?;
    let mut at = 0;
    while at < b.len() {
        // SAFETY: b[at..] is a live readable slice.
        let n = unsafe { libc::write(fd, b[at..].as_ptr().cast(), b.len() - at) };
        if n < 0 {
            let e = io::Error::last_os_error();
            if e.kind() == io::ErrorKind::Interrupted {
                continue;
            }
            return Err(e);
        }
        at += n as usize;
    }
    Ok(())
}
/// A connected AF_UNIX stream pair with buffers sized for a few records.
pub fn pair() -> io::Result<(OwnedFd, OwnedFd)> {
    use std::os::fd::FromRawFd;
    let mut fds = [0; 2];
    // SAFETY: fds is a live two-element out-array.
    if unsafe { libc::socketpair(libc::AF_UNIX, libc::SOCK_STREAM, 0, fds.as_mut_ptr()) } != 0 {
        return Err(io::Error::last_os_error());
    }
    // SAFETY: socketpair returned two new descriptors owned only here.
    let (a, b) = unsafe { (OwnedFd::from_raw_fd(fds[0]), OwnedFd::from_raw_fd(fds[1])) };
    for fd in [&a, &b] {
        buffers(fd.as_raw_fd());
    }
    Ok((a, b))
}
/// Socket buffers for a few full records each way (best effort).
pub fn buffers(fd: RawFd) {
    let size: libc::c_int = 256 << 10;
    for opt in [libc::SO_SNDBUF, libc::SO_RCVBUF] {
        // SAFETY: a live int option value of the stated size.
        unsafe {
            libc::setsockopt(
                fd,
                libc::SOL_SOCKET,
                opt,
                (&size as *const libc::c_int).cast(),
                std::mem::size_of::<libc::c_int>() as libc::socklen_t,
            )
        };
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::service::{CALL, REPLY};
    #[test]
    fn records_cross_a_stream_in_pieces() {
        let (a, b) = pair().unwrap();
        let mut rx = Conn::new(b, 4);
        rx.set_nonblocking().unwrap();
        let big = Message::new(CALL, 1, 9, 3, vec![b'x'; PAYLOAD]);
        let small = Message::new(REPLY, 0, 1, 1, b"{}".to_vec());
        let mut tx = Conn::new(a, 4);
        tx.set_nonblocking().unwrap();
        tx.queue(&big).unwrap();
        tx.queue(&small).unwrap();
        let mut got = Vec::new();
        while got.len() < 2 {
            tx.flush().unwrap();
            assert!(rx.fill().unwrap(), "unexpected end of stream");
            while let Some(m) = rx.next().unwrap() {
                got.push(m);
            }
        }
        assert_eq!(got, [big, small]);
        assert!(!tx.pending());
        // Nothing to read on a non-blocking socket is not end of stream.
        assert!(rx.fill().unwrap());
        drop(tx);
        assert!(!rx.fill().unwrap());
    }
    #[test]
    fn hostile_stream_envelopes_fail() {
        let (a, b) = pair().unwrap();
        let mut rx = Conn::new(b, 1);
        let mut h = Message::new(CALL, 0, 1, 1, vec![]).header();
        h[20..24].copy_from_slice(&(PAYLOAD as u32 + 1).to_le_bytes());
        // SAFETY: h is a live readable header.
        let n = unsafe { libc::write(a.as_raw_fd(), h.as_ptr().cast(), h.len()) };
        assert_eq!(n, 32);
        assert!(rx.fill().unwrap());
        assert!(rx.next().is_err());
        let mut tx = Conn::new(a, 1);
        tx.queue(&Message::new(CALL, 0, 1, 1, vec![])).unwrap();
        assert!(
            tx.queue(&Message::new(CALL, 0, 1, 1, vec![])).is_err(),
            "writer bound"
        );
    }
}

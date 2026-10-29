//! IPC records over a stream socket (macOS): the Linux shard's records
//! (service::Message) framed back to back, as Node's PipeChannel writes them.
//! Reads go into one bounded buffer (at most one record plus one read);
//! writes queue up to a bound and drain without blocking, so a peer that stops
//! reading never stalls the zygote's poll loop.
use crate::service::{Assembler, HEADER_BYTES, Message, PAYLOAD, invalid, u32_at};
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
    assembler: Assembler,
    output: VecDeque<Vec<u8>>,
    /// Bytes of output's front already written.
    written: usize,
    /// Queued messages before `queue` fails.
    bound: usize,
}
impl Conn {
    pub fn new(fd: OwnedFd, bound: usize) -> Self {
        Self {
            fd,
            input: Vec::new(),
            assembler: Assembler::default(),
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
        self.input.reserve(CHUNK);
        let n = loop {
            // SAFETY: reserve left at least CHUNK bytes of spare capacity
            // after `at`; read writes only into them.
            let n = unsafe { libc::read(self.fd(), self.input.as_mut_ptr().add(at).cast(), CHUNK) };
            if n >= 0 {
                break n as usize;
            }
            match io::Error::last_os_error() {
                e if e.kind() == io::ErrorKind::Interrupted => continue,
                e if e.kind() == io::ErrorKind::WouldBlock => return Ok(true),
                e => return Err(e),
            }
        };
        // SAFETY: read initialised these n bytes of spare capacity.
        unsafe { self.input.set_len(at + n) };
        Ok(n != 0)
    }
    /// The next complete message in the input buffer, if any.
    pub fn next(&mut self) -> io::Result<Option<Message>> {
        loop {
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
            let (record, more) = Message::decode(&self.input[..HEADER_BYTES + n])?;
            self.input.drain(..HEADER_BYTES + n);
            if let Some(m) = self.assembler.push(record, more)? {
                return Ok(Some(m));
            }
        }
    }
    /// Queue a message (all its records); past the bound (in messages) the
    /// peer is not reading and the caller fails it.
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
    /// Write queued messages until done or the socket would block: all that
    /// are queued in one writev, so messages that arrived together leave
    /// together.
    pub fn flush(&mut self) -> io::Result<()> {
        const BATCH: usize = 64;
        while !self.output.is_empty() {
            let mut iov = [libc::iovec {
                iov_base: std::ptr::null_mut(),
                iov_len: 0,
            }; BATCH];
            let mut count = 0;
            for (i, message) in self.output.iter().take(BATCH).enumerate() {
                let rest = &message[if i == 0 { self.written } else { 0 }..];
                iov[i] = libc::iovec {
                    iov_base: rest.as_ptr() as *mut libc::c_void,
                    iov_len: rest.len(),
                };
                count += 1;
            }
            // SAFETY: the first `count` entries point into live queued buffers.
            let n = unsafe { libc::writev(self.fd(), iov.as_ptr(), count as libc::c_int) };
            if n < 0 {
                match io::Error::last_os_error() {
                    e if e.kind() == io::ErrorKind::Interrupted => continue,
                    e if e.kind() == io::ErrorKind::WouldBlock => return Ok(()),
                    e => return Err(e),
                }
            }
            self.consume(n as usize);
        }
        Ok(())
    }
    /// Drop `n` written bytes from the front of the output queue.
    fn consume(&mut self, mut n: usize) {
        while let Some(front) = self.output.front() {
            let left = front.len() - self.written;
            if n < left {
                self.written += n;
                return;
            }
            n -= left;
            self.output.pop_front();
            self.written = 0;
        }
    }
}
/// Write `messages` on a blocking socket in one write (the engine child's
/// main thread).
pub fn send(fd: RawFd, messages: &[Message]) -> io::Result<()> {
    let mut b = Vec::new();
    for m in messages {
        b.extend_from_slice(&m.encode()?);
    }
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
        let big = Message::new(CALL, 1, 9, 3, vec![b'x'; 3 * PAYLOAD + 1]);
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
    /// A small send buffer makes writev stop inside a message and between
    /// messages; every message still arrives whole and in order.
    #[test]
    fn partial_writes_resume_where_they_stopped() {
        let (a, b) = pair().unwrap();
        let shrink = |fd: RawFd, opt| {
            let small: libc::c_int = 4096;
            // SAFETY: a live int option value of the stated size.
            let r = unsafe {
                libc::setsockopt(
                    fd,
                    libc::SOL_SOCKET,
                    opt,
                    (&small as *const libc::c_int).cast(),
                    std::mem::size_of::<libc::c_int>() as libc::socklen_t,
                )
            };
            assert_eq!(r, 0);
        };
        shrink(a.as_raw_fd(), libc::SO_SNDBUF);
        shrink(b.as_raw_fd(), libc::SO_RCVBUF);
        let sent: Vec<Message> = (0..40u8)
            .map(|i| Message::new(CALL, 0, 1, i.into(), vec![i; 1000 + 97 * usize::from(i)]))
            .collect();
        let mut tx = Conn::new(a, sent.len());
        tx.set_nonblocking().unwrap();
        let mut rx = Conn::new(b, 1);
        rx.set_nonblocking().unwrap();
        for m in &sent {
            tx.queue(m).unwrap();
        }
        let (mut got, mut stalls) = (Vec::new(), 0);
        while got.len() < sent.len() {
            tx.flush().unwrap();
            stalls += usize::from(tx.pending());
            assert!(rx.fill().unwrap(), "unexpected end of stream");
            while let Some(m) = rx.next().unwrap() {
                got.push(m);
            }
        }
        assert_eq!(got, sent);
        assert!(!tx.pending() && stalls > 1, "{stalls} partial flushes");
    }
    #[test]
    fn hostile_stream_envelopes_fail() {
        let (a, b) = pair().unwrap();
        let mut rx = Conn::new(b, 1);
        let mut h = Message::new(CALL, 0, 1, 1, vec![]).encode().unwrap();
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

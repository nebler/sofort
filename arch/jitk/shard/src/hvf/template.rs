//! The engine template: the process every HVF engine process is forked from.
//!
//! The zygote forks it once, after it has loaded the snapshot and entered
//! its Seatbelt profile and before READY, so before any tenant byte exists.
//! From then on the zygote carries tenant traffic (Node's START sources and
//! REPLY payloads, the children's CALL and DONE bytes) through its heap and
//! stack, and a child forked from the zygote would inherit all of it,
//! including what is freed. The template only ever reads the zygote's
//! fixed-size commands on its control socket, so an engine process forked
//! from it, at startup or as a replacement for a dead or quarantined slot,
//! holds nothing of any tenant: what an attacker who escapes into one engine
//! process and exits it to force a re-fork finds is the snapshot.
//!
//! Commands (one 16-byte record each, answered in order):
//! - SPAWN slot, with the engine's socket attached (SCM_RIGHTS): fork an
//!   engine process for `slot` on it; answers its pid.
//! - KILL pid: SIGKILL one of its engine processes (escalation).
//! - REAP pid: SIGKILL and wait for it; answers its wait status.
//!
//! The engine processes are the template's children, so it signals and
//! reaps them for the zygote (`zygote.sb` allows signals to children only).
//! When the zygote's end of the socket closes (it exits, or is killed), the
//! template kills and reaps every engine process it has left and exits.
use std::{
    io,
    os::fd::{AsRawFd, FromRawFd, OwnedFd, RawFd},
};

const SPAWN: u32 = 1;
const KILL: u32 = 2;
const REAP: u32 = 3;
const RECORD: usize = 16;

/// The zygote's handle on the template process.
pub struct Template {
    control: Option<OwnedFd>,
    pid: libc::pid_t,
}

impl Template {
    /// Fork the template. `close`: descriptors of the caller the template and
    /// its engine processes must not hold (Node's socket). The caller must
    /// have one thread (the zygote checks), so the template inherits no lock
    /// another thread held. `entry` runs in each engine process: its socket
    /// and slot in, its exit code out.
    pub fn start(close: &[RawFd], entry: impl Fn(OwnedFd, usize) -> i32) -> io::Result<Self> {
        let (ours, theirs) = stream_pair()?;
        // SAFETY: the caller is single-threaded (see above).
        let pid = unsafe { libc::fork() };
        if pid < 0 {
            return Err(io::Error::last_os_error());
        }
        if pid == 0 {
            for &fd in close.iter().chain([&ours.as_raw_fd()]) {
                // SAFETY: closing a descriptor this copy of the process owns
                // (not dropped: this process ends in _exit).
                unsafe { libc::close(fd) };
            }
            serve(theirs, &entry);
            // SAFETY: end the template without unwinding into the caller.
            unsafe { libc::_exit(0) }
        }
        drop(theirs);
        Ok(Self {
            control: Some(ours),
            pid,
        })
    }
    #[cfg(test)]
    pub fn pid(&self) -> libc::pid_t {
        self.pid
    }
    /// A new engine process for `slot`: the zygote's end of its socket and
    /// its pid.
    pub fn spawn(&mut self, slot: usize) -> io::Result<(OwnedFd, libc::pid_t)> {
        let (ours, theirs) = super::conn::pair()?;
        let pid = self.command(SPAWN, slot as u32, 0, Some(theirs.as_raw_fd()))?;
        Ok((ours, pid))
    }
    /// SIGKILL engine process `pid` (it is reaped later, `reap`).
    pub fn kill(&mut self, pid: libc::pid_t) -> io::Result<()> {
        self.command(KILL, 0, pid, None).map(|_| ())
    }
    /// SIGKILL engine process `pid` if it still runs, and how it ended.
    pub fn reap(&mut self, pid: libc::pid_t) -> io::Result<String> {
        let status = self.command(REAP, 0, pid, None)?;
        Ok(if libc::WIFSIGNALED(status) {
            format!("signal {}", libc::WTERMSIG(status))
        } else {
            format!("exit {}", libc::WEXITSTATUS(status))
        })
    }
    /// End the template: it kills and reaps every engine process it has
    /// left, then exits; wait for that.
    pub fn stop(&mut self) {
        if self.control.take().is_some() {
            let mut status = 0;
            // SAFETY: a live out-int; the template is this process's child.
            while unsafe { libc::waitpid(self.pid, &mut status, 0) } < 0
                && io::Error::last_os_error().kind() == io::ErrorKind::Interrupted
            {}
        }
    }
    /// One command and its answer (a pid or wait status; errno on failure).
    fn command(&mut self, op: u32, slot: u32, pid: i32, fd: Option<RawFd>) -> io::Result<i32> {
        let control = self
            .control
            .as_ref()
            .ok_or_else(|| io::Error::other("HVF engine template stopped"))?
            .as_raw_fd();
        let mut b = [0u8; RECORD];
        b[0..4].copy_from_slice(&op.to_le_bytes());
        b[4..8].copy_from_slice(&slot.to_le_bytes());
        b[8..12].copy_from_slice(&pid.to_le_bytes());
        send(control, &b, fd)?;
        let (answer, _) =
            recv(control)?.ok_or_else(|| io::Error::other("HVF engine template exited"))?;
        let (value, errno) = (i32_at(&answer, 0), i32_at(&answer, 4));
        if errno != 0 {
            return Err(io::Error::from_raw_os_error(errno));
        }
        Ok(value)
    }
}
impl Drop for Template {
    fn drop(&mut self) {
        self.stop();
    }
}

fn i32_at(b: &[u8], at: usize) -> i32 {
    i32::from_le_bytes(b[at..at + 4].try_into().unwrap())
}

/// The template's loop: one command at a time until the zygote's end closes.
fn serve(control: OwnedFd, entry: &impl Fn(OwnedFd, usize) -> i32) {
    let fd = control.as_raw_fd();
    // Engine processes forked and not yet reaped.
    let mut live: Vec<libc::pid_t> = Vec::new();
    while let Ok(Some((b, attached))) = recv(fd) {
        let (op, slot, pid) = (
            u32::from_le_bytes(b[0..4].try_into().unwrap()),
            u32::from_le_bytes(b[4..8].try_into().unwrap()) as usize,
            i32_at(&b, 8),
        );
        let result = match (op, attached) {
            (SPAWN, Some(socket)) => spawn(fd, socket, slot, entry).inspect(|&p| live.push(p)),
            // Only its own engine processes: never another pid.
            (KILL | REAP, None) if live.contains(&pid) => {
                // SAFETY: a child of this process that has not been reaped.
                unsafe { libc::kill(pid, libc::SIGKILL) };
                if op == REAP {
                    live.retain(|&p| p != pid);
                    Ok(wait(pid))
                } else {
                    Ok(0)
                }
            }
            _ => Err(io::Error::from_raw_os_error(libc::EINVAL)),
        };
        let mut answer = [0u8; RECORD];
        match result {
            Ok(v) => answer[0..4].copy_from_slice(&v.to_le_bytes()),
            Err(e) => {
                let errno = e.raw_os_error().unwrap_or(libc::EIO);
                answer[4..8].copy_from_slice(&errno.to_le_bytes());
            }
        }
        if send(fd, &answer, None).is_err() {
            break;
        }
    }
    for pid in live {
        // SAFETY: a child of this process that has not been reaped.
        unsafe { libc::kill(pid, libc::SIGKILL) };
        wait(pid);
    }
}
/// Fork an engine process for `slot` on `socket` (closed here afterwards).
fn spawn(
    control: RawFd,
    socket: OwnedFd,
    slot: usize,
    entry: &impl Fn(OwnedFd, usize) -> i32,
) -> io::Result<i32> {
    // The template never starts a thread; fork needs exactly one.
    if super::zygote::threads()? != 1 {
        return Err(io::Error::from_raw_os_error(libc::EDEADLK));
    }
    // SAFETY: fork in a single-threaded process (checked above).
    let pid = unsafe { libc::fork() };
    if pid < 0 {
        return Err(io::Error::last_os_error());
    }
    if pid == 0 {
        // SAFETY: the template's control socket is not the engine's.
        unsafe { libc::close(control) };
        let code = entry(socket, slot);
        // SAFETY: end the engine process without unwinding into the template.
        unsafe { libc::_exit(code) }
    }
    Ok(pid)
}
/// Wait for a child; its raw wait status.
fn wait(pid: libc::pid_t) -> i32 {
    let mut status = 0;
    loop {
        // SAFETY: a live out-int; pid is this process's child.
        let r = unsafe { libc::waitpid(pid, &mut status, 0) };
        if r == pid {
            return status;
        }
        if r < 0 && io::Error::last_os_error().kind() != io::ErrorKind::Interrupted {
            return status;
        }
    }
}

/// A blocking AF_UNIX stream pair for commands.
fn stream_pair() -> io::Result<(OwnedFd, OwnedFd)> {
    let mut fds = [0; 2];
    // SAFETY: fds is a live two-element out-array.
    if unsafe { libc::socketpair(libc::AF_UNIX, libc::SOCK_STREAM, 0, fds.as_mut_ptr()) } != 0 {
        return Err(io::Error::last_os_error());
    }
    // SAFETY: socketpair returned two new descriptors owned only here.
    Ok(unsafe { (OwnedFd::from_raw_fd(fds[0]), OwnedFd::from_raw_fd(fds[1])) })
}
/// The cmsg buffer for one descriptor, aligned for cmsghdr.
#[repr(C, align(8))]
struct Ancillary([u8; 64]);
/// Write one record, with `fd` attached when given.
fn send(control: RawFd, b: &[u8; RECORD], fd: Option<RawFd>) -> io::Result<()> {
    let mut iov = libc::iovec {
        iov_base: b.as_ptr() as *mut libc::c_void,
        iov_len: RECORD,
    };
    let mut space = Ancillary([0; 64]);
    // SAFETY: an all-zero msghdr is a valid empty message.
    let mut msg: libc::msghdr = unsafe { std::mem::zeroed() };
    msg.msg_iov = &mut iov;
    msg.msg_iovlen = 1;
    if let Some(fd) = fd {
        // SAFETY: CMSG_SPACE of one int is a constant computation.
        let len = unsafe { libc::CMSG_SPACE(std::mem::size_of::<RawFd>() as u32) };
        assert!(len as usize <= space.0.len());
        msg.msg_control = space.0.as_mut_ptr().cast();
        msg.msg_controllen = len;
        // SAFETY: msg_control points at `len` zeroed, aligned bytes, enough
        // for one header and one descriptor.
        unsafe {
            let c = libc::CMSG_FIRSTHDR(&msg);
            (*c).cmsg_level = libc::SOL_SOCKET;
            (*c).cmsg_type = libc::SCM_RIGHTS;
            (*c).cmsg_len = libc::CMSG_LEN(std::mem::size_of::<RawFd>() as u32);
            std::ptr::write_unaligned(libc::CMSG_DATA(c).cast::<RawFd>(), fd);
        }
    }
    loop {
        // SAFETY: msg points at live buffers for the whole call.
        let n = unsafe { libc::sendmsg(control, &msg, 0) };
        if n == RECORD as isize {
            return Ok(());
        }
        let e = io::Error::last_os_error();
        if n < 0 && e.kind() == io::ErrorKind::Interrupted {
            continue;
        }
        // A short write of 16 bytes on a blocking socket does not happen;
        // treat it as the peer going away.
        return Err(if n < 0 {
            e
        } else {
            io::Error::other("short command")
        });
    }
}
/// Read one record and the descriptor attached to it, if any. None: the
/// peer closed the socket.
fn recv(control: RawFd) -> io::Result<Option<([u8; RECORD], Option<OwnedFd>)>> {
    let mut b = [0u8; RECORD];
    let mut got = 0;
    let mut attached = None;
    while got < RECORD {
        let mut iov = libc::iovec {
            iov_base: b[got..].as_mut_ptr().cast(),
            iov_len: RECORD - got,
        };
        let mut space = Ancillary([0; 64]);
        // SAFETY: an all-zero msghdr is a valid empty message.
        let mut msg: libc::msghdr = unsafe { std::mem::zeroed() };
        msg.msg_iov = &mut iov;
        msg.msg_iovlen = 1;
        msg.msg_control = space.0.as_mut_ptr().cast();
        msg.msg_controllen = space.0.len() as _;
        // SAFETY: msg points at live buffers for the whole call.
        let n = unsafe { libc::recvmsg(control, &mut msg, 0) };
        if n < 0 {
            let e = io::Error::last_os_error();
            if e.kind() == io::ErrorKind::Interrupted {
                continue;
            }
            return Err(e);
        }
        if n == 0 {
            return Ok(None);
        }
        // SAFETY: the kernel filled msg_control with msg_controllen bytes of
        // well-formed headers; each SCM_RIGHTS payload holds descriptors.
        unsafe {
            let mut c = libc::CMSG_FIRSTHDR(&msg);
            while !c.is_null() {
                if (*c).cmsg_level == libc::SOL_SOCKET && (*c).cmsg_type == libc::SCM_RIGHTS {
                    let data = libc::CMSG_DATA(c);
                    let bytes = (*c).cmsg_len as usize - (data as usize - c as usize);
                    for k in 0..bytes / std::mem::size_of::<RawFd>() {
                        let fd = std::ptr::read_unaligned(data.cast::<RawFd>().add(k));
                        // One descriptor per record: any more are closed.
                        let fd = OwnedFd::from_raw_fd(fd);
                        if attached.is_none() {
                            attached = Some(fd);
                        }
                    }
                }
                c = libc::CMSG_NXTHDR(&msg, c);
            }
        }
        if msg.msg_flags & libc::MSG_CTRUNC != 0 {
            return Err(io::Error::other("truncated descriptor message"));
        }
        got += n as usize;
    }
    Ok(Some((b, attached)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::service::{Message, REPLY};

    unsafe extern "C" {
        static mach_task_self_: libc::mach_port_t;
        fn mach_vm_region(
            task: libc::mach_port_t,
            address: *mut u64,
            size: *mut u64,
            flavor: i32,
            info: *mut i32,
            count: *mut u32,
            object_name: *mut libc::mach_port_t,
        ) -> i32;
        fn mach_vm_read_overwrite(
            task: libc::mach_port_t,
            address: u64,
            size: u64,
            data: u64,
            outsize: *mut u64,
        ) -> i32;
    }
    /// vm_region_basic_info_64: protection first, 9 ints.
    const VM_REGION_BASIC_INFO_64: i32 = 9;

    /// 64 tenant bytes derived from `seed`, built only where needed: the
    /// seed itself never matches.
    fn sentinel(seed: u64) -> Vec<u8> {
        let mut x = seed | 1;
        (0..64)
            .map(|_| {
                x ^= x << 13;
                x ^= x >> 7;
                x ^= x << 17;
                (x >> 24) as u8
            })
            .collect()
    }
    /// Copies of `needle` in this process's writable memory (heap, stacks,
    /// data), other than `needle` itself and the scan's buffer: what a
    /// process that took over this one could read.
    fn copies(needle: &[u8]) -> u64 {
        // SAFETY: reads the process's task port, set before main.
        let task = unsafe { mach_task_self_ };
        let mut chunk = vec![0u8; 1 << 20];
        let own =
            [needle.as_ptr_range(), chunk.as_ptr_range()].map(|r| r.start as u64..r.end as u64);
        let rw = libc::VM_PROT_READ | libc::VM_PROT_WRITE;
        let (mut address, mut found) = (0u64, 0);
        loop {
            let (mut size, mut info, mut count, mut object) = (0u64, [0i32; 9], 9u32, 0);
            // SAFETY: live out-values; info holds `count` ints.
            let kr = unsafe {
                mach_vm_region(
                    task,
                    &mut address,
                    &mut size,
                    VM_REGION_BASIC_INFO_64,
                    info.as_mut_ptr(),
                    &mut count,
                    &mut object,
                )
            };
            if kr != libc::KERN_SUCCESS {
                return found;
            }
            if info[0] & rw == rw {
                // Chunks start on page boundaries; a 64-byte heap block
                // never straddles one of them.
                let end = address + size;
                let mut at = address;
                while at < end {
                    let n = (end - at).min(chunk.len() as u64);
                    let mut out = 0;
                    // SAFETY: chunk has n writable bytes; the kernel copies
                    // or fails without touching it.
                    let kr = unsafe {
                        mach_vm_read_overwrite(task, at, n, chunk.as_mut_ptr() as u64, &mut out)
                    };
                    if kr == libc::KERN_SUCCESS {
                        let mut k = 0;
                        while k + needle.len() <= out as usize {
                            // SAFETY: chunk[k..out] is initialised and live.
                            let hit = unsafe {
                                libc::memmem(
                                    chunk[k..].as_ptr().cast(),
                                    out as usize - k,
                                    needle.as_ptr().cast(),
                                    needle.len(),
                                )
                            };
                            if hit.is_null() {
                                break;
                            }
                            k = hit as usize - chunk.as_ptr() as usize;
                            let a = at + k as u64;
                            found += u64::from(!own.iter().any(|r| r.contains(&a)));
                            k += 1;
                        }
                    }
                    at += n;
                }
            }
            address += size;
        }
    }
    /// The probe each process runs: how many copies of the sentinel it
    /// holds, and its parent.
    fn report(socket: OwnedFd, seed: u64) -> i32 {
        let mut b = copies(&sentinel(seed)).to_le_bytes().to_vec();
        // SAFETY: no arguments.
        b.extend_from_slice(&unsafe { libc::getppid() }.to_le_bytes());
        let _ = super::super::conn::send(socket.as_raw_fd(), &[Message::new(REPLY, 0, 1, 1, b)]);
        0
    }
    fn read(socket: OwnedFd) -> (u64, libc::pid_t) {
        let mut c = super::super::conn::Conn::new(socket, 1);
        loop {
            if let Some(m) = c.next().unwrap() {
                return (
                    u64::from_le_bytes(m.bytes[..8].try_into().unwrap()),
                    i32_at(&m.bytes, 8),
                );
            }
            assert!(c.fill().unwrap(), "probe exited without a report");
        }
    }

    /// R1: tenant bytes that passed through the zygote after the template
    /// was forked (here: on the heap, in a freed block and in a received
    /// record) are absent from every engine process the template forks, the
    /// first and the replacements alike; a process forked from the zygote
    /// instead, as engines were before, holds them.
    #[test]
    #[ignore = "forks (make test-hvf runs it on one test thread)"]
    fn engine_processes_never_hold_tenant_bytes() {
        let mut seed = [0u8; 8];
        // SAFETY: seed has 8 writable bytes.
        assert_eq!(unsafe { libc::getentropy(seed.as_mut_ptr().cast(), 8) }, 0);
        let seed = u64::from_le_bytes(seed);
        let mut template = Template::start(&[], move |s, _| report(s, seed)).unwrap();
        // Tenant traffic, from here on.
        let tenant = std::hint::black_box(sentinel(seed));
        drop(std::hint::black_box(tenant.clone()));
        let (a, b) = super::super::conn::pair().unwrap();
        super::super::conn::send(
            a.as_raw_fd(),
            &[Message::new(REPLY, 0, 1, 1, tenant.clone())],
        )
        .unwrap();
        let mut received = super::super::conn::Conn::new(b, 1);
        assert!(received.fill().unwrap());
        let record = received.next().unwrap().unwrap();
        assert_eq!(record.bytes, tenant);
        // The control: forked from this process, it holds the bytes.
        let (ours, theirs) = super::super::conn::pair().unwrap();
        // SAFETY: the child only scans its memory, writes and exits.
        let pid = unsafe { libc::fork() };
        if pid == 0 {
            drop(ours);
            // SAFETY: end the probe without unwinding into the test harness.
            unsafe { libc::_exit(report(theirs, seed)) }
        }
        drop(theirs);
        let (held, _) = read(ours);
        wait(pid);
        assert!(held >= 2, "the probe misses bytes it holds: {held}");
        for slot in [0, 1, 0] {
            let (socket, pid) = template.spawn(slot).unwrap();
            let (held, parent) = read(socket);
            assert_eq!(template.reap(pid).unwrap(), "exit 0");
            assert_eq!(parent, template.pid());
            assert_eq!(held, 0, "slot {slot}: an engine process holds tenant bytes");
        }
        drop(record);
    }
}

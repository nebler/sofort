//! Shared deadline watchdog: one trusted process per executor, independent of Node's event loop
//! and of every VMM it guards. Replaces a per-VM interpreter process (~20–40 ms spawn each).
//!
//! stdin lines:  `add PID LIFETIME_MS` | `arm PID DEADLINE_UNIX_MS` | `del PID`
//! stdout lines: `{"ready":true}` | `{"pid":P,"armed":D}` | `{"pid":P,"timeout":true,"deadline":D,"firedAt":F,"killAt":K}`
//! Malformed input or EOF (including parent death) SIGKILLs every tracked VM. Exited VMs are
//! dropped from kernel exit notifications (pidfd / kqueue NOTE_EXIT), so a reaped-and-reused pid
//! is never signalled.
use std::{collections::HashMap, io::Write, time::{Duration, Instant, SystemTime, UNIX_EPOCH}};

struct Entry { end: Instant, deadline: f64, #[cfg(target_os = "linux")] pidfd: i32 }

fn now_ms() -> f64 { SystemTime::now().duration_since(UNIX_EPOCH).map_or(0.0, |d| d.as_secs_f64() * 1000.0) }
fn at(deadline_ms: f64) -> Instant {
    let delta = deadline_ms - now_ms();
    if delta <= 0.0 { Instant::now() } else { Instant::now() + Duration::from_secs_f64((delta / 1000.0).min(86_400.0)) }
}
fn say(line: &str) { let mut o = std::io::stdout().lock(); let _ = o.write_all(line.as_bytes()); let _ = o.write_all(b"\n"); let _ = o.flush(); }

#[cfg(target_os = "linux")]
mod os {
    pub struct Waiter;
    pub fn new() -> Waiter { Waiter }
    pub fn track(pid: i32) -> Option<i32> {
        let fd = unsafe { libc::syscall(libc::SYS_pidfd_open, pid, 0) } as i32;
        (fd >= 0).then_some(fd)
    }
    pub fn kill(pid: i32, pidfd: i32) {
        let _ = pid;
        unsafe { libc::syscall(libc::SYS_pidfd_send_signal, pidfd, libc::SIGKILL, std::ptr::null::<u8>(), 0) };
    }
    pub fn untrack(pidfd: i32) { unsafe { libc::close(pidfd) }; }
    /// Waits for stdin or any VM exit. Returns (stdin_ready, exited pidfds).
    pub fn wait(_w: &mut Waiter, pidfds: &[(i32, i32)], timeout_ms: i32) -> (bool, Vec<i32>) {
        let mut fds: Vec<libc::pollfd> = std::iter::once(0).chain(pidfds.iter().map(|p| p.1))
            .map(|fd| libc::pollfd { fd, events: libc::POLLIN, revents: 0 }).collect();
        if unsafe { libc::poll(fds.as_mut_ptr(), fds.len() as _, timeout_ms) } <= 0 { return (false, vec![]); }
        let exited = fds[1..].iter().zip(pidfds).filter(|(f, _)| f.revents != 0).map(|(_, p)| p.0).collect();
        (fds[0].revents != 0, exited)
    }
}
#[cfg(target_os = "macos")]
mod os {
    pub struct Waiter { kq: i32 }
    pub fn new() -> Waiter {
        let kq = unsafe { libc::kqueue() };
        assert!(kq >= 0, "kqueue");
        let ev = libc::kevent { ident: 0, filter: libc::EVFILT_READ, flags: libc::EV_ADD, fflags: 0, data: 0, udata: std::ptr::null_mut() };
        unsafe { libc::kevent(kq, &ev, 1, std::ptr::null_mut(), 0, std::ptr::null()) };
        Waiter { kq }
    }
    /// Registers exit notification; false if the pid is already gone.
    pub fn track(w: &Waiter, pid: i32) -> bool {
        let ev = libc::kevent { ident: pid as usize, filter: libc::EVFILT_PROC, flags: libc::EV_ADD | libc::EV_ONESHOT,
            fflags: libc::NOTE_EXIT, data: 0, udata: std::ptr::null_mut() };
        unsafe { libc::kevent(w.kq, &ev, 1, std::ptr::null_mut(), 0, std::ptr::null()) == 0 }
    }
    // Detached VMMs lead their own process group; an exited-but-unreaped leader still pins the pgid.
    pub fn kill(pid: i32) { unsafe { libc::kill(-pid, libc::SIGKILL) }; }
    /// Waits for stdin or any VM exit. Returns (stdin_ready, exited pids).
    pub fn wait(w: &mut Waiter, timeout_ms: i32) -> (bool, Vec<i32>) {
        let ts = libc::timespec { tv_sec: (timeout_ms / 1000) as _, tv_nsec: ((timeout_ms % 1000) * 1_000_000) as _ };
        let mut evs: [libc::kevent; 32] = unsafe { std::mem::zeroed() };
        let n = unsafe { libc::kevent(w.kq, std::ptr::null(), 0, evs.as_mut_ptr(), 32, if timeout_ms < 0 { std::ptr::null() } else { &ts }) };
        let (mut input, mut exited) = (false, vec![]);
        for e in &evs[..n.max(0) as usize] {
            if e.filter == libc::EVFILT_READ { input = true } else if e.filter == libc::EVFILT_PROC { exited.push(e.ident as i32) }
        }
        (input, exited)
    }
}

pub fn run() -> ! {
    let mut vms: HashMap<i32, Entry> = HashMap::new();
    let mut w = os::new();
    let (mut buf, mut chunk) = (Vec::<u8>::new(), [0u8; 4096]);
    say("{\"ready\":true}");
    let fail_closed = |vms: &mut HashMap<i32, Entry>| -> ! {
        for (pid, _e) in vms.drain() {
            #[cfg(target_os = "linux")] os::kill(pid, _e.pidfd);
            #[cfg(target_os = "macos")] os::kill(pid);
        }
        std::process::exit(0)
    };
    loop {
        // Fire expired deadlines only after draining exit notifications (below), never on a dead pid.
        let now = Instant::now();
        let expired: Vec<i32> = vms.iter().filter(|(_, e)| e.end <= now).map(|(p, _)| *p).collect();
        for pid in expired {
            let e = vms.remove(&pid).unwrap();
            let fired = now_ms();
            #[cfg(target_os = "linux")] { os::kill(pid, e.pidfd); os::untrack(e.pidfd); }
            #[cfg(target_os = "macos")] os::kill(pid);
            say(&format!("{{\"pid\":{pid},\"timeout\":true,\"deadline\":{},\"firedAt\":{fired},\"killAt\":{}}}", e.deadline, now_ms()));
        }
        let timeout = vms.values().map(|e| e.end.saturating_duration_since(Instant::now())).min()
            .map_or(-1, |d| d.as_millis().min(i32::MAX as u128) as i32 + i32::from(d.subsec_nanos() % 1_000_000 != 0));
        #[cfg(target_os = "linux")]
        let (input, exited) = { let fds: Vec<(i32, i32)> = vms.iter().map(|(p, e)| (*p, e.pidfd)).collect(); os::wait(&mut w, &fds, timeout) };
        #[cfg(target_os = "macos")]
        let (input, exited) = os::wait(&mut w, timeout);
        for pid in exited {
            if let Some(_e) = vms.remove(&pid) { #[cfg(target_os = "linux")] os::untrack(_e.pidfd); }
        }
        if !input { continue; }
        let n = unsafe { libc::read(0, chunk.as_mut_ptr().cast(), chunk.len()) };
        if n < 0 && std::io::Error::last_os_error().kind() == std::io::ErrorKind::Interrupted { continue; }
        if n <= 0 { fail_closed(&mut vms); }
        buf.extend_from_slice(&chunk[..n as usize]);
        while let Some(pos) = buf.iter().position(|&b| b == b'\n') {
            let line: Vec<u8> = buf.drain(..=pos).collect();
            let text = std::str::from_utf8(&line[..pos]).unwrap_or("");
            let f: Vec<&str> = text.split(' ').collect();
            let pid = f.get(1).and_then(|s| s.parse::<i32>().ok()).filter(|p| *p > 1);
            let num = f.get(2).and_then(|s| s.parse::<f64>().ok()).filter(|v| v.is_finite() && *v > 0.0);
            match (f.first().copied(), pid, num, f.len()) {
                (Some("add"), Some(pid), Some(life), 3) if !vms.contains_key(&pid) => {
                    let end = Instant::now() + Duration::from_secs_f64((life / 1000.0).min(86_400.0));
                    let deadline = now_ms() + life;
                    #[cfg(target_os = "linux")]
                    match os::track(pid) { Some(pidfd) => { vms.insert(pid, Entry { end, deadline, pidfd }); } None => {} }
                    #[cfg(target_os = "macos")]
                    if os::track(&w, pid) { vms.insert(pid, Entry { end, deadline }); }
                }
                (Some("arm"), Some(pid), Some(deadline), 3) => {
                    if let Some(e) = vms.get_mut(&pid) { e.end = e.end.min(at(deadline)); e.deadline = deadline; }
                    // Acknowledge even if the VM already exited: the executor then observes its close.
                    say(&format!("{{\"pid\":{pid},\"armed\":{deadline}}}"));
                }
                (Some("del"), Some(pid), None, 2) => {
                    if let Some(_e) = vms.remove(&pid) { #[cfg(target_os = "linux")] os::untrack(_e.pidfd); }
                }
                _ => fail_closed(&mut vms),
            }
        }
        if buf.len() > 4096 { fail_closed(&mut vms); }
    }
}

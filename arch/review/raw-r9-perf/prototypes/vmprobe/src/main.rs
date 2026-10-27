//! R9 per-phase probe for the process-per-VM path (measurement only).
//!
//! r9-vmprobe MODE VMM IMAGE PROFILE|- N [CASE]
//!   exec      spawn VMM with an unknown flag (process + loader + Rust init + exit)
//!   prebuild  spawn with --wait-go; wait for WAIT_GO (argument parse, seed,
//!             sandbox prepare+apply), then EOF -> exit
//!   ready     spawn; wait for {"t":"ready"}; snapshot threads/footprint; SIGKILL
//!   full      ready, RUN CASE (tools answered immediately), done, EOF, reap
//! One JSON line per sample on stdout. All children are reaped with wait4.
use std::io::{Read, Write};
use std::os::fd::AsRawFd;
use std::process::{Command, Stdio};
use std::time::Instant;

fn tv(t: libc::timeval) -> u64 {
    t.tv_sec as u64 * 1_000_000 + t.tv_usec as u64
}

#[cfg(target_os = "macos")]
fn threads(pid: i32) -> (String, u64) {
    let mut ids = vec![0u64; 256];
    // SAFETY: buffer is writable for its byte size.
    let n = unsafe {
        libc::proc_pidinfo(pid, 6, 0, ids.as_mut_ptr().cast(), (ids.len() * 8) as i32)
    };
    let mut out = Vec::new();
    for &tid in ids.iter().take((n.max(0) as usize) / 8) {
        // SAFETY: zeroed POD out-parameter of the declared size.
        let mut info: libc::proc_threadinfo = unsafe { std::mem::zeroed() };
        let sz = std::mem::size_of::<libc::proc_threadinfo>() as i32;
        // SAFETY: info is writable for sz bytes.
        let r = unsafe { libc::proc_pidinfo(pid, libc::PROC_PIDTHREADINFO, tid, (&mut info as *mut libc::proc_threadinfo).cast(), sz) };
        if r != sz {
            continue;
        }
        let name: String = info.pth_name.iter().take_while(|c| **c != 0).map(|c| *c as u8 as char).collect();
        out.push(format!("{{\"name\":{:?},\"user_ns\":{},\"sys_ns\":{}}}", name, info.pth_user_time, info.pth_system_time));
    }
    // SAFETY: zeroed POD out-parameter.
    let mut ri: libc::rusage_info_v4 = unsafe { std::mem::zeroed() };
    // SAFETY: proc_pid_rusage writes one rusage_info_v4 for flavor 4.
    let r = unsafe { libc::proc_pid_rusage(pid, libc::RUSAGE_INFO_V4, (&mut ri as *mut libc::rusage_info_v4).cast()) };
    let fp = if r == 0 { ri.ri_phys_footprint } else { 0 };
    (format!("[{}]", out.join(",")), fp)
}
#[cfg(not(target_os = "macos"))]
fn threads(pid: i32) -> (String, u64) {
    // Linux: per-thread utime/stime (clock ticks) from /proc.
    let mut out = Vec::new();
    if let Ok(dir) = std::fs::read_dir(format!("/proc/{pid}/task")) {
        for e in dir.flatten() {
            let p = e.path();
            let comm = std::fs::read_to_string(p.join("comm")).unwrap_or_default();
            let stat = std::fs::read_to_string(p.join("stat")).unwrap_or_default();
            let rest = stat.rsplit_once(')').map(|x| x.1).unwrap_or("");
            let f: Vec<&str> = rest.split_whitespace().collect();
            if f.len() > 41 {
                // fields after ')' start at 3: utime=14 stime=15 guest=43
                out.push(format!("{{\"name\":{:?},\"utime_ticks\":{},\"stime_ticks\":{},\"guest_ticks\":{}}}", comm.trim(), f[11], f[12], f[40]));
            }
        }
    }
    let rss = std::fs::read_to_string(format!("/proc/{pid}/smaps_rollup")).unwrap_or_default();
    let pd: u64 = rss
        .lines()
        .filter(|l| l.starts_with("Private_Dirty:"))
        .filter_map(|l| l.split_whitespace().nth(1)?.parse::<u64>().ok())
        .sum();
    (format!("[{}]", out.join(",")), pd * 1024)
}

struct Child {
    c: std::process::Child,
    out: Vec<u8>,
    err: Vec<u8>,
}
impl Child {
    fn pump(&mut self, ms: i32) {
        let o = self.c.stdout.as_ref().map(|s| s.as_raw_fd()).unwrap_or(-1);
        let e = self.c.stderr.as_ref().map(|s| s.as_raw_fd()).unwrap_or(-1);
        let mut fds = [
            libc::pollfd { fd: o, events: libc::POLLIN, revents: 0 },
            libc::pollfd { fd: e, events: libc::POLLIN, revents: 0 },
        ];
        // SAFETY: two valid pollfd entries.
        unsafe { libc::poll(fds.as_mut_ptr(), 2, ms) };
        let mut buf = [0u8; 65536];
        if fds[0].revents != 0 {
            if let Some(s) = self.c.stdout.as_mut() {
                match s.read(&mut buf) {
                    Ok(0) | Err(_) => self.c.stdout = None,
                    Ok(n) => self.out.extend_from_slice(&buf[..n]),
                }
            }
        }
        if fds[1].revents != 0 {
            if let Some(s) = self.c.stderr.as_mut() {
                match s.read(&mut buf) {
                    Ok(0) | Err(_) => self.c.stderr = None,
                    Ok(n) => self.err.extend_from_slice(&buf[..n]),
                }
            }
        }
    }
    fn line(&mut self, deadline: Instant) -> Option<String> {
        loop {
            if let Some(p) = self.out.iter().position(|b| *b == b'\n') {
                let l: Vec<u8> = self.out.drain(..=p).collect();
                if l.first() == Some(&30) {
                    continue; // record channel, not a frame
                }
                return Some(String::from_utf8_lossy(&l).trim().to_string());
            }
            if Instant::now() > deadline || (self.c.stdout.is_none() && self.c.stderr.is_none()) {
                return None;
            }
            self.pump(50);
        }
    }
    fn wait4(&mut self, kill: bool) -> (i32, libc::rusage) {
        let pid = self.c.id() as i32;
        if kill {
            // SAFETY: our own unreaped child.
            unsafe { libc::kill(pid, libc::SIGKILL) };
        }
        // SAFETY: zeroed out-parameters for wait4.
        let mut ru: libc::rusage = unsafe { std::mem::zeroed() };
        let mut st = 0;
        loop {
            // SAFETY: valid pointers; pid is our child.
            let r = unsafe { libc::wait4(pid, &mut st, 0, &mut ru) };
            if r == pid {
                return (st, ru);
            }
        }
    }
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let (mode, vmm, image, profile) = (a[1].as_str(), &a[2], &a[3], a[4].as_str());
    let n: usize = a[5].parse().unwrap();
    let case = a.get(6).map(String::as_str).unwrap_or("return2");
    let code = match case {
        "return2" => r#"{"t":"run","code":"return 2;","ns":{"test":["echo"]}}"#,
        "one_tool" => r#"{"t":"run","code":"return await test.echo(2);","ns":{"test":["echo"]}}"#,
        _ => panic!("case"),
    };
    let mut lines = Vec::new();
    for i in 0..n {
        let mut cmd = Command::new(vmm);
        cmd.env_clear().env("PATH", "/usr/bin:/bin");
        if mode == "exec" {
            cmd.arg("--r9-no-such-flag");
        } else {
            cmd.args(["--image", image]);
            if profile != "-" {
                cmd.args(["--sandbox-profile", profile]);
            }
            if mode == "prebuild" {
                cmd.arg("--wait-go");
            }
        }
        cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
        let t0 = Instant::now();
        let mut ch = Child { c: cmd.spawn().expect("spawn"), out: Vec::new(), err: Vec::new() };
        let pid = ch.c.id() as i32;
        let deadline = t0 + std::time::Duration::from_secs(10);
        let mut marks = Vec::new();
        let mut thr = ("[]".to_string(), 0);
        let mut kill = false;
        match mode {
            "exec" => {}
            "prebuild" => {
                while !ch.err.windows(7).any(|w| w == b"WAIT_GO") {
                    assert!(Instant::now() < deadline, "no WAIT_GO: {}", String::from_utf8_lossy(&ch.err));
                    ch.pump(50);
                }
                marks.push(("wait_go", t0.elapsed().as_nanos()));
                thr = threads(pid);
                drop(ch.c.stdin.take());
            }
            "ready" | "full" => {
                let l = ch.line(deadline).unwrap_or_else(|| panic!("no ready: {}", String::from_utf8_lossy(&ch.err)));
                assert!(l.contains("\"ready\""), "{l}");
                marks.push(("ready", t0.elapsed().as_nanos()));
                if mode == "ready" {
                    thr = threads(pid);
                    kill = true;
                } else {
                    let si = ch.c.stdin.as_mut().unwrap();
                    si.write_all(code.as_bytes()).unwrap();
                    si.write_all(b"\n").unwrap();
                    loop {
                        let l = ch.line(deadline).expect("no done");
                        if l.contains("\"done\"") {
                            break;
                        }
                        if l.contains("\"call\"") {
                            let id: String = l.split("\"id\":").nth(1).unwrap().chars().take_while(|c| c.is_ascii_digit()).collect();
                            let si = ch.c.stdin.as_mut().unwrap();
                            si.write_all(format!("{{\"t\":\"ret\",\"id\":{id},\"ok\":2}}\n").as_bytes()).unwrap();
                        }
                    }
                    marks.push(("done", t0.elapsed().as_nanos()));
                    thr = threads(pid);
                    drop(ch.c.stdin.take());
                    // Let the VMM exit on its own; kill after 2 s as a fallback.
                    let exit_deadline = Instant::now() + std::time::Duration::from_secs(2);
                    while ch.c.stdout.is_some() && Instant::now() < exit_deadline {
                        ch.pump(20);
                        ch.out.clear();
                    }
                    kill = ch.c.stdout.is_some();
                }
            }
            _ => panic!("mode"),
        }
        let (st, ru) = ch.wait4(kill);
        let reaped = t0.elapsed().as_nanos();
        let m: Vec<String> = marks.iter().map(|(k, v)| format!("\"{k}_ns\":{v}")).collect();
        lines.push(format!(
            "{{\"mode\":\"{mode}\",\"case\":\"{case}\",\"i\":{i},{}{}\"reaped_ns\":{reaped},\"status\":{st},\"killed\":{kill},\"utime_us\":{},\"stime_us\":{},\"maxrss\":{},\"minflt\":{},\"majflt\":{},\"nvcsw\":{},\"nivcsw\":{},\"footprint_or_private_dirty\":{},\"threads\":{}}}",
            m.join(","),
            if m.is_empty() { "" } else { "," },
            tv(ru.ru_utime),
            tv(ru.ru_stime),
            ru.ru_maxrss,
            ru.ru_minflt,
            ru.ru_majflt,
            ru.ru_nvcsw,
            ru.ru_nivcsw,
            thr.1,
            thr.0
        ));
    }
    for l in lines {
        println!("{l}");
    }
}

//! `real confine SNAPSHOT_BASE [--allow-degraded]`: the Linux confinement
//! self-test (the counterpart of `hvf confine`). Probe processes forked from
//! this single-threaded one each run `return 2` on a one-slot pool, then try
//! one thing the shard never needs:
//! - `unconfined`: the control, no confinement; every operation is allowed,
//!   so a denial below is the confinement's, not this host's;
//! - `files_closed`: namespaces, no_new_privs and Landlock, no seccomp: file
//!   opens, exec, TCP and signals outside the process are refused (errno);
//! - one fully confined process per operation (`ipc_service::confined_pool`,
//!   as `real ipc`): each operation kills it (SIGSYS).
//!
//! `real confine --native REQUEST TOOL=SNAPSHOT_BASE... [--allow-degraded]`:
//! the same probes on the native worker (`kvm::native::confined`, as `real
//! native-worker`), whose guest run is the native request in the file
//! REQUEST (a JNR frame payload, without its length) on those profiles.
//!
//! One JSON row per probe; exits 1 unless every row is as expected, or a
//! layer is degraded without `--allow-degraded`.
use jitk_shard::{
    confine::{Confinement, Signals},
    inputs, ipc_service,
    kvm::{self, Kvm, ResetPolicy, Snapshot, native},
    owner::{Event, Job, Mode, Pool},
};
use std::{
    io::{self, Read, Write},
    mem::ManuallyDrop,
    net::{Ipv4Addr, TcpListener, TcpStream},
    os::fd::{AsRawFd, FromRawFd, OwnedFd},
    time::{Duration, Instant},
};

/// What a probe tries after its guest run.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Op {
    OpenFile,
    TcpConnect,
    Exec,
    Ptrace,
    SignalParent,
    SetUid,
    Ioctl,
}
impl Op {
    const ALL: [Op; 7] = [
        Op::OpenFile,
        Op::TcpConnect,
        Op::Exec,
        Op::SignalParent,
        Op::SetUid,
        Op::Ioctl,
        // Last: the control stays traced by this process afterwards.
        Op::Ptrace,
    ];
    fn name(self) -> &'static str {
        match self {
            Op::OpenFile => "open_etc_hosts",
            Op::TcpConnect => "tcp_connect_localhost",
            Op::Exec => "exec_true",
            Op::Ptrace => "ptrace_traceme",
            Op::SignalParent => "signal_parent",
            Op::SetUid => "setuid",
            Op::Ioctl => "ioctl_fionread",
        }
    }
    /// The operation's errno, or 0 when it succeeded.
    fn attempt(self, port: u16) -> i32 {
        let errno = |ok: bool| {
            if ok {
                0
            } else {
                io::Error::last_os_error().raw_os_error().unwrap_or(-1)
            }
        };
        let of = |r: io::Result<()>| r.err().map_or(0, |e| e.raw_os_error().unwrap_or(-1));
        match self {
            Op::OpenFile => of(std::fs::File::open("/etc/hosts").map(drop)),
            Op::TcpConnect => of(TcpStream::connect((Ipv4Addr::LOCALHOST, port)).map(drop)),
            Op::Exec => of(std::process::Command::new("/bin/true").status().map(drop)),
            // SAFETY: TRACEME takes no pointers; this process ends right after.
            Op::Ptrace => errno(unsafe { libc::ptrace(libc::PTRACE_TRACEME, 0, 0, 0) } == 0),
            // SAFETY: signal 0 only checks permission.
            Op::SignalParent => errno(unsafe { libc::kill(libc::getppid(), 0) } == 0),
            // SAFETY: setting the real uid to itself takes scalars only.
            Op::SetUid => errno(unsafe { libc::setuid(libc::getuid()) } == 0),
            Op::Ioctl => {
                let mut fds = [0; 2];
                // SAFETY: fds is a writable pair (left open: the probe ends).
                if unsafe { libc::pipe(fds.as_mut_ptr()) } != 0 {
                    return errno(false);
                }
                let mut n: libc::c_int = 0;
                // SAFETY: FIONREAD writes one int to the live `n`.
                errno(unsafe { libc::ioctl(fds[0], libc::FIONREAD, &mut n) } == 0)
            }
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Probe {
    Unconfined,
    FilesClosed,
    Confined(Op),
}
impl Probe {
    fn name(self) -> String {
        match self {
            Probe::Unconfined => "unconfined".into(),
            Probe::FilesClosed => "files_closed".into(),
            Probe::Confined(op) => format!("confined:{}", op.name()),
        }
    }
}

/// `return 2` on slot 0. Polls: a confined process may not wait4 on its
/// watchdog, which `Pool::recv` does.
fn guest_run(pool: &mut Pool) -> Result<(), String> {
    pool.start(
        0,
        Job {
            generation: 2,
            source: include_str!("../../../fixtures/return2.js").into(),
            mode: Mode::Run,
            deadline_ns: kvm::monotonic_ns() + 5_000_000_000,
            canary: false,
            entry: None,
        },
    );
    let until = Instant::now() + Duration::from_secs(10);
    while Instant::now() < until {
        match pool.try_recv() {
            Some(Event::Done { completion, .. }) => {
                return match completion.result {
                    Ok(text) if text == "{\"ok\":2}" => Ok(()),
                    other => Err(format!("return 2 gave {other:?}")),
                };
            }
            Some(_) => {}
            None => std::thread::sleep(Duration::from_millis(1)),
        }
    }
    Err("return 2 did not finish".into())
}

/// What the probes confine: the IPC shard or the native worker.
pub enum Target {
    Ipc(String),
    Native {
        request: Vec<u8>,
        profiles: Vec<String>,
    },
}

/// The native worker set up as `who` (as `real native-worker` when
/// confined), then one request; its worker status must be success.
fn native_run(
    confinement: &mut Confinement,
    who: Probe,
    request: &[u8],
    profiles: &[String],
) -> Result<(), String> {
    let run = inputs::decode(request).map_err(str::to_string)?;
    let e = |e: std::io::Error| e.to_string();
    // Never dropped: a confined worker ends with _exit like the pool above.
    let mut worker = ManuallyDrop::new(match who {
        Probe::Unconfined => native::Worker::load(profiles).map_err(e)?,
        Probe::FilesClosed => {
            confinement.enter_namespaces();
            let worker = native::Worker::load(profiles).map_err(e)?;
            confinement
                .close_files(Signals::OwnProcess)
                .map_err(|e| e.to_string())?;
            worker
        }
        Probe::Confined(_) => native::confined(confinement, profiles).map_err(e)?,
    });
    worker.run(&run, 2).map(drop)
}

/// The probe process: confine, run the guest, try the operations; the row
/// is written before each attempt, so a kill still leaves what came before.
fn probe(target: &Target, who: Probe, port: u16, out: &mut std::fs::File) -> Result<(), String> {
    let mut confinement = Confinement::new();
    let base = match target {
        Target::Ipc(base) => base,
        Target::Native { request, profiles } => {
            native_run(&mut confinement, who, request, profiles)?;
            return attempts(&confinement, who, port, out);
        }
    };
    let snapshot = Snapshot::load_identified(base).map_err(|e| e.to_string())?;
    // Never shut the pool down: a confined process may not signal or reap
    // its watchdog, and a traced one (TRACEME) would stop at the SIGCHLD.
    // The probe ends with _exit and the watchdog follows (it polls this
    // process's pidfd).
    let mut pool = ManuallyDrop::new(match who {
        Probe::Unconfined => Pool::new(Kvm::new(), snapshot, 1, 1),
        Probe::FilesClosed => {
            confinement.enter_namespaces();
            let prepared = Pool::prepare(Kvm::new(), snapshot, 1, 1);
            confinement
                .close_files(Signals::OwnProcess)
                .map_err(|e| e.to_string())?;
            prepared.start(None, ResetPolicy::default())
        }
        Probe::Confined(_) => {
            confinement.enter_namespaces();
            ipc_service::confined_pool(&mut confinement, snapshot, 1, 1, None, Default::default())
                .map_err(|e| e.to_string())?
        }
    });
    guest_run(&mut pool)?;
    attempts(&confinement, who, port, out)
}

/// After a guest run: the row, then each operation of `who`.
fn attempts(
    confinement: &Confinement,
    who: Probe,
    port: u16,
    out: &mut std::fs::File,
) -> Result<(), String> {
    let report = confinement.report().json();
    let ops: &[Op] = match who {
        Probe::Confined(op) => &[op][..],
        _ => &Op::ALL[..],
    };
    let mut fields = vec![
        format!("\"probe\":{:?}", who.name()),
        format!("\"confinement\":{report}"),
        "\"guest\":true".into(),
    ];
    for &op in ops {
        let _ = writeln!(out, "{{{}}}", fields.join(","));
        fields.push(format!("\"{}\":{}", op.name(), op.attempt(port)));
    }
    let _ = writeln!(out, "{{{}}}", fields.join(","));
    Ok(())
}

/// Fork one probe; returns its last row and how it ended.
fn run_probe(target: &Target, who: Probe, port: u16) -> io::Result<(String, String)> {
    let mut fds = [0; 2];
    // SAFETY: fds is a writable pair; both ends are adopted below.
    if unsafe { libc::pipe2(fds.as_mut_ptr(), libc::O_CLOEXEC) } != 0 {
        return Err(io::Error::last_os_error());
    }
    // SAFETY: fresh descriptors from pipe2, each owned once.
    let (read_end, write_end) =
        unsafe { (OwnedFd::from_raw_fd(fds[0]), OwnedFd::from_raw_fd(fds[1])) };
    // SAFETY: this process is single-threaded (it only forks and waits);
    // the child confines itself and ends with _exit.
    let pid = unsafe { libc::fork() };
    if pid < 0 {
        return Err(io::Error::last_os_error());
    }
    if pid == 0 {
        drop(read_end);
        let mut out = std::fs::File::from(write_end);
        if let Err(e) = probe(target, who, port, &mut out) {
            let _ = writeln!(out, "{{\"probe\":{:?},\"error\":{:?}}}", who.name(), e);
        }
        // SAFETY: end the probe without unwinding or running destructors.
        unsafe { libc::_exit(0) }
    }
    drop(write_end);
    let text = read_until_closed(read_end, pid)?;
    let mut status = 0;
    // SAFETY: waits for this process's own child.
    unsafe { libc::waitpid(pid, &mut status, 0) };
    let ended = if libc::WIFSIGNALED(status) {
        match libc::WTERMSIG(status) {
            libc::SIGSYS => "killed (SIGSYS)".to_string(),
            s => format!("signal {s}"),
        }
    } else {
        format!("exit {}", libc::WEXITSTATUS(status))
    };
    let last = text.lines().last().unwrap_or("{}").to_string();
    Ok((last, ended))
}

/// A probe's rows, up to its exit; a probe that is still going after
/// PROBE_TIMEOUT is killed (and its rows end where it stopped).
fn read_until_closed(read_end: OwnedFd, pid: libc::pid_t) -> io::Result<String> {
    const PROBE_TIMEOUT: Duration = Duration::from_secs(30);
    let until = Instant::now() + PROBE_TIMEOUT;
    let mut file = std::fs::File::from(read_end);
    let mut bytes = Vec::new();
    loop {
        let left = until.saturating_duration_since(Instant::now());
        let mut fd = libc::pollfd {
            fd: file.as_raw_fd(),
            events: libc::POLLIN,
            revents: 0,
        };
        // SAFETY: one live pollfd for the call.
        if unsafe { libc::poll(&mut fd, 1, left.as_millis() as i32) } <= 0 {
            // SAFETY: our own unreaped child.
            unsafe { libc::kill(pid, libc::SIGKILL) };
            eprintln!("real confine: probe {pid} timed out; killed");
            break;
        }
        let mut chunk = [0; 4096];
        match file.read(&mut chunk)? {
            0 => break,
            n => bytes.extend_from_slice(&chunk[..n]),
        }
    }
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

/// The value of `"key":` in a flat row (numbers and `true` only).
fn field<'a>(row: &'a str, key: &str) -> Option<&'a str> {
    let at = row.find(&format!("\"{key}\":"))? + key.len() + 3;
    let rest = &row[at..];
    Some(&rest[..rest.find([',', '}']).unwrap_or(rest.len())])
}

pub fn run(target: &Target, allow_degraded: bool) -> Result<(), Box<dyn std::error::Error>> {
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0))?;
    let port = listener.local_addr()?.port();
    let mut failures = Vec::new();
    let mut probes = vec![Probe::Unconfined, Probe::FilesClosed];
    probes.extend(Op::ALL.map(Probe::Confined));
    for who in probes {
        let (row, ended) = run_probe(target, who, port)?;
        println!("{{\"row\":{row},\"ended\":{ended:?}}}");
        if field(&row, "guest") != Some("true") {
            failures.push(format!("{}: no guest run", who.name()));
            continue;
        }
        if !allow_degraded && row.contains("\"degraded\":{\"") {
            failures.push(format!("{}: a confinement layer is degraded", who.name()));
        }
        let mut expect = |op: Op, ok: bool, what: &str| {
            if !ok {
                failures.push(format!("{}: {} should be {what}", who.name(), op.name()));
            }
        };
        match who {
            Probe::Unconfined => {
                for op in Op::ALL {
                    expect(op, field(&row, op.name()) == Some("0"), "allowed");
                }
            }
            Probe::FilesClosed => {
                for op in [Op::OpenFile, Op::TcpConnect, Op::Exec, Op::SignalParent] {
                    let refused = field(&row, op.name()).is_some_and(|e| e != "0");
                    expect(op, refused, "refused");
                }
            }
            Probe::Confined(op) => {
                let killed = ended == "killed (SIGSYS)" && field(&row, op.name()).is_none();
                expect(op, killed, "killed by seccomp");
            }
        }
    }
    drop(listener);
    if failures.is_empty() {
        println!("{{\"confine\":\"ok\"}}");
        Ok(())
    } else {
        Err(failures.join("; ").into())
    }
}

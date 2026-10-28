// Shared-tree launcher for the Linux oracle (static aarch64 musl, mounted into the
// unchanged jitk-oracle:08 image). usage: oracle-root ROOT PROGRAM ARG0 [ARG...]
// Opens PROGRAM, makes ROOT (the materialised jitk archive, bind-mounted
// read-only) the process root and cwd, drops to uid/gid 65534 with no
// supplementary groups, then executes PROGRAM through its descriptor. The payload
// therefore sees exactly the guest's file tree: no /payload, /tmp, /proc or /dev.
// The container keeps --cap-drop ALL except SYS_CHROOT/SETUID/SETGID and
// no-new-privileges. Exit 125-127 are launcher failures (oracle-profile rejects).
//
// no_std/no_main on the target's self-contained musl: musl's C start calls
// `main` directly, so no Rust runtime setup runs (std would set SIGPIPE to
// SIG_IGN, which execveat keeps for the payload). The calls, their order and
// the messages are the former oracle-root.c's.
#![no_std]
#![no_main]

use core::ffi::{c_char, c_int, c_long, c_void};

const O_PATH: c_int = 0o10000000;
const O_CLOEXEC: c_int = 0o2000000;
const AT_EMPTY_PATH: c_long = 0x1000;
const SYS_EXECVEAT: c_long = 281; // aarch64 (asm-generic unistd)
const NOBODY: u32 = 65534;

#[link(name = "c", kind = "static")]
unsafe extern "C" {
    static environ: *const *const c_char;
    static stderr: *mut c_void;
    fn open(path: *const c_char, flags: c_int, ...) -> c_int;
    fn chroot(path: *const c_char) -> c_int;
    fn chdir(path: *const c_char) -> c_int;
    fn setgroups(size: usize, list: *const u32) -> c_int;
    fn setgid(gid: u32) -> c_int;
    fn setuid(uid: u32) -> c_int;
    fn getuid() -> u32;
    fn geteuid() -> u32;
    fn getgid() -> u32;
    fn getegid() -> u32;
    fn syscall(number: c_long, ...) -> c_long;
    fn perror(message: *const c_char);
    fn fputs(text: *const c_char, stream: *mut c_void) -> c_int;
    fn abort() -> !;
}

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    // SAFETY: abort has no preconditions.
    unsafe { abort() }
}

#[unsafe(no_mangle)]
pub extern "C" fn main(argc: c_int, argv: *const *const c_char) -> c_int {
    // SAFETY: musl passes argc/argv as for a C main (argv[argc] is NULL) and
    // every string is a NUL-terminated literal; the calls are plain libc calls.
    unsafe {
        if argc < 4 {
            fputs(c"usage: oracle-root ROOT PROGRAM ARG0 [ARG...]\n".as_ptr(), stderr);
            return 125;
        }
        let fd = open(*argv.add(2), O_PATH | O_CLOEXEC);
        if fd < 0 {
            perror(c"oracle-root: open program".as_ptr());
            return 126;
        }
        if chroot(*argv.add(1)) != 0 || chdir(c"/".as_ptr()) != 0 {
            perror(c"oracle-root: chroot".as_ptr());
            return 126;
        }
        if setgroups(0, core::ptr::null()) != 0 || setgid(NOBODY) != 0 || setuid(NOBODY) != 0 {
            perror(c"oracle-root: drop".as_ptr());
            return 126;
        }
        if getuid() != NOBODY || geteuid() != NOBODY || getgid() != NOBODY || getegid() != NOBODY {
            fputs(c"oracle-root: still privileged\n".as_ptr(), stderr);
            return 126;
        }
        syscall(SYS_EXECVEAT, fd as c_long, c"".as_ptr(), argv.add(3), environ, AT_EMPTY_PATH);
        perror(c"oracle-root: execveat".as_ptr());
        127
    }
}

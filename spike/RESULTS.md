# Blocker spikes (2026-10-24, M4 Pro, macOS 26.6.1)

## 1. QuickJS syscall footprint (static musl aarch64, Alpine 3.22 in Docker, strace -f)
- hello.js: 12 unique syscalls (70 calls)
- code-mode script (2 JSON-line tool calls over stdin/stdout): 15 unique (93 calls)
  union: brk close execve exit_group getcwd ioctl lseek mmap munmap openat read readlinkat readv set_tid_address writev
- + clock_gettime/gettimeofday (hidden by vDSO under strace; becomes a real syscall in our kernel)
- stubs OK: ioctl(TIOCGWINSZ)->ENOTTY, readlinkat->EINVAL, getcwd->"/", set_tid_address

## 2. Boot latency, full process (create VM -> boot -> PSCI SYSTEM_OFF -> exit), n=30
- libkrun+HVF, bare kernel:            median 3.3 ms (p90 3.8)
- libkrun+HVF, + 9.6MB QuickJS initrd: median 5.9 ms (p90 6.7)
- QEMU+HVF, bare kernel:               median 18.5 ms
- control: a kernel that never powers off hangs -> our code really executes

## 3. Toolchain
- zig cc -target aarch64-linux-musl -static: works on macOS (no Linux VM needed to build guests)
- clang --target=aarch64-none-elf + ld.lld: works for the kernel
- libkrun (main @ a1d8616) builds on macOS with Rust >=1.88 (used 1.95.0), needs rustfmt; host binary needs com.apple.security.hypervisor entitlement (ad-hoc codesign)
- libkrun has no PL011 on aarch64: guest I/O must be virtio-console (MMIO @ 0x0a000000+); RAM/kernel at 0x80000000

## 4. Integration
- @cloudflare/codemode 0.5.5, MIT; Executor.execute(code, ResolvedProvider[]) -> {result, error?, logs?}; providers may carry a sandbox-side `prelude`
- wrapper needs: console.*, setTimeout (timeout race), Promise, Proxy — all in QuickJS; fetch blocked by design

## 5. Competitive
- Hyperlight now supports macOS aarch64 (HVF); hyperlight-js = QuickJS in Hyperlight with npm @hyperlight-dev/js-host-api 0.4.0 (published for linux-x64, win32-x64 only)
- hyperlight-sandbox (Mar 2026): lists "Code Mode" use case, host tool dispatch, snapshot/restore, network allowlist; SDKs Python/.NET/Rust
- No codemode Executor adapter from Hyperlight found

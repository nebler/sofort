POSIX interposer array indices (all processes):
0 read attempts, 1 read positive, 2 read positive bytes, 3 read error,
4 write attempts, 5 write positive bytes, 6 readv attempts, 7 readv bytes,
8 writev attempts, 9 writev bytes, 10 poll enter, 11 poll return,
12 kevent enter, 13 kevent returned event count, 14 kevent64 enter,
15 kevent64 returned event count. Remaining indices zero/reserved.
Only attempted calls entered within the enabled interval increment attempt
counters. An already-blocked poll can return in the interval without an enter.
Darwin implementations' internal pthread/Mach traps are not intercepted.

Guest array:
0 total non-marker syscalls; 1 read63, 2 write64, 3 ppoll73, 4 clock_gettime113,
5 all other syscall IDs. 6 console MMIO writes, 7 console MMIO reads,
8 console TX copies, 9 TX bytes, 10 console RX copies, 11 RX bytes,
12 park_for calls, 13 WFI instructions, 14 readv65, 15 writev66,
16 rt_sigaction134, 17 rt_sigprocmask135, 18 brk214, 19 mmap222,
20 munmap215, 21 mremap216, 22 fcntl25, 23 ioctl29, 24 close57,
25 all syscall IDs not in14..24, 26..31 reserved.
The secondary syscall bins overlap main bins1..4 through index25; do not sum
all bins. Marker fd2 write/writev are excluded before dispatch.

Host array:
0 hv_vcpu_run calls (subtract 1 for END marker's return); 1 MMIO write exits,
2 MMIO read exits, 3 WFX exits, 4 canceled exits, 5 RX queue notifications,
6 TX queue notifications, 7 control RX notifications, 8 control TX notifications,
10 console libc read attempts, 11 successful console reads, 12 RX bytes,
13 read errors, 14 console write attempts, 15 TX bytes,
16 input/output poll starts, 17 poll returns,
18 TX thread park attempts, 19 TX park returns,
20 RX thread park attempts, 21 RX park returns,
22 console event manager callbacks, 23 queue-event reads,
24 signal_used_queue wrapper entries (can count a forwarding wrapper twice),
25 WFE unbounded scheduling entries, 26 WFE scheduling returns,
27 HV virtual timer exits, 28 system-register exits,
29 actual HVF GIC set_spi calls; remaining indices zero/reserved.
Prefer index29 over24 for actual IRQ injection requests.

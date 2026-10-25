// Trigger finding: PL031 RTC bad-offset access (bounds/dispatch check).
// RTC virtio-mmio base = 0x0a001000. No virtqueue setup needed.
//
// Before patch: a read at RTCMIS-ish / reserved offsets just returns 0 via
//   the `_ => read_ok=false` arm (safe). The AMBA-ID index path PL031_ID[idx]
//   is already bounds-safe (idx <= 7). This probe demonstrates that the RTC
//   path handles arbitrary guest offsets WITHOUT panic (expected: no crash,
//   warn logged). It is the control/confirmation case for the RTC verdict.
// After patch: identical behaviour (RTC was already safe; unchanged).
//
// RAM/kernel load at 0x80000000, raw binary.
.section .text
.global _start
_start:
    ldr     x1, =0x0a001000        // PL031 base
    // Read reserved offset 0x20 (falls into `_ => read_ok=false`): returns 0.
    ldr     w0, [x1, #0x20]
    // Read AMBA id region top (0xFFC): index 7, in-bounds, returns 0xb1.
    ldr     w0, [x1, #0xFFC]
    // Write to a bad offset (0x200): handle_write -> Err(BadWriteOffset) -> warn.
    mov     w0, #0x1234
    str     w0, [x1, #0x200]
halt:
    // PSCI SYSTEM_OFF
    ldr     x0, =0x84000008
    hvc     #0
    b       halt

// Minimal aarch64 "kernel": print to PL011 UART, then PSCI SYSTEM_OFF.
.global _start
_start:
    ldr x1, =0x09000000
    adr x2, msg
1:  ldrb w3, [x2], #1
    cbz w3, 2f
    strb w3, [x1]
    b 1b
2:  ldr x0, =0x84000008      // PSCI SYSTEM_OFF
    hvc #0
3:  wfi
    b 3b
msg: .asciz "jitk: booted\n"

// libkrun variant: RAM starts at 0x80000000; no PL011, so just PSCI SYSTEM_OFF.
.global _start
_start:
    ldr x0, =0x84000008
    hvc #0
1:  wfi
    b 1b

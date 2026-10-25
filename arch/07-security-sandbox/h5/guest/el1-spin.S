// Runaway EL1 CPU with interrupts masked: only the external watchdog can stop it.
.global _start
_start:
 msr daifset, #0xf
1: b 1b

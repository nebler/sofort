// EL1 reset-test fixtures, entered by Slot::redirect_entry: MMU off, x4/x5 = the
// class arena's GPA bounds, code copied to the arena's last (canary) page. Each
// is position independent and leaves that page alone.
.section .rodata.jitk_reset_fixtures,"a",%progbits

// Fill every byte of the arena (but the code page) and the transport window,
// write every register class reachable at EL1 without trapping, then store to
// read-only RAM: a MemoryBound exit.
.global jitk_reset_fill_start
jitk_reset_fill_start:
    mov x9, #(3 << 20)
    msr cpacr_el1, x9           // FP/SIMD on
    isb
    movz x9, #0x3c3c
    movk x9, #0x5a5a, lsl #16
    movk x9, #0xa5a5, lsl #32
    movk x9, #0xc3c3, lsl #48
    sub x5, x5, #4096
    mov x0, x4
0:  stp x9, x9, [x0], #16
    cmp x0, x5
    b.lo 0b
    movz x0, #0x81d0, lsl #16   // transport: CONTROL .. +80 KiB
    add x1, x0, #0x14000
1:  stp x9, x9, [x0], #16
    cmp x0, x1
    b.lo 1b
    .irp n,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31
    dup v\n\().2d, x9
    .endr
    msr fpsr, x9
    msr fpcr, x9
    msr tpidr_el0, x9
    msr tpidrro_el0, x9
    msr tpidr_el1, x9
    msr sp_el0, x9
    msr elr_el1, x9
    msr spsr_el1, x9
    msr far_el1, x9
    msr esr_el1, x9
    msr afsr0_el1, x9
    msr afsr1_el1, x9
    msr par_el1, x9
    msr contextidr_el1, x9
    msr mair_el1, x9
    msr amair_el1, x9
    msr tcr_el1, x9
    msr ttbr0_el1, x9
    msr ttbr1_el1, x9
    msr cntkctl_el1, x9
    msr csselr_el1, x9
    msr cntv_cval_el0, x9
    msr cntp_cval_el0, x9
    mov x10, #2                 // timers masked and disabled: no interrupt exit
    msr cntv_ctl_el0, x10
    msr cntp_ctl_el0, x10
    mov x10, #0xf0000000
    msr nzcv, x10
    movz x10, #0xc800           // SCTLR RES1 | UCI | UCT | DZE; MMU/caches off
    movk x10, #0x34d0, lsl #16
    msr sctlr_el1, x10
    msr vbar_el1, x9            // last: no EL1 exception is taken after this
    isb
    .irp n,1,2,3,4,5,6,7,8,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30
    mov x\n, x9
    .endr
    mov sp, x9
    movz x0, #0x8000, lsl #16
    str x9, [x0]
2:  b 2b
.global jitk_reset_fill_end
jitk_reset_fill_end:

// FNV-1a-style hash, x0 = (x0 ^ word) * prime, over every 8-byte word the fill
// writes, as the guest reads it; then a MemoryBound exit with the hash in x0.
.global jitk_reset_probe_start
jitk_reset_probe_start:
    movz x7, #0x01b3
    movk x7, #0x0100, lsl #32
    movz x0, #0x2325
    movk x0, #0x8422, lsl #16
    movk x0, #0x9ce4, lsl #32
    movk x0, #0xcbf2, lsl #48
    sub x5, x5, #4096
    mov x2, x4
0:  ldr x3, [x2], #8
    eor x0, x0, x3
    mul x0, x0, x7
    cmp x2, x5
    b.lo 0b
    movz x2, #0x81d0, lsl #16
    add x6, x2, #0x14000
1:  ldr x3, [x2], #8
    eor x0, x0, x3
    mul x0, x0, x7
    cmp x2, x6
    b.lo 1b
    movz x1, #0x8000, lsl #16
    str x0, [x1]
2:  b 2b
.global jitk_reset_probe_end
jitk_reset_probe_end:

// PSCI CPU_OFF: KVM marks the vCPU STOPPED and KVM_RUN sleeps until a signal.
.global jitk_reset_cpu_off_start
jitk_reset_cpu_off_start:
    movz x0, #0x0002
    movk x0, #0x8400, lsl #16
    hvc #0
0:  b 0b
.global jitk_reset_cpu_off_end
jitk_reset_cpu_off_end:

// PSCI SYSTEM_OFF: KVM_EXIT_SYSTEM_EVENT, with every vCPU left STOPPED.
.global jitk_reset_system_off_start
jitk_reset_system_off_start:
    movz x0, #0x0008
    movk x0, #0x8400, lsl #16
    hvc #0
0:  b 0b
.global jitk_reset_system_off_end
jitk_reset_system_off_end:

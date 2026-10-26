// EL1, MMU/cache/timer off, no stack, no interrupts, no HVC, no devices.
// Control and fixed 64-byte ring records are documented in README.md.
.section .rodata.jitk_stub,"a",%progbits
.global jitk_stub_start
jitk_stub_start:
    mov x19, #0x80000000
    add x19, x19, #0x4000
    mov x22, #0x10000000
    ldr x0, [x19, #88]
    cbnz x0, parked
    ldr x23, [x19]               // generation
    ldr x24, [x19, #8]           // seed
    ldr x0, [x19, #72]          // prior-run counter must be pristine
    cbnz x0, fail
    // Guest checks boundary canaries. Host compares every byte of all 2 MiB
    // before entry; scanning every page here would measure 256 nested stage-2
    // refill faults even in the K=0 case, hiding the working-set variation.
    mov x0, #0x80000000
    add x0, x0, #0x20000
    mov x2, #0xa5a5
    movk x2, #0xa5a5, lsl #16
    movk x2, #0xa5a5, lsl #32
    movk x2, #0xa5a5, lsl #48
    ldr x3, [x0]
    cmp x3, x2
    b.ne fail
    add x0, x0, #0x100000
    ldur x3, [x0, #-8]
    cmp x3, x2
    b.ne fail
    // Fill all words of K pages with a run-specific canary.
    ldr x1, [x19, #16]
    mov x0, #0x80000000
    add x0, x0, #0x20000
    add x1, x0, x1, lsl #12
    eor x2, x24, x23
    cmp x0, x1
    b.eq filled
dirty:
    str x2, [x0], #8
    cmp x0, x1
    b.ne dirty
filled:
    mov x0, #1
    str x0, [x19, #72]
    mov x20, #0x80000000
    add x20, x20, #0x8000
    // A FINISH-only run also publishes one result record, proving which seed
    // the guest actually observed even when it dirties zero arena pages.
    str x23, [x20]
    str xzr, [x20, #8]
    str x24, [x20, #16]
    str x0, [x20, #24]
    dmb sy
    str x0, [x19, #32]
    ldr x25, [x19, #24]         // number of calls, 0..10
    mov x26, #0
    cbz x25, finish
submit:
    str x23, [x20]             // generation
    str x26, [x20, #8]         // call id
    str x24, [x20, #16]        // canary
    mov x0, #1
    str x0, [x20, #24]         // counter
    add x26, x26, #1
    dmb sy
    str x26, [x19, #32]        // release req_prod
    dmb sy
    mov w0, #1                 // SUBMIT, exactly 32-bit MMIO store
    str w0, [x22]
    add x20, x20, #64
    cmp x26, x25
    b.ne submit
    str x25, [x19, #80]        // WAIT predicate: replies >= target
    dmb sy
    mov w0, #2
    str w0, [x22]              // WAIT, owner returns to scheduler
    dmb sy
    ldr x0, [x19, #48]
    cmp x0, x25
    b.ne fail
    mov x21, #0x80000000
    add x21, x21, #0x10000
    mov x26, #0
reply:
    ldr x0, [x21]
    cmp x0, x23
    b.ne fail
    ldr x0, [x21, #8]
    // Replies may arrive out of order; verify by value, host checks uniqueness.
    cmp x0, x25
    b.hs fail
    ldr x1, [x21, #16]
    eor x0, x0, x24
    cmp x0, x1
    b.ne fail
    add x21, x21, #64
    add x26, x26, #1
    cmp x26, x25
    b.ne reply
    str x25, [x19, #56]
finish:
    dmb sy
    mov w0, #3
    str w0, [x22]              // FINISH; must drain before register restore
    b .
parked:
    mov w0, #2
    str w0, [x22]
    b .
fail:
    mov x0, #1
    str x0, [x19, #64]
    b finish

.global jitk_stub_end
jitk_stub_end:

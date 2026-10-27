// No counter read, timer device, IRQ, GIC, or WFI. Host refreshes this
// monotonic baseline at each doorbell; time is frozen while a CPU job runs.
pub fn now_ns() -> u64 {
    // SAFETY: The aligned monotonic control word is mapped for the VM lifetime and is read
    // atomically after host publication.
    unsafe { crate::console::load(crate::ring_abi::MONOTONIC_NS) }
}
/// # Safety
/// The sole masked-IRQ vCPU owns wait/RX state. ABI offsets are aligned control words; no ring
/// payload borrow spans the WAIT doorbell or service.
pub unsafe fn park_for(deadline: u64, _input: bool) {
    // SAFETY: The sole masked-IRQ vCPU owns wait/RX state. ABI offsets are aligned control
    // words; no ring payload borrow spans the WAIT doorbell or service.
    unsafe {
        crate::console::store(crate::ring_abi::DEADLINE, deadline);
        crate::console::store(
            crate::ring_abi::WAIT_EPOCH,
            crate::console::load(crate::ring_abi::HOST_EPOCH),
        );
        crate::console::store(crate::ring_abi::WAIT_MASK, 7);
        crate::arch::doorbell(crate::ring_abi::WAIT);
        crate::console::service();
    }
}

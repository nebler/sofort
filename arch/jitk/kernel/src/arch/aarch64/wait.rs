// No counter read, timer device, IRQ, GIC, or WFI. Host refreshes this
// monotonic baseline at each doorbell; time is frozen while a CPU job runs.
pub fn now_ns() -> u64 {
    unsafe { crate::console::load(0x220) }
}
pub unsafe fn park(deadline: u64) {
    unsafe { park_for(deadline, true) }
}
pub unsafe fn park_for(deadline: u64, _input: bool) {
    unsafe {
        crate::console::store(0x230, deadline);
        crate::console::store(0x140, crate::console::load(0x180));
        crate::console::store(0x148, 7);
        crate::arch::doorbell(2);
        crate::console::service();
    }
}

#[cfg(not(feature = "grow-trace"))]
use crate::console as c;
pub fn call(a: &[usize; 6]) -> isize {
    // SAFETY: This masked-IRQ trap owns console/output state; trace formatting retains no
    // references and FINISH/shutdown never resumes EL0.
    unsafe {
        #[cfg(feature = "transport-ring")]
        if crate::console::native() {
            crate::console::native_finish(a[0]);
        }
        crate::trace::terminal(a[0]);

        #[cfg(not(feature = "grow-trace"))]
        {
            c::print("\x1eexit=");
            c::hex(a[0]);
            c::print("\n");
        }
        crate::off()
    }
}

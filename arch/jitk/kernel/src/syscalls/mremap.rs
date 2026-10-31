/// Ring builds: flags 0 or MREMAP_MAYMOVE, moving page descriptors, never
/// bytes (kernel/src/heap.rs). The console profile returns -38, and musl's
/// realloc copies instead.
#[cfg(feature = "transport-ring")]
pub fn call(a: &[usize]) -> isize {
    crate::heap::mremap(a[0], a[1], a[2], a[3])
}
#[cfg(not(feature = "transport-ring"))]
pub fn call(_: &[usize]) -> isize {
    -38
}

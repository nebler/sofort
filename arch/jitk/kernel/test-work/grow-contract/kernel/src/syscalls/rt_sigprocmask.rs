// Lua profile: no signal delivery or thread state. No user pointers are touched.
// This is an explicit ENOSYS contract, never a claim of Linux signal support.
pub fn call(_: &[usize]) -> isize { -38 }

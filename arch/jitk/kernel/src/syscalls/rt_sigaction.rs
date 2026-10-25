// Lua profile: signals are unsupported. Native Linux injection proves fallback.
// Returning ENOSYS does not install a handler or access any user pointer.
pub fn call(_: &[usize]) -> isize { -38 }

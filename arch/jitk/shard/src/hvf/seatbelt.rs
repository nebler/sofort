//! The engine's Seatbelt confinement: `jitk.sb` (every engine process, the
//! native worker, the console runner) and the zygote's `zygote.sb` on top,
//! through libsandbox's compile and apply entry points.
use std::{
    ffi::{CStr, CString, c_char, c_int},
    io,
    path::Path,
};

/// Deny by default; read only the `IMAGES` directory; one sysctl.
pub const PROFILE: &str = include_str!("jitk.sb");
/// The zygote's grants on top of jitk.sb.
pub const ZYGOTE_RULES: &str = include_str!("zygote.sb");

#[repr(C)]
struct Profile {
    builtin: *const c_char,
    data: *const u8,
    size: usize,
}
#[link(name = "sandbox")]
unsafe extern "C" {
    // Private but long-stable libsandbox exports.
    fn sandbox_create_params() -> *mut u8;
    fn sandbox_set_param(p: *mut u8, k: *const c_char, v: *const c_char) -> c_int;
    fn sandbox_free_params(p: *mut u8);
    fn sandbox_compile_string(s: *const c_char, p: *mut u8, err: *mut *mut c_char) -> *mut Profile;
    fn sandbox_free_profile(p: *mut Profile);
    fn sandbox_apply(p: *const Profile) -> c_int;
    fn sandbox_free_error(e: *mut c_char);
}

/// Compile `source` with `IMAGES` = `images` (the snapshot directory).
pub fn compile(source: &str, images: &Path) -> io::Result<Vec<u8>> {
    let dir = CString::new(
        images
            .to_str()
            .ok_or_else(|| io::Error::other("seatbelt: images path must be UTF-8"))?,
    )?;
    let src = CString::new(source)?;
    // SAFETY: no arguments; libsandbox returns an owned params object or null.
    let params = unsafe { sandbox_create_params() };
    if params.is_null() {
        return Err(io::Error::other("seatbelt: create_params failed"));
    }
    // SAFETY: params is live; both NUL-terminated strings outlive the call.
    unsafe { sandbox_set_param(params, c"IMAGES".as_ptr(), dir.as_ptr()) };
    let mut err = std::ptr::null_mut();
    // SAFETY: src/params are live and err is writable; results are owned here.
    let prof = unsafe { sandbox_compile_string(src.as_ptr(), params, &mut err) };
    // SAFETY: compile has returned; params has exactly one owner.
    unsafe { sandbox_free_params(params) };
    if prof.is_null() {
        let message = if err.is_null() {
            "unknown".to_string()
        } else {
            // SAFETY: a NUL-terminated error string, valid until freed below.
            let m = unsafe { CStr::from_ptr(err) }
                .to_string_lossy()
                .into_owned();
            // SAFETY: owned here, freed once.
            unsafe { sandbox_free_error(err) };
            m
        };
        return Err(io::Error::other(format!(
            "seatbelt: compile failed: {message}"
        )));
    }
    // SAFETY: a live Profile whose data holds size initialized bytes; copied
    // before the profile is freed (once).
    let blob = unsafe {
        let p = &*prof;
        let b = std::slice::from_raw_parts(p.data, p.size).to_vec();
        sandbox_free_profile(prof);
        b
    };
    Ok(blob)
}

/// Enter the compiled profile `blob` for the rest of this process (and its
/// children's) life.
pub fn apply(blob: &[u8]) -> io::Result<()> {
    let p = Profile {
        builtin: std::ptr::null(),
        data: blob.as_ptr(),
        size: blob.len(),
    };
    // SAFETY: p has the libsandbox layout and borrows blob for the call.
    if unsafe { sandbox_apply(&p) } != 0 {
        return Err(io::Error::other(format!(
            "seatbelt: apply failed: {}",
            io::Error::last_os_error()
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    /// jitk.sb grants exactly the image directory and one sysctl.
    #[test]
    fn profile_is_minimal() {
        let rules: Vec<_> = super::PROFILE
            .lines()
            .map(str::trim)
            .filter(|l| l.starts_with("(allow"))
            .collect();
        assert_eq!(rules.len(), 2, "{rules:?}");
        assert!(super::PROFILE.contains("(deny default)"));
    }
}

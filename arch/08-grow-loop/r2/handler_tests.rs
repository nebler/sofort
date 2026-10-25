// Verifier-owned tests for the actual returned module, independent of candidate tests.
mod ioctl { include!(env!("JITK_IOCTL_SOURCE")); }
#[test]
fn linux_probe_errnos() {
    assert_eq!(ioctl::call(&[1,0x5413,0,0,0,0]),-25);
    assert_eq!(ioctl::call(&[usize::MAX,0x5413,0,0,0,0]),-9);
    assert_eq!(ioctl::call(&[999,0x5413,0,0,0,0]),-9);
}
#[test]
fn restricted_request_is_ordinary_enosys() {
    for fd in 0..=2 { assert_eq!(ioctl::call(&[fd,0x1234,0,0,0,0]),-38); }
}
#[test]
fn bad_descriptor_precedes_request() {
    for fd in [3,999,usize::MAX] { assert_eq!(ioctl::call(&[fd,0,0,0,0,0]),-9); }
}
#[test]
fn deterministic_scalar_domain_sweep() {
    // Bounded declared fd domain only: Linux truncates int fd at the ABI boundary.
    for i in 0..10_000usize {
        let fd=i%1024;
        let request=if i%2==0 {0x5413} else {0x1234};
        let expected=if fd>2 {-9} else if request==0x5413 {-25} else {-38};
        assert_eq!(ioctl::call(&[fd,request,i,0,0,0]),expected);
    }
}

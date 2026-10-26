use crate::fs::*;

#[test]
fn scoped_access_excludes_reentry_and_preserves_descriptor_state() {
    let fd = alloc(7, false, true) as usize;
    assert_eq!(fd, 3);
    assert_eq!(
        with_open(fd, |o| {
            o.pos = 12;
            assert_eq!(get(fd).err(), Some(-16));
            assert_eq!(close(fd), -16);
            assert_eq!(alloc(8, false, true), -16);
        }),
        Ok(())
    );
    assert_eq!(get(fd).unwrap().pos, 12);
    #[cfg(feature = "transport-ring")]
    {
        assert_eq!(dup_stdin(fd, 0x80000), 0);
        assert_eq!(fd_flags(0, None), 1);
        assert_eq!(fd_flags(fd, None), 0);
        with_open(0, |o| o.pos += 1).unwrap();
        assert_eq!(get(fd).unwrap().pos, 13);
        assert_eq!(close(fd), 0);
        assert_eq!(get(0).unwrap().pos, 13);
        assert_eq!(close(0), 0);
    }
    #[cfg(not(feature = "transport-ring"))]
    assert_eq!(close(fd), 0);
    assert_eq!(get(fd).err(), Some(-9));
}

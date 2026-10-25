#[path="kernel/src/syscalls/ioctl.rs"] mod handler;
fn main() {
    let a:Vec<String>=std::env::args().collect();
    println!("{}",handler::ioctl(a[1].parse().unwrap(),a[2].parse().unwrap(),a[3].parse().unwrap()));
}
#[cfg(test)] mod tests {
    use super::handler::ioctl;
    #[test] fn terminal_probe() { for fd in 0..=2 {assert_eq!(ioctl(fd,0x5413,0),-25);} }
    #[test] fn invalid_fd() {for fd in [-1,i64::MIN,3,i64::MAX] {assert_eq!(ioctl(fd,0x5413,u64::MAX),-9);}}
    #[test] fn unknown_request() {assert_eq!(ioctl(1,0,0),-38);}
    #[test] fn scalar_fuzz_10000() {
        let mut x=0x123456789abcdef0u64;
        for i in 0..10000 { x^=x<<13;x^=x>>7;x^=x<<17;
            let fd=if i%4==0 {(x>>1) as i64} else {(i%3) as i64};
            let req=if i%2==0 {0x5413} else {x};
            let want=if !(0..=2).contains(&fd) {-9} else if req==0x5413 {-25} else {-38};
            assert_eq!(ioctl(fd,req,x),want);
        }
    }
}

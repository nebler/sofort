unsafe extern "C" { fn clock_gettime_nsec_np(clock:i32)->u64; }
fn main(){let ns=unsafe{clock_gettime_nsec_np(4)};println!("MAIN {ns} 0");}

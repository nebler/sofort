use hyperlight_host::{GuestBinary,UninitializedSandbox};
fn main() {
    let path=std::env::args().nth(1).expect("static Linux ELF path");
    eprintln!("loading static ELF");
    let loaded=UninitializedSandbox::new(GuestBinary::FilePath(path.into()),None);
    eprintln!("ELF load returned, entering evolve");
    match loaded.and_then(|s|s.evolve()) {
        Ok(_)=>println!("unexpectedly initialized Linux binary"),
        Err(e)=>{eprintln!("Linux ABI experiment: {e:?}");std::process::exit(1)}
    }
}

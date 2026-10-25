use hyperlight_host::{GuestBinary,UninitializedSandbox};
fn main() {
    let path=std::env::args().nth(1).expect("static Linux ELF path");
    let start=std::time::Instant::now();
    eprintln!("loading static ELF {path}");
    let loaded=UninitializedSandbox::new(GuestBinary::FilePath(path.into()),None);
    let loaded=match loaded {
        Ok(s)=>{eprintln!("ELF load succeeded at {} us; entering evolve",start.elapsed().as_micros());s},
        Err(e)=>{eprintln!("ELF load failed at {} us: {e:?}",start.elapsed().as_micros());std::process::exit(1)}
    };
    match loaded.evolve() {
        Ok(_)=>println!("unexpectedly initialized Linux binary"),
        Err(e)=>{eprintln!("Linux ABI experiment: {e:?}");std::process::exit(1)}
    }
}

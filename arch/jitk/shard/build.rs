use std::{env, fs, path::PathBuf, process::Command};
fn run(c: &mut Command) {
    assert!(
        c.status().expect("start build tool").success(),
        "build tool failed"
    );
}
fn main() {
    if env::var("CARGO_CFG_TARGET_OS").unwrap() != "linux" {
        return;
    }
    assert_eq!(env::var("CARGO_CFG_TARGET_ARCH").unwrap(), "aarch64");
    let out = PathBuf::from(env::var_os("OUT_DIR").unwrap());
    run(Command::new("cc")
        .args(["abi.c", "-o"])
        .arg(out.join("abi")));
    let constants = Command::new(out.join("abi")).output().unwrap();
    assert!(constants.status.success());
    fs::write(out.join("abi.rs"), constants.stdout).unwrap();
    println!("cargo:rerun-if-changed=abi.c");
}

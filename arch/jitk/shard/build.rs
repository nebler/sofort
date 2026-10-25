use std::{env, fs, path::PathBuf, process::Command};
fn run(c: &mut Command) {
    assert!(
        c.status().expect("start build tool").success(),
        "build tool failed"
    );
}
fn main() {
    assert_eq!(env::var("CARGO_CFG_TARGET_ARCH").unwrap(), "aarch64");
    assert_eq!(env::var("CARGO_CFG_TARGET_OS").unwrap(), "linux");
    let out = PathBuf::from(env::var_os("OUT_DIR").unwrap());
    run(Command::new("cc")
        .args(["abi.c", "-o"])
        .arg(out.join("abi")));
    let constants = Command::new(out.join("abi")).output().unwrap();
    assert!(constants.status.success());
    fs::write(out.join("abi.rs"), constants.stdout).unwrap();
    run(Command::new("clang")
        .args(["--target=aarch64-unknown-none", "-c", "guest/stub.S", "-o"])
        .arg(out.join("stub.o")));
    run(Command::new("ld.lld")
        .args(["-Ttext=0x80000000", "--oformat=binary"])
        .arg(out.join("stub.o"))
        .arg("-o")
        .arg(out.join("stub.bin")));
    run(Command::new("clang")
        .args([
            "--target=aarch64-unknown-none",
            "-c",
            "guest/arena-attack.S",
            "-o",
        ])
        .arg(out.join("arena-attack.o")));
    run(Command::new("ld.lld")
        .args(["-Ttext=0x8193f000", "--oformat=binary"])
        .arg(out.join("arena-attack.o"))
        .arg("-o")
        .arg(out.join("arena-attack.bin")));
    println!("cargo:rerun-if-changed=guest/arena-attack.S");
    println!("cargo:rerun-if-changed=abi.c");
    println!("cargo:rerun-if-changed=guest/stub.S");
}

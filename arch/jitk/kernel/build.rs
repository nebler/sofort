use std::{env, path::PathBuf, process::Command};
fn main() {
    println!("cargo::rustc-check-cfg=cfg(ring_glue_4m)");
    let base = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let out = PathBuf::from(env::var("OUT_DIR").unwrap());
    // Arch layer: linker script and Linux syscall-number table (see ARCH.md).
    let arch = env::var("CARGO_CFG_TARGET_ARCH").unwrap();
    let arch_dir = base.join("src/arch").join(&arch);
    println!(
        "cargo:rerun-if-changed={}",
        arch_dir.join("link.ld").display()
    );
    for key in [
        "JITK_ELF",
        "JITK_SCRIPT",
        "JITK_ARGV_JSON",
        "JITK_RESOURCES",
    ] {
        println!("cargo:rerun-if-env-changed={key}");
    }
    for file in [
        "src/syscalls",
        "slots.json",
        "prepare.ts",
        "packer.ts",
        "generate.ts",
        "build-args.ts",
        "lib.ts",
        "../protocol/bootstrap.js",
        "ring-bootstrap.js",
    ] {
        println!("cargo:rerun-if-changed={file}");
    }
    let payload = if env::var_os("CARGO_FEATURE_TRANSPORT_RING").is_some() {
        "payload/qjs-ring"
    } else {
        "payload/qjs"
    };
    let elf = env::var("JITK_ELF").unwrap_or(base.join(payload).display().to_string());
    println!("cargo:rerun-if-changed={elf}");
    if let Ok(dir) = env::var("JITK_RESOURCES") {
        println!("cargo:rerun-if-changed={dir}");
    }
    let tools = env::var_os("JITK_TOOLS_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| base.join(".work/bin"));
    println!("cargo:rerun-if-env-changed=JITK_TOOLS_DIR");
    for tool in ["prepare", "build-args"] {
        println!("cargo:rerun-if-changed={}", tools.join(tool).display());
    }
    assert!(
        Command::new(tools.join("prepare"))
            .arg(&elf)
            .arg(&out)
            .status()
            .unwrap()
            .success()
    );
    // The native generator parses slots once for the manifest and dispatcher.
    assert!(
        Command::new(tools.join("build-args"))
            .arg(&out)
            .arg(&base)
            .status()
            .unwrap()
            .success()
    );
    println!(
        "cargo:rustc-link-arg=-T{}",
        arch_dir.join("link.ld").display()
    );
}

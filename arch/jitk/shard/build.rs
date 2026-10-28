// macOS test builds: the EL1 reset fixtures (guest/reset-attack.S) are ELF
// assembly; Mach-O wants another section directive and underscore-prefixed C
// symbols. Write a rewritten copy to OUT_DIR (slot::test_guest includes it);
// the guest instructions are byte for byte the same. Nothing on Linux.
fn main() {
    let src = "guest/reset-attack.S";
    println!("cargo:rerun-if-changed={src}");
    println!("cargo:rerun-if-changed=build.rs");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("macos") {
        return;
    }
    let text = std::fs::read_to_string(src).unwrap();
    let out: String = text
        .lines()
        .map(|l| {
            if l.starts_with(".section") {
                ".section __TEXT,__const".to_string()
            } else {
                l.replace("jitk_reset_", "_jitk_reset_")
            }
        })
        .collect::<Vec<_>>()
        .join("\n");
    let dir = std::env::var("OUT_DIR").unwrap();
    std::fs::write(format!("{dir}/reset-attack.S"), out + "\n").unwrap();
}

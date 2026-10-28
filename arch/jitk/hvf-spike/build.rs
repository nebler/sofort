// The shard's EL1 reset fixtures are ELF assembly; Mach-O wants another
// section directive and underscore-prefixed C symbols. Rewrite a copy into
// OUT_DIR; the guest instructions are byte-for-byte the shard's.
fn main() {
    let src = "../shard/guest/reset-attack.S";
    println!("cargo:rerun-if-changed={src}");
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

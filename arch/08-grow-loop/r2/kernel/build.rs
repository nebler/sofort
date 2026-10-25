use std::{env, fs, path::PathBuf};
fn main() {
    let base = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let slots = [(17,"getcwd"),(29,"ioctl"),(56,"openat"),(57,"close"),(62,"lseek"),
        (63,"read"),(64,"write"),(65,"readv"),(66,"writev"),(73,"ppoll"),
        (78,"readlinkat"),(93,"exit"),(94,"exit_group"),(96,"set_tid_address"),
        (113,"clock_gettime"),(214,"brk"),(215,"munmap"),(222,"mmap")];
    println!("cargo:rerun-if-changed=src/syscalls");
    let mut out = String::new();
    let mut arms = String::new();
    let mut present = String::new();
    for (nr,name) in slots {
        let file = base.join(format!("src/syscalls/{name}.rs"));
        println!("cargo:rerun-if-changed={}", file.display());
        if file.is_file() {
            out += &format!("#[path={:?}] mod {name};\n",file);
            arms += &format!("{nr} => unsafe {{ {name}::call(a) }},\n");
            present += &format!("{nr} => true,\n");
        } else { arms += &format!("{nr} => -38,\n"); }
    }
    out += &format!("pub fn registered(n:usize)->bool {{ match n {{ {present} _=>false }} }}\n");
    out += &format!("pub unsafe fn dispatch(n:usize,a:&[usize])->isize {{ match n {{ {arms} _=>-38 }} }}\n");
    fs::write(PathBuf::from(env::var("OUT_DIR").unwrap()).join("dispatch.rs"),out).unwrap();
}

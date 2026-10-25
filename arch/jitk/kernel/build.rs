use std::{collections::BTreeSet, env, fs, path::PathBuf, process::Command};
fn main() {
    let base = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let out = PathBuf::from(env::var("OUT_DIR").unwrap());
    for key in ["JITK_ELF", "JITK_SCRIPT", "JITK_ARGV_JSON", "JITK_RESOURCES"] {
        println!("cargo:rerun-if-env-changed={key}");
    }
    for file in ["src/syscalls", "slots.json", "prepare.py", "../protocol/bootstrap.js", "ring-bootstrap.js", "link.ld"] {
        println!("cargo:rerun-if-changed={file}");
    }
    let payload = if env::var_os("CARGO_FEATURE_TRANSPORT_RING").is_some() { "payload/qjs-ring" } else { "payload/qjs" };
    let elf = env::var("JITK_ELF").unwrap_or(base.join(payload).display().to_string());
    println!("cargo:rerun-if-changed={elf}");
    if let Ok(dir) = env::var("JITK_RESOURCES") { println!("cargo:rerun-if-changed={dir}"); }
    assert!(Command::new("python3").arg(base.join("prepare.py")).arg(&elf).arg(&out).status().unwrap().success());
    // Python handles JSON so this dependency-free build script needs no serde crate.
    let script = r#"import os,json,pathlib,sys
p=pathlib.Path(sys.argv[1]); root=pathlib.Path(sys.argv[2])
bootstrap='ring-bootstrap.js' if 'CARGO_FEATURE_TRANSPORT_RING' in os.environ else '../protocol/bootstrap.js'
args=json.loads(os.environ['JITK_ARGV_JSON']) if 'JITK_ARGV_JSON' in os.environ else ['qjs','--std','--memory-limit','16777216','-e',os.environ.get('JITK_SCRIPT') or (root/bootstrap).read_text()]
assert isinstance(args,list) and 0<len(args)<=32 and all(isinstance(a,str) and '\0' not in a for a in args)
assert sum(len(a.encode())+1 for a in args)<30000
with (p/'packed.rs').open('a') as f:
 if 'JITK_ARGV_JSON' not in os.environ and 'JITK_SCRIPT' not in os.environ and 'CARGO_FEATURE_TRANSPORT_RING' not in os.environ:
  f.write('pub const ARGV: &[&str] = &["qjs","--std","--memory-limit","16777216","-e",include_str!(concat!(env!("CARGO_MANIFEST_DIR"),"/../protocol/bootstrap.js"))];\n')
 else:f.write('pub const ARGV: &[&str] = &'+json.dumps(args,ensure_ascii=False).replace('\\b','\\u{8}').replace('\\f','\\u{c}')+';\n')
slots=json.loads((root/'slots.json').read_text()); rows=[]
for nr,name in slots.items():
 path=root/f'src/syscalls/{name}.rs'; exists=path.is_file()
 rows.append(dict(nr=int(nr),name=name,registered=exists,sha256=__import__('hashlib').sha256(path.read_bytes()).hexdigest() if exists else None))
(p/'syscalls.json').write_text(json.dumps(rows,indent=2)+'\n')
(p/'features.json').write_text(json.dumps(sorted(k[14:].lower().replace('_','-') for k in os.environ if k.startswith('CARGO_FEATURE_')))+'\n')
(p/'argv.json').write_text(json.dumps(args,ensure_ascii=True)+'\n')
"#;
    assert!(Command::new("python3").args(["-c", script]).arg(&out).arg(&base).status().unwrap().success());
    let slots = fs::read_to_string(base.join("slots.json")).unwrap();
    let mut modules = String::from("#[allow(unused_imports, unused_variables, unused_unsafe)]\nmod handlers {\n");
    let (mut arms, mut present) = (String::new(), String::new());
    let mut emitted = BTreeSet::new();
    for line in slots.lines().filter(|s| s.contains(':')) {
        let parts: Vec<_> = line.split('"').collect();
        let (nr, name) = (parts[1], parts[3]);
        let file = base.join(format!("src/syscalls/{name}.rs"));
        println!("cargo:rerun-if-changed={}", file.display());
        if file.is_file() {
            if emitted.insert(name) {
                modules += &format!("#[path={:?}] mod {name};\n", file);
            }
            arms += &format!("{nr} => unsafe {{ {name}::call(a) }},\n");
            present += &format!("{nr} => true,\n");
        } else { arms += &format!("{nr} => -38,\n"); }
    }
    // Helpers remain one parent above handler files (08's candidate API).
    modules += "use super::*;\n";
    modules += &format!("pub fn registered(n:usize)->bool {{ match n {{ {present} _=>false }} }}\n");
    modules += &format!("pub unsafe fn dispatch(n:usize,a:&[usize])->isize {{ match n {{ {arms} _=>-38 }} }}\n}}\npub use handlers::{{registered,dispatch}};\n");
    fs::write(out.join("dispatch.rs"), modules).unwrap();
    println!("cargo:rustc-link-arg=-T{}", base.join("link.ld").display());
}

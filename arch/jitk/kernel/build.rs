use std::{env, path::PathBuf, process::Command};
fn main() {
    let base = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let out = PathBuf::from(env::var("OUT_DIR").unwrap());
    for key in ["JITK_ELF", "JITK_SCRIPT", "JITK_ARGV_JSON", "JITK_RESOURCES"] {
        println!("cargo:rerun-if-env-changed={key}");
    }
    for file in ["src/syscalls", "slots.json", "prepare.py", "generate.py", "../protocol/bootstrap.js", "ring-bootstrap.js", "link.ld"] {
        println!("cargo:rerun-if-changed={file}");
    }
    let payload = if env::var_os("CARGO_FEATURE_TRANSPORT_RING").is_some() { "payload/qjs-ring" } else { "payload/qjs" };
    let elf = env::var("JITK_ELF").unwrap_or(base.join(payload).display().to_string());
    println!("cargo:rerun-if-changed={elf}");
    if let Ok(dir) = env::var("JITK_RESOURCES") { println!("cargo:rerun-if-changed={dir}"); }
    assert!(Command::new("python3").arg(base.join("prepare.py")).arg(&elf).arg(&out).status().unwrap().success());
    // One strict JSON parse drives both the manifest and the Rust dispatcher.
    let script = r#"import os,json,pathlib,sys
sys.path.insert(0, sys.argv[2])
from generate import generate
p=pathlib.Path(sys.argv[1]); root=pathlib.Path(sys.argv[2])
bootstrap='ring-bootstrap.js' if 'CARGO_FEATURE_TRANSPORT_RING' in os.environ else '../protocol/bootstrap.js'
args=json.loads(os.environ['JITK_ARGV_JSON']) if 'JITK_ARGV_JSON' in os.environ else ['qjs','--std','--memory-limit','16777216','-e',os.environ.get('JITK_SCRIPT') or (root/bootstrap).read_text()]
assert isinstance(args,list) and 0<len(args)<=32 and all(isinstance(a,str) and '\0' not in a for a in args)
assert sum(len(a.encode())+1 for a in args)<30000
with (p/'packed.rs').open('a') as f:
 if 'JITK_ARGV_JSON' not in os.environ and 'JITK_SCRIPT' not in os.environ and 'CARGO_FEATURE_TRANSPORT_RING' not in os.environ:
  f.write('pub const ARGV: &[&str] = &["qjs","--std","--memory-limit","16777216","-e",include_str!(concat!(env!("CARGO_MANIFEST_DIR"),"/../protocol/bootstrap.js"))];\n')
 else:f.write('pub const ARGV: &[&str] = &'+json.dumps(args,ensure_ascii=False).replace('\\b','\\u{8}').replace('\\f','\\u{c}')+';\n')
generate(root, p)
(p/'features.json').write_text(json.dumps(sorted(k[14:].lower().replace('_','-') for k in os.environ if k.startswith('CARGO_FEATURE_')))+'\n')
(p/'argv.json').write_text(json.dumps(args,ensure_ascii=True)+'\n')
"#;
    assert!(Command::new("python3").args(["-c", script]).arg(&out).arg(&base).status().unwrap().success());
    println!("cargo:rustc-link-arg=-T{}", base.join("link.ld").display());
}

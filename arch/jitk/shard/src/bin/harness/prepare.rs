//! Offline checkpoint creation and its measurement receipt.
use jitk_shard::{
    arena,
    constants::ring::{CONTROL as CTRL, RAM_BYTES as RAM},
    kvm::{Kvm, Slot},
};
use std::{fs::File, io::Write, time::Instant};
pub(super) fn run(kvm: &Kvm, image: &str, base: &str) {
    let raw = std::fs::read(image).unwrap();
    assert!(raw.len() < CTRL);
    let classes: Vec<_> = arena::Class::ALL
        .into_iter()
        .filter(|c| {
            let layout = c.layout_bytes();
            raw.windows(layout.len()).any(|b| b == layout)
        })
        .collect();
    assert_eq!(
        classes.len(),
        1,
        "kernel must identify exactly one supported ring layout"
    );
    let class = classes[0];
    let initial = format!("{base}.boot");
    let mut f = File::options()
        .write(true)
        .read(true)
        .create_new(true)
        .open(&initial)
        .unwrap();
    f.set_len(RAM as u64).unwrap();
    f.write_all(&raw).unwrap();
    f.sync_all().unwrap();
    let mut s = Slot::boot(kvm, &f);
    let mut entropy = File::open("/dev/urandom").unwrap();
    s.bind(1, "", &mut entropy);
    let t = Instant::now();
    let e = s.exit().expect("trusted checkpoint protocol");
    assert_eq!(e.op, 4, "real guest did not CHECKPOINT");
    assert!(e.requests.is_empty() && e.finish.is_none());
    s.drain();
    let regs = s.capture();
    // Save at completed checkpoint store, before repair or tenant data.
    let mut out = File::options()
        .write(true)
        .create_new(true)
        .open(format!("{base}.mem"))
        .unwrap();
    out.write_all(&s.bytes(0, RAM)).unwrap();
    out.sync_all().unwrap();
    let mut out = File::options()
        .write(true)
        .create_new(true)
        .open(format!("{base}.regs"))
        .unwrap();
    out.write_all(b"JTKREGS2").unwrap();
    for r in &regs {
        out.write_all(&r.id().to_le_bytes()).unwrap();
        out.write_all(&(r.bytes().len() as u64).to_le_bytes())
            .unwrap();
        out.write_all(r.bytes()).unwrap();
    }
    out.sync_all().unwrap();
    use std::os::unix::fs::PermissionsExt;
    let mut layout = File::options()
        .write(true)
        .create_new(true)
        .open(format!("{base}.layout"))
        .unwrap();
    layout.write_all(&class.layout_bytes()).unwrap();
    layout.sync_all().unwrap();
    for ext in ["mem", "regs", "layout"] {
        std::fs::set_permissions(
            format!("{base}.{ext}"),
            std::fs::Permissions::from_mode(0o444),
        )
        .unwrap();
    }
    println!(
        "{{\"event\":\"prepared\",\"class\":\"{}\",\"arena_bytes\":{},\"ram_bytes\":{RAM},\"registers\":{},\"boot_to_checkpoint_ns\":{}}}",
        class.name(),
        class.bytes(),
        regs.len(),
        t.elapsed().as_nanos()
    );
    drop(s);
    drop(f);
    std::fs::remove_file(initial).unwrap();
}

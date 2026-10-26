//! Offline fixtures and CLI dispatch, compiled only into the real binary.
mod driver;
mod native_hold;
mod prepare;
mod probe;
use jitk_shard::{
    ipc_service,
    kvm::{self, Kvm, Snapshot, raise_fds},
    lease,
};
fn fixture(name: &str) -> String {
    match name {
        "ready" => include_str!("../../../fixtures/ready.js"),
        "return2" => include_str!("../../../fixtures/return2.js"),
        "one_tool" => include_str!("../../../fixtures/one_tool.js"),
        "promise10" => include_str!("../../../fixtures/promise10.js"),
        "json64k" => include_str!("../../../fixtures/json64k.js"),
        "canary" => include_str!("../../../fixtures/canary.js"),
        "rng_negative" => include_str!("../../../fixtures/rng_negative.js"),
        "wait" => include_str!("../../../fixtures/wait.js"),
        "bomb" => include_str!("../../../fixtures/bomb.js"),
        "attack_hold" => include_str!("../../../fixtures/attack_hold.js"),
        "arena_attack" => include_str!("../../../fixtures/arena_attack.js"),
        "spin" => include_str!("../../../fixtures/spin.js"),
        _ => panic!("unknown fixture"),
    }
    .into()
}
fn expected(name: &str) -> &'static str {
    match name {
        "return2" => "{\"ok\":2}",
        "one_tool" | "wait" => "{\"ok\":42}",
        "promise10" => "{\"ok\":45}",
        "json64k" => "{\"ok\":65536}",
        _ => "",
    }
}
pub fn run() -> Result<(), Box<dyn std::error::Error>> {
    let a: Vec<_> = std::env::args().collect();
    if a.get(1).map(String::as_str) == Some("watchdog") {
        lease::run(&a);
        return Ok(());
    }
    if a.get(1).map(String::as_str) == Some("ipc") {
        raise_fds();
        let result = ipc_service::run(&a[2], a[3].parse().unwrap(), a[4].parse().unwrap());
        if let Err(e) = result {
            eprintln!("shard IPC: {e}");
            std::process::exit(1);
        }
        return Ok(());
    }
    if a.get(1).map(String::as_str) == Some("ipc-probe") {
        if let Err(e) = probe::run(&a[2]) {
            eprintln!("shard IPC probe: {e}");
            std::process::exit(1);
        }
        return Ok(());
    }
    assert!(
        a.len() >= 3,
        "prepare IMAGE BASE | bench/hold/hostile BASE FIXTURE N [SECONDS] | stress/deadlines BASE FIXTURE N | native-worker ARGS | native-hold ..."
    );
    if a[1] == "native-worker" {
        kvm::native::worker(&a[2..])?;
        return Ok(());
    }
    if a[1] == "native-hold" {
        native_hold::run(&a[2], &a[3], a[4].parse()?, a[5].parse()?)?;
        return Ok(());
    }
    raise_fds();
    let kvm = Kvm::new();
    if a[1] == "prepare" {
        prepare::run(&kvm, &a[2], &a[3]);
        return Ok(());
    }
    driver::run(kvm, Snapshot::load(&a[2])?, &a, fixture, expected);
    Ok(())
}

core::arch::global_asm!(include_str!("../../../guest/arena-attack.S"));
fn arena_attack() -> &'static [u8] {
    unsafe extern "C" {
        static jitk_arena_attack_start: u8;
        static jitk_arena_attack_end: u8;
    }
    let start = std::ptr::addr_of!(jitk_arena_attack_start);
    let end = std::ptr::addr_of!(jitk_arena_attack_end);
    // SAFETY: the assembler labels enclose exactly the immutable fixture bytes
    // in one read-only section. Both labels live for this binary's lifetime.
    unsafe { std::slice::from_raw_parts(start, end as usize - start as usize) }
}

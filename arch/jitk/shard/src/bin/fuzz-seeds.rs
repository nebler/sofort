//! `fuzz-seeds DIR`: write every fuzz target's seed corpus (jitk_shard::fuzz
//! seeds) to DIR/TARGET/seed-N, replacing what is there.
use std::{env, fs, io, path::PathBuf};

fn main() -> io::Result<()> {
    let dir = PathBuf::from(env::args().nth(1).expect("usage: fuzz-seeds DIR"));
    for (name, _) in jitk_shard::fuzz::TARGETS {
        let target = dir.join(name);
        if target.exists() {
            fs::remove_dir_all(&target)?;
        }
        fs::create_dir_all(&target)?;
        for (i, seed) in jitk_shard::fuzz::seeds(name).iter().enumerate() {
            fs::write(target.join(format!("seed-{i}")), seed)?;
        }
    }
    Ok(())
}

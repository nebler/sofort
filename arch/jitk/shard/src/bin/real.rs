//! Linux shard service and offline harness entry point.
mod harness;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    harness::run()
}

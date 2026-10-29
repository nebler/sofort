#![no_main]
libfuzzer_sys::fuzz_target!(|data: &[u8]| {
    jitk_shard::fuzz::native_tx(data);
});

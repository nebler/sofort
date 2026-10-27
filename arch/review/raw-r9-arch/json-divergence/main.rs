use std::io::BufRead;
fn main() {
    for l in std::io::stdin().lock().lines() {
        let l = l.unwrap();
        let (k, b) = l.split_once(' ').unwrap();
        let ok = match k {
            "args" => jitk_shard::ipc_json::arguments(b.as_bytes()),
            "req" => jitk_shard::ipc_json::request(b.as_bytes()),
            _ => jitk_shard::ipc_json::reply(b.as_bytes()),
        };
        println!("{k} {ok}");
    }
}

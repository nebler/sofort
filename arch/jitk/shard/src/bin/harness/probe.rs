//! Offline shared-memory echo peer.
use jitk_shard::constants::{ABI_VERSION, ipc::OUTBOUND};
use jitk_shard::ipc::{self, Endpoint, Message};
use std::{collections::VecDeque, io};
fn invalid(message: &'static str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}
fn enqueue(out: &mut VecDeque<Message>, message: Message) -> io::Result<()> {
    if out.len() >= OUTBOUND {
        return Err(invalid("IPC outbound queue bound"));
    }
    out.push_back(message);
    Ok(())
}
/// Offline shared-memory echo/hostile peer. No KVM or watchdog is started.
pub(super) fn run(mode: &str) -> io::Result<()> {
    // SAFETY: this binary startup path uniquely adopts the Node-supplied
    // memfd and eventfds 3/4/5 before any owner threads are started.
    let mut endpoint = unsafe { Endpoint::inherited()? };
    let ready = Message::new(ipc::READY, 0, 0, 0, ABI_VERSION.to_le_bytes().to_vec());
    let mut out = VecDeque::from([ready]);
    loop {
        while let Some(m) = endpoint.receive()? {
            if mode != "echo" {
                return Err(invalid("unknown IPC probe mode"));
            }
            if m.kind != ipc::PING || m.slot != 0 || m.generation != 0 || m.bytes.len() > 1024 {
                return Err(invalid("IPC probe frame"));
            }
            enqueue(
                &mut out,
                Message {
                    kind: ipc::PING,
                    ..m
                },
            )?;
        }
        while let Some(m) = out.front() {
            if !endpoint.send(m)? {
                break;
            }
            out.pop_front();
        }
        endpoint.wait()?;
    }
}

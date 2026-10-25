// Dependency-free admission/state sketch; VMM launch, protocol, and policy are external.
use std::collections::{HashMap, VecDeque};
use std::time::{Duration, Instant};
#[derive(Clone, Copy, Debug)]
pub enum State { Ready, Running, Reaping }
pub struct Vm { pub state: State, pub deadline: Instant }
pub struct Pool { pub vms: HashMap<u64, Vm>, pub ready: VecDeque<u64>, pub cap: usize }
impl Pool {
    // Call only on trusted, version-matched guest READY before any user code.
    pub fn ready(&mut self, id: u64) -> Result<(), &'static str> {
        if self.vms.len() >= self.cap || self.vms.contains_key(&id) { return Err("capacity/id"); }
        self.vms.insert(id, Vm { state: State::Ready, deadline: Instant::now()+Duration::from_secs(30) });
        self.ready.push_back(id); Ok(())
    }
    pub fn lease(&mut self, wall: Duration) -> Result<u64, &'static str> {
        while let Some(id)=self.ready.pop_front() {
            let Some(vm)=self.vms.get_mut(&id) else { continue };
            if !matches!(vm.state, State::Ready) {continue}
            if Instant::now() >= vm.deadline { vm.state=State::Reaping; continue }
            vm.state=State::Running; vm.deadline=Instant::now()+wall;
            return Ok(id)
        }
        Err("retry elsewhere: no ready VM")
    }
    // Includes protocol failure, timeout, or success. Never transitions back to Ready.
    pub fn finish(&mut self, id: u64) {
        if let Some(vm)=self.vms.get_mut(&id) { vm.state=State::Reaping; }
    }
    // Call only after pidfd/process exit AND cgroup populated=0.
    pub fn reaped(&mut self, id: u64) { self.vms.remove(&id); }
}

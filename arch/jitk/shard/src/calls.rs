//! The call ids of one generation, as every layer tracks them (the slot's
//! ring decoder, the IPC state machine, the owner and the HVF engine): issued
//! in order from 1 to ring::MAX_CALLS, at most ring::MAX_OUTSTANDING open
//! (sent and not yet answered) at a time, each answered once. An open call
//! carries a host timestamp (when it was sent to Node) for STATS.
use crate::constants::ring;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Calls {
    next: u64,
    open: Vec<(u64, u64)>,
}
impl Default for Calls {
    fn default() -> Self {
        Self {
            next: 1,
            open: Vec::new(),
        }
    }
}
impl Calls {
    /// The id the next call must have.
    pub fn next(&self) -> u64 {
        self.next
    }
    /// Open call `id` (sent at `at`): false unless it is the next id, within
    /// MAX_CALLS, and fewer than MAX_OUTSTANDING are open.
    pub fn issue(&mut self, id: u64, at: u64) -> bool {
        if id != self.next
            || id > ring::MAX_CALLS as u64
            || self.open.len() >= ring::MAX_OUTSTANDING
        {
            return false;
        }
        self.next += 1;
        self.open.push((id, at));
        true
    }
    pub fn is_open(&self, id: u64) -> bool {
        self.open.iter().any(|&(i, _)| i == id)
    }
    /// Answer open call `id`: when it was issued, or None if it is not open.
    pub fn answer(&mut self, id: u64) -> Option<u64> {
        let at = self.open.iter().position(|&(i, _)| i == id)?;
        Some(self.open.swap_remove(at).1)
    }
    /// No call is waiting for its answer.
    pub fn idle(&self) -> bool {
        self.open.is_empty()
    }
    /// Calls issued so far.
    pub fn issued(&self) -> u64 {
        self.next - 1
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ids_in_order_within_the_window() {
        let mut c = Calls::default();
        assert!(!c.issue(2, 0), "ids start at 1");
        for id in 1..=ring::MAX_OUTSTANDING as u64 {
            assert!(c.issue(id, id));
        }
        let over = ring::MAX_OUTSTANDING as u64 + 1;
        assert!(!c.issue(over, 0), "outstanding bound");
        assert_eq!(c.answer(3), Some(3));
        assert_eq!(c.answer(3), None, "answered once");
        assert!(c.issue(over, 7));
        assert!(!c.idle() && c.is_open(over) && !c.is_open(3));
        assert_eq!(c.issued(), over);
    }
    #[test]
    fn at_most_max_calls() {
        let mut c = Calls::default();
        for id in 1..=ring::MAX_CALLS as u64 {
            assert!(c.issue(id, 0));
            assert_eq!(c.answer(id), Some(0));
        }
        assert!(!c.issue(ring::MAX_CALLS as u64 + 1, 0));
        assert!(c.idle());
    }
}

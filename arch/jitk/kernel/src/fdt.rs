// Trusted VMM FDT. Root addresses and sizes use two cells; every slice and
// number is checked before use, including tokens and names in both blocks.
#[derive(Debug)]
pub struct Config {
    pub seed: [u8; 16],
    pub epoch: u64,
    pub counter: u64,
    pub console: usize,
    pub dist: usize,
    pub redist: usize,
    pub irq: u32,
    pub tick: u64,
}
#[derive(Debug)]
pub enum Error {
    Header,
    Bounds,
    Token,
    Nesting,
    Number,
    Missing,
}
type Result<T> = core::result::Result<T, Error>;
const HEADER_BYTES: usize = 40;
const MAX_BYTES: usize = 0x200000;
const RAM_START: usize = 0x80000000;
const RAM_END: usize = 0x82000000;
fn be(b: &[u8], at: usize) -> Result<usize> {
    let bytes = b
        .get(at..at.checked_add(4).ok_or(Error::Bounds)?)
        .ok_or(Error::Bounds)?;
    Ok(u32::from_be_bytes(bytes.try_into().map_err(|_| Error::Bounds)?) as usize)
}
fn be64(b: &[u8], at: usize) -> Result<usize> {
    Ok((be(b, at)? << 32) | be(b, at + 4)?)
}
struct Cursor<'a> {
    bytes: &'a [u8],
    pos: usize,
}
impl<'a> Cursor<'a> {
    fn take(&mut self, len: usize) -> Result<&'a [u8]> {
        let end = self.pos.checked_add(len).ok_or(Error::Bounds)?;
        let value = self.bytes.get(self.pos..end).ok_or(Error::Bounds)?;
        self.pos = end;
        Ok(value)
    }
    fn word(&mut self) -> Result<usize> {
        be(self.take(4)?, 0)
    }
    fn name(&mut self) -> Result<&'a [u8]> {
        let rest = self.bytes.get(self.pos..).ok_or(Error::Bounds)?;
        let len = rest.iter().position(|&b| b == 0).ok_or(Error::Bounds)?;
        let value = self.take(len + 1)?;
        Ok(&value[..len])
    }
    fn align(&mut self) -> Result<()> {
        self.take((4 - self.pos % 4) % 4)?;
        Ok(())
    }
}
fn decimal(bytes: &[u8]) -> Result<u64> {
    if bytes.is_empty() {
        return Err(Error::Number);
    }
    bytes.iter().try_fold(0u64, |n, &b| {
        if !b.is_ascii_digit() {
            return Err(Error::Number);
        }
        n.checked_mul(10)
            .and_then(|n| n.checked_add(u64::from(b - b'0')))
            .ok_or(Error::Number)
    })
}
fn bootargs(c: &mut Config, bytes: &[u8]) -> Result<()> {
    for word in bytes.split(|&b| b == b' ' || b == 0) {
        if let Some(seed) = word.strip_prefix(b"jitk.seed=") {
            if seed.len() != 32 {
                return Err(Error::Number);
            }
            let hex = |b: u8| match b {
                b'0'..=b'9' => Ok(b - b'0'),
                b'a'..=b'f' => Ok(b - b'a' + 10),
                _ => Err(Error::Number),
            };
            for (out, pair) in c.seed.iter_mut().zip(seed.chunks_exact(2)) {
                *out = hex(pair[0])? * 16 + hex(pair[1])?;
            }
        }
        for (key, out) in [
            (b"jitk.epoch_ns=".as_slice(), &mut c.epoch),
            (b"jitk.counter=", &mut c.counter),
            (b"jitk.tick_us=", &mut c.tick),
        ] {
            if let Some(value) = word.strip_prefix(key) {
                *out = decimal(value)?;
            }
        }
    }
    Ok(())
}
#[derive(Clone, Copy)]
struct Node {
    reg: [usize; 4],
    irq: u32,
    virtio: bool,
    gic: bool,
}
const EMPTY: Node = Node {
    reg: [0; 4],
    irq: 0,
    virtio: false,
    gic: false,
};
pub fn parse(b: &[u8]) -> Result<Config> {
    if b.len() < HEADER_BYTES
        || be(b, 0)? != 0xd00dfeed
        || be(b, 4)? != b.len()
        || b.len() > MAX_BYTES
    {
        return Err(Error::Header);
    }
    let block = |off: usize, len: usize| -> Result<&[u8]> {
        if off < HEADER_BYTES {
            return Err(Error::Bounds);
        }
        b.get(off..off.checked_add(len).ok_or(Error::Bounds)?)
            .ok_or(Error::Bounds)
    };
    let structure = block(be(b, 8)?, be(b, 36)?)?;
    let strings = block(be(b, 12)?, be(b, 32)?)?;
    let mut cursor = Cursor {
        bytes: structure,
        pos: 0,
    };
    let mut c = Config {
        seed: [0; 16],
        epoch: 0,
        counter: 0,
        console: 0,
        dist: 0,
        redist: 0,
        irq: 0,
        tick: 0,
    };
    let mut nodes = [EMPTY; 32];
    let mut depth = 0usize;
    loop {
        match cursor.word()? {
            1 => {
                cursor.name()?;
                cursor.align()?;
                *nodes.get_mut(depth).ok_or(Error::Nesting)? = EMPTY;
                depth += 1;
            }
            2 => {
                depth = depth.checked_sub(1).ok_or(Error::Nesting)?;
                let n = nodes[depth];
                if n.virtio {
                    c.console = n.reg[0];
                    c.irq = n.irq;
                }
                if n.gic {
                    c.dist = n.reg[0];
                    c.redist = n.reg[2];
                }
            }
            3 => {
                let n = nodes
                    .get_mut(depth.checked_sub(1).ok_or(Error::Nesting)?)
                    .ok_or(Error::Nesting)?;
                let len = cursor.word()?;
                let name = cursor.word()?;
                let value = cursor.take(len)?;
                cursor.align()?;
                let mut names = Cursor {
                    bytes: strings,
                    pos: name,
                };
                match names.name()? {
                    b"compatible" => {
                        n.virtio = value.starts_with(b"virtio,mmio\0");
                        n.gic = value.starts_with(b"arm,gic-v3\0");
                    }
                    b"reg" if len >= 16 => {
                        n.reg[0] = be64(value, 0)?;
                        n.reg[1] = be64(value, 8)?;
                        if len >= 32 {
                            n.reg[2] = be64(value, 16)?;
                            n.reg[3] = be64(value, 24)?;
                        }
                    }
                    b"interrupts" if len >= 12 => {
                        n.irq = (be(value, 4)? as u32)
                            .checked_add(if be(value, 0)? == 0 { 32 } else { 16 })
                            .ok_or(Error::Number)?;
                    }
                    b"bootargs" => bootargs(&mut c, value)?,
                    _ => {}
                }
            }
            4 => {}
            9 if depth == 0 => break,
            _ => return Err(Error::Token),
        }
    }
    if c.console == 0 || c.dist == 0 || c.redist == 0 || c.epoch == 0 {
        return Err(Error::Missing);
    }
    Ok(c)
}
/// # Safety
/// `addr` names a VMM-owned FDT in mapped boot RAM. The VMM keeps those bytes
/// immutable until this call returns; the entire admitted RAM range is readable.
pub unsafe fn read(addr: usize) -> Config {
    assert!(
        addr >= RAM_START
            && addr
                .checked_add(HEADER_BYTES)
                .is_some_and(|end| end <= RAM_END)
    );
    // SAFETY: caller guarantees readable boot RAM; the header fits the range.
    let h = unsafe { core::slice::from_raw_parts(addr as *const u8, HEADER_BYTES) };
    let len = be(h, 4).expect("FDT total size");
    assert!(
        (HEADER_BYTES..=MAX_BYTES).contains(&len)
            && addr.checked_add(len).is_some_and(|end| end <= RAM_END)
    );
    // SAFETY: total size is bounded by mapped RAM, immutable per caller contract.
    let b = unsafe { core::slice::from_raw_parts(addr as *const u8, len) };
    parse(b).expect("invalid VMM boot configuration")
}

//! Bounded late-bound files encoded using the kernel's existing RO archive.
use crate::constants::ring;
use crate::streams::Output;
use std::collections::{BTreeMap, VecDeque};
use std::io::{self, Read, Write};
pub const MAX_ARCHIVE: usize = ring::ARCHIVE_LIMIT;
pub const MAX_FILES: usize = 64;
pub const MAX_REQUEST: usize = MAX_ARCHIVE + 16384;
pub struct Run {
    pub tool: String,
    pub args: Vec<String>,
    pub archive: Vec<u8>,
}
struct Reader<'a>(&'a [u8]);
impl<'a> Reader<'a> {
    fn bytes(&mut self, n: usize) -> Result<&'a [u8], &'static str> {
        let b = self.0.get(..n).ok_or("truncated native request")?;
        self.0 = &self.0[n..];
        Ok(b)
    }
    fn u16(&mut self) -> Result<usize, &'static str> {
        Ok(u16::from_le_bytes(self.bytes(2)?.try_into().unwrap()) as usize)
    }
    fn u32(&mut self) -> Result<usize, &'static str> {
        Ok(u32::from_le_bytes(self.bytes(4)?.try_into().unwrap()) as usize)
    }
    fn text(&mut self) -> Result<String, &'static str> {
        let len = self.u16()?;
        let s = std::str::from_utf8(self.bytes(len)?).map_err(|_| "non-UTF8 native argument")?;
        if s.contains('\0') {
            return Err("NUL in native argument");
        }
        Ok(s.to_string())
    }
}
#[derive(Default)]
struct Tree<'a> {
    children: BTreeMap<String, Tree<'a>>,
    data: Option<&'a [u8]>,
}
pub fn decode(bytes: &[u8]) -> Result<Run, &'static str> {
    if bytes.len() > MAX_REQUEST {
        return Err("native request budget");
    }
    let mut r = Reader(bytes);
    if r.bytes(4)? != b"JNR7" {
        return Err("native request magic");
    }
    let tool = r.text()?;
    if tool.is_empty()
        || tool.len() > 64
        || !tool
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
    {
        return Err("invalid tool profile");
    }
    let argc = r.u16()?;
    if argc == 0 || argc > ring::MAX_ARGS {
        return Err("native argc bound");
    }
    let mut args = Vec::with_capacity(argc);
    let mut arg_bytes = 0;
    for _ in 0..argc {
        let a = r.text()?;
        arg_bytes += a.len() + 1;
        if arg_bytes > ring::SOURCE_LIMIT {
            return Err("native argv budget");
        }
        args.push(a);
    }
    let count = r.u16()?;
    if count > MAX_FILES {
        return Err("native file count");
    }
    let mut files = Tree::default();
    for _ in 0..count {
        let path = r.text()?;
        if path.is_empty() || path.len() > 1024 || path.starts_with('/') {
            return Err("invalid input path");
        }
        let len = r.u32()?;
        let data = r.bytes(len)?;
        insert_owned(&mut files, path, data)?;
    }
    if !r.0.is_empty() {
        return Err("trailing native request bytes");
    }
    let archive = archive(&files)?;
    Ok(Run {
        tool,
        args,
        archive,
    })
}
fn insert_owned<'a>(tree: &mut Tree<'a>, path: String, data: &'a [u8]) -> Result<(), &'static str> {
    let mut node = tree;
    let mut depth = 0;
    for part in path.split('/') {
        depth += 1;
        if part.is_empty() || part == "." || part == ".." || part.len() > 255 || depth > 16 {
            return Err("invalid input path component");
        }
        if node.data.is_some() {
            return Err("input file/directory collision");
        }
        node = node.children.entry(part.to_string()).or_default();
    }
    if node.data.is_some() || !node.children.is_empty() {
        return Err("duplicate/colliding input file");
    }
    node.data = Some(data);
    Ok(())
}
fn archive(tree: &Tree<'_>) -> Result<Vec<u8>, &'static str> {
    let mut queue = VecDeque::from([(String::new(), 0usize, tree)]);
    let mut nodes = Vec::new();
    while let Some((name, parent, node)) = queue.pop_front() {
        let first = nodes.len() + queue.len() + 1;
        let me = nodes.len();
        for (name, child) in &node.children {
            queue.push_back((name.clone(), me, child));
        }
        nodes.push((name, parent, node, first));
        if nodes.len() + queue.len() > 1025 {
            return Err("input node budget");
        }
    }
    let names_start = 16 + nodes.len() * 24;
    let data_start = names_start + nodes.iter().map(|(n, _, _, _)| n.len()).sum::<usize>();
    let total = data_start
        + nodes
            .iter()
            .filter_map(|(_, _, n, _)| n.data.map(<[u8]>::len))
            .sum::<usize>();
    if total > MAX_ARCHIVE {
        return Err("input archive budget");
    }
    let mut b = vec![0; total];
    b[..8].copy_from_slice(b"JITKFS01");
    b[8..12].copy_from_slice(&(nodes.len() as u32).to_le_bytes());
    let mut names = names_start;
    let mut data = data_start;
    for (i, (name, parent, node, first)) in nodes.iter().enumerate() {
        let (dir, a, n) = if let Some(bytes) = node.data {
            let at = data;
            b[at..at + bytes.len()].copy_from_slice(bytes);
            data += bytes.len();
            (0, at, bytes.len())
        } else {
            (1, *first, node.children.len())
        };
        for (j, w) in [names, name.len(), *parent, dir, a, n].iter().enumerate() {
            b[16 + i * 24 + j * 4..20 + i * 24 + j * 4].copy_from_slice(&(*w as u32).to_le_bytes());
        }
        b[names..names + name.len()].copy_from_slice(name.as_bytes());
        names += name.len();
    }
    Ok(b)
}
/// A worker response payload (ABI-R7 "Persistent worker IPC"): five u32
/// words (worker status, guest status, stdout and stderr lengths,
/// outputLimited), then stdout and stderr; a failure zeroes the last four
/// and carries at most 512 diagnostic bytes.
pub fn response(out: Result<Output, String>) -> Vec<u8> {
    let mut b = Vec::new();
    match out {
        Ok(out) => {
            for w in [
                0,
                out.exit_code,
                out.stdout.len() as u32,
                out.stderr.len() as u32,
                out.limited as u32,
            ] {
                b.extend_from_slice(&w.to_le_bytes());
            }
            b.extend_from_slice(&out.stdout);
            b.extend_from_slice(&out.stderr);
        }
        Err(e) => {
            for w in [1, 0, 0, 0, 0] {
                b.extend_from_slice(&u32::to_le_bytes(w));
            }
            b.extend_from_slice(e.as_bytes().get(..512).unwrap_or(e.as_bytes()));
        }
    }
    b
}
/// The persistent worker's frame loop, on every host: u32-le length-prefixed
/// JNR7 requests from `input`, one response frame each to `output`, until
/// `input` ends. `run` executes one decoded request at a fresh, strictly
/// increasing generation (the worker picks the profile).
pub fn serve(
    input: &mut impl Read,
    output: &mut impl Write,
    mut run: impl FnMut(&Run, u64) -> Result<Output, String>,
) -> io::Result<()> {
    let mut generation = 1u64;
    loop {
        let mut head = [0; 4];
        match input.read(&mut head[..1])? {
            0 => return Ok(()),
            _ => input.read_exact(&mut head[1..])?,
        };
        let len = u32::from_le_bytes(head) as usize;
        if len > MAX_REQUEST {
            return Err(io::Error::other("native IPC frame budget"));
        }
        let mut bytes = vec![0; len];
        input.read_exact(&mut bytes)?;
        generation = generation
            .checked_add(1)
            .ok_or_else(|| io::Error::other("native generation exhausted"))?;
        let out = decode(&bytes)
            .map_err(str::to_string)
            .and_then(|r| run(&r, generation));
        let b = response(out);
        output.write_all(&(b.len() as u32).to_le_bytes())?;
        output.write_all(&b)?;
        output.flush()?;
    }
}
#[cfg(test)]
mod tests {
    use super::decode;
    fn text(b: &mut Vec<u8>, s: &str) {
        b.extend_from_slice(&(s.len() as u16).to_le_bytes());
        b.extend_from_slice(s.as_bytes());
    }
    fn request(paths: &[&str]) -> Vec<u8> {
        let mut b = b"JNR7".to_vec();
        text(&mut b, "busybox");
        b.extend_from_slice(&1u16.to_le_bytes());
        text(&mut b, "busybox");
        b.extend_from_slice(&(paths.len() as u16).to_le_bytes());
        for p in paths {
            text(&mut b, p);
            b.extend_from_slice(&3u32.to_le_bytes());
            b.extend_from_slice(b"a\0b");
        }
        b
    }
    #[test]
    fn bounded_tree_and_binary_data() {
        let r = decode(&request(&["data/a", "data/b", "empty"])).unwrap();
        assert_eq!(&r.archive[..8], b"JITKFS01");
        assert_eq!(r.args, ["busybox"]);
        assert!(r.archive.ends_with(b"a\0b"));
        assert_eq!(u32::from_le_bytes(r.archive[8..12].try_into().unwrap()), 5);
    }
    #[test]
    fn hostile_inputs() {
        for paths in [
            vec!["../a"],
            vec!["a//b"],
            vec!["/a"],
            vec!["a", "a"],
            vec!["a", "a/b"],
            vec!["a/b", "a"],
        ] {
            assert!(decode(&request(&paths)).is_err(), "{paths:?}");
        }
        let good = request(&["data/a"]);
        for n in 0..good.len() {
            assert!(decode(&good[..n]).is_err());
        }
        let mut bad = good.clone();
        bad.push(0);
        assert!(decode(&bad).is_err());
    }
}

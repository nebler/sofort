// QuickJS std/os file access against the read-only archive.
const esc = s => String(s).replace(/[^\x20-\x7e]/g, c => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0'));
const out = (...a) => { std.out.puts(a.map(esc).join(' ') + '\n'); std.out.flush(); };
out(std.loadFile('/skills/readme.md'));
const [st, e] = os.stat('/skills/readme.md'); out(st.mode, st.size, e);
const [ds, de] = os.stat('/skills'); out(ds.mode, de);
const [lst, le] = os.lstat('/scripts/x.lua'); out(lst.size, le);
const [names, re] = os.readdir('/skills'); out(names.sort().join(','), re);
out(JSON.stringify(os.readdir('/nope')));
const f = std.open('/skills/readme.md', 'r'); f.seek(2, std.SEEK_SET); out(f.getline(), f.tell()); out(f.readAsString()); f.close();
out(std.open('/nope', 'r'));
const err = {}; out(std.open('/skills/readme.md', 'w', err), err.errno);
const fd = os.open('/data/big.bin', os.O_RDONLY); const ab = new ArrayBuffer(70000);
out(os.read(fd, ab, 0, 70000), new Uint8Array(ab, 65530, 4).join(','), os.seek(fd, 0, std.SEEK_END)); os.close(fd);
out(os.open('/skills/x', os.O_WRONLY | os.O_CREAT));
out(JSON.stringify(os.readlink('/skills/readme.md')), JSON.stringify(os.getcwd()));
out(std.loadFile('/nope'));

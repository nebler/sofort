// Stand-in for `real native-worker` (shard/ABI-R7.md "Persistent worker IPC"):
// the same JNR8 request and response frames, with behaviour chosen by argv[1].
// native-check.ts drives the NativeBackend with it on any host.
//   echo A B   stdout "A B", stderr = the input files' contents, exit 3
//   delay MS   respond like echo after MS milliseconds
//   big        1 MiB of stdout, outputLimited
//   fail       worker-reported sandbox failure (status 1); the worker stays usable
//   spin       the run's budget expires: status 2 after the request's budget
//   pid        stdout this worker's pid
//   garbage    an invalid response length
//   crash      the worker exits
//   hang       never respond
if (process.argv[2] !== 'native-worker') process.exit(2);
let input = Buffer.alloc(0);
const respond = (status, code, out, err, limited) => {
  const head = Buffer.alloc(24);
  head.writeUInt32LE(20 + out.length + err.length, 0); head.writeUInt32LE(status, 4); head.writeUInt32LE(code, 8);
  head.writeUInt32LE(status ? 0 : out.length, 12); head.writeUInt32LE(status ? 0 : err.length, 16); head.writeUInt32LE(limited, 20);
  process.stdout.write(Buffer.concat([head, out, err]));
};
function handle(b) {
  if (b.subarray(0, 4).toString() !== 'JNR8') process.exit(3);
  let at = 4;
  const u16 = () => { const n = b.readUInt16LE(at); at += 2; return n; };
  const text = () => { const n = u16(); const s = b.subarray(at, at + n).toString(); at += n; return s; };
  const budget = b.readUInt32LE(at); at += 4;
  if (budget === 0) process.exit(5);
  text();
  const argv = Array.from({length: u16()}, text);
  const files = [];
  for (let n = u16(); n > 0; n--) { text(); const len = b.readUInt32LE(at); at += 4; files.push(b.subarray(at, at + len)); at += len; }
  if (at !== b.length) process.exit(4);
  const echo = () => respond(0, 3, Buffer.from(argv.slice(2).join(' ')), Buffer.concat(files), 0);
  switch (argv[1]) {
    case 'echo': return echo();
    case 'delay': return void setTimeout(echo, Number(argv[2]));
    case 'big': return respond(0, 0, Buffer.alloc(1024 * 1024, 120), Buffer.alloc(0), 1);
    case 'fail': return respond(1, 0, Buffer.from('slot failure'), Buffer.alloc(0), 0);
    case 'spin': return void setTimeout(() => respond(2, 0, Buffer.from('native run budget expired'), Buffer.alloc(0), 0), budget);
    case 'pid': return respond(0, 0, Buffer.from(String(process.pid)), Buffer.alloc(0), 0);
    case 'garbage': { const g = Buffer.alloc(8); g.writeUInt32LE(3, 0); return void process.stdout.write(g); }
    case 'crash': return process.exit(9);
    case 'hang': return;
    default: return respond(0, 0, Buffer.alloc(0), Buffer.alloc(0), 0);
  }
}
process.stdin.on('data', chunk => {
  input = Buffer.concat([input, chunk]);
  while (input.length >= 4 && input.length >= 4 + input.readUInt32LE(0)) {
    const n = input.readUInt32LE(0);
    handle(input.subarray(4, 4 + n)); input = input.subarray(4 + n);
  }
});
process.stdin.on('end', () => process.exit(0));

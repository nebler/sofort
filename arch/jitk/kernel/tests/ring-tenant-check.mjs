// Ring JS profile: what tenant code can do to the kernel through std/os stays
// inside its own run and ends it normally (2026-10-29 review fixes 1-3).
// Drives the executor over the HVF (macOS) or KVM (Linux) ring engine with the
// prepared glue-2m snapshot:
//   make -C arch/jitk/shard snapshot && arch/jitk/executor/run.sh build
//   JITK_SHARD_BINARY=... JITK_SHARD_SNAPSHOT=... node kernel/tests/ring-tenant-check.mjs
// (`make -C arch/jitk/kernel test-ring` sets both from the deps cache.)
import assert from 'node:assert/strict';

const binary = process.env.JITK_SHARD_BINARY,
  snapshot = process.env.JITK_SHARD_SNAPSHOT;
if (!binary || !snapshot) throw Error('ring-tenant-check needs JITK_SHARD_BINARY and JITK_SHARD_SNAPSHOT');
const { ShardBackend, SandboxPool, MicroVMExecutor } = await import(
  new URL('../../executor/build/executor.js', import.meta.url).href
);
const backend = new ShardBackend({ binary, snapshot, slots: 2 });
backend.child.stderr.on('data', b => process.stderr.write(b));
const pool = new SandboxPool(backend, 0, 2, { refillConcurrency: 2 });
const executor = new MicroVMExecutor(pool, () => 'allow', 10000);
let passed = 0;
async function expect(name, code, result) {
  const r = await executor.execute(code, {});
  await pool.drain();
  assert.equal(r.error, undefined, name + ': ' + String(r.error?.message ?? r.error));
  assert.deepEqual(r.result, result, name);
  passed++;
  console.log(JSON.stringify({ event: 'check', name }));
}
try {
  // 1. stdout/stderr have no reader in this profile and never become LOG
  // records: non-ASCII and control bytes do not stop the guest, volume does
  // not spend the run's LOG budget; writes report their full length.
  await expect(
    'print non-ASCII and control bytes',
    'print("é");std.out.puts("a\\x01\\x7f\\n");std.err.puts("\\x02");std.out.flush();std.err.flush();return 1',
    1,
  );
  await expect('print past the LOG budget', 'for(let i=0;i<8;i++)print("x".repeat(3000));std.out.flush();return 2', 2);
  await expect(
    'os.write to fd 1 and 2 returns the length',
    'const b=new Uint8Array(65536).fill(1).buffer;return [os.write(1,b,0,b.byteLength),os.write(2,b,0,4096),os.write(1,b,0,0)]',
    [65536, 4096, 0],
  );
  // 2. Unregistered syscalls return ENOSYS without exhausting the LOG budget,
  // repeated (20 x mkdirat) or distinct (more numbers than the report bound).
  await expect('repeated missing syscall', 'let r;for(let i=0;i<20;i++)r=os.mkdir("/d"+i);return r', -38);
  await expect(
    'many distinct missing syscalls',
    [
      'let n=0;const t=f=>{try{f();}catch{}n++;};',
      'for(let i=0;i<3;i++){',
      't(()=>os.mkdir("/m"));t(()=>os.remove("/r"));t(()=>os.rename("/a","/b"));t(()=>os.symlink("/a","/l"));',
      't(()=>os.utimes("/a",0,0));t(()=>os.sleep(0));t(()=>os.pipe());t(()=>os.dup(0));t(()=>os.dup2(0,9));',
      't(()=>os.kill(0,0));t(()=>os.waitpid(-1,1));}',
      'return n',
    ].join(''),
    33,
  );
  // 3. The checkpoint fd belongs to the bootstrap; after restore it is EBADF,
  // not a kernel panic, and the next run is unaffected.
  await expect(
    'checkpoint fd after restore',
    'return [os.write(100,new ArrayBuffer(1),0,1),os.write(100,new ArrayBuffer(1),0,1)]',
    [-9, -9],
  );
  await expect('next run after the checkpoint probe', 'return 3', 3);
} finally {
  await backend.close();
}
console.log(JSON.stringify({ event: 'pass', checks: passed }));

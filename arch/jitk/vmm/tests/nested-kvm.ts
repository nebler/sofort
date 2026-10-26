import { chmodSync, cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { argument, capture, check, dump, output, run } from '../lib.ts';
const root = resolve(import.meta.dirname, '..');
const binary = argument('binary', '/tmp/jitk-01/r3/linux/jitk-vmm');
const kernel = argument('kernel', resolve(root, '../kernel/dist/kernel.bin'));
const base = argument('base', '/tmp/jitk-07/kvm');
const repeats = Number(argument('repeats', '30'));
const out = '/tmp/jitk-01/r3/nested';
const stage = join(out, 'stage');
const work = join(stage, 'work');
mkdirSync(work, { recursive: true });
cpSync(binary, join(work, 'jitk-vmm'));
cpSync(argument('probe', join(dirname(binary), 'seccomp-probe')), join(work, 'seccomp-probe'));
cpSync(kernel, join(work, 'kernel.bin'));
cpSync('/tmp/jitk-01/r3/images', join(work, 'images'), { recursive: true });
mkdirSync(join(work, 'tests'), { recursive: true });
mkdirSync(join(work, 'src'), { recursive: true });
await run(['make', '-C', root, 'linux-tools']);
for (const name of ['check', 'console-abuse', 'seccomp-check']) {
  cpSync(join(root, '.work/linux/tests', name), join(work, 'tests', name));
  chmodSync(join(work, 'tests', name), 0o755);
}
cpSync(join(root, 'src/main.rs'), join(work, 'src/main.rs'));
writeFileSync(join(work, 'run.sh'), `#!/bin/sh
cd /work
export JITK_VMM_ROOT=/work
echo "NESTED-LOAD: $(cat /proc/loadavg) UPTIME: $(cat /proc/uptime)"
tests/check --binary /work/jitk-vmm --images /work/images --kernel /work/kernel.bin --output /tmp/checks.json --repeats ${repeats}
status=$?
echo "CHECK-EXIT $status"
if [ "$status" = 0 ]; then echo CHECKS-PASS; cat /tmp/checks.json; fi
tests/console-abuse --binary /work/jitk-vmm --images /work/images --output /tmp/console.json --repeats ${repeats} && echo CONSOLE-PASS
tests/seccomp-check
`);
writeFileSync(join(stage, 'init'), `#!/bin/sh
mkdir -p /proc /sys /dev /tmp
mount -t proc proc /proc
mount -t sysfs sys /sys
mount -t devtmpfs dev /dev 2>/dev/null
mount -t tmpfs tmp /tmp
mkdir -p /sys/fs/cgroup
mount -t cgroup2 none /sys/fs/cgroup
echo "KVMCHECK: $(ls -la /dev/kvm 2>&1)"
/work/run.sh
echo INIT-DONE
echo o > /proc/sysrq-trigger
sleep 10
`);
for (const path of [join(work, 'run.sh'), join(stage, 'init'), join(work, 'jitk-vmm')]) {
  chmodSync(path, 0o755);
}
const files = (await run(['find', '.'], { cwd: stage })).stdout;
const archive = (await run(['cpio', '-o', '-H', 'newc'], { cwd: stage, input: files })).stdout;
const initrd = join(out, 'test.cpio.gz');
writeFileSync(initrd, Buffer.concat([readFileSync(join(base, 'base.cpio.gz')), gzipSync(archive, { level: 1 })]));
const load = output(['uptime']).trim();
const command = ['qemu-system-aarch64', '-M', 'virt,virtualization=on,gic-version=3', '-accel', 'hvf', '-cpu', 'host', '-smp', '4', '-m', '3072', '-kernel', join(base, 'vmlinuz'), '-initrd', initrd, '-append', 'console=ttyAMA0 rdinit=/init quiet', '-nographic', '-no-reboot'];
const started = performance.now();
const result = await capture(command, { timeout: 480 });
const text = Buffer.concat([result.stdout, result.stderr]).toString().replaceAll('\r', '');
const evidence = join(root, process.env.JITK_RECORD === '1' ? 'evidence' : '.work');
mkdirSync(evidence, { recursive: true });
writeFileSync(join(evidence, 'nested-kvm.log'), text);
dump(join(evidence, 'nested-kvm-meta.json'), { uptime: load, command, elapsed_s: (performance.now() - started) / 1000, qemu_rc: result.returncode, functional_only: true });
console.log(text.slice(-4000));
check(['CHECKS-PASS', 'CONSOLE-PASS', 'SECCOMP-PASS', 'INIT-DONE'].every(marker => text.includes(marker)), 'nested suite failed; see ' + evidence + '/nested-kvm.log');
const payload = text.split('CHECKS-PASS\n')[1].trimStart();
// The serial stream continues after the JSON receipt; find its balanced object.
let depth = 0;
let quoted = false;
let escaped = false;
let end = 0;
for (let i = 0; i < payload.length; i += 1) {
  const char = payload[i];
  if (quoted) {
    if (escaped) {
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === '"') {
      quoted = false;
    }
  } else if (char === '"') {
    quoted = true;
  } else if (char === '{') {
    depth += 1;
  } else if (char === '}') {
    depth -= 1;
    if (depth === 0) {
      end = i + 1;
      break;
    }
  }
}
check(end > 0, 'missing nested JSON receipt');
dump(join(evidence, 'checks-linux.json'), JSON.parse(payload.slice(0, end)) as unknown);

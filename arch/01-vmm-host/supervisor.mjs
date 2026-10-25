// Transport/lifecycle sketch for Node 24.22.1. Policy/JSON validation belongs to executor.
// Production must supply an already configured sandbox entry point as binary/argv.
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

export function launchVm({ binary, argv, bootMs = 1000, parkMs = 10000, onData = () => {} }) {
  const child = spawn(binary, argv, { env: {}, stdio: ['pipe', 'pipe', 'pipe'] });
  let phase = 'boot', reason = null, timer, deadline = Infinity;
  let diagnosticBytes = 0;
  function kill(why) {
    if (phase === 'reaped') return;
    reason ??= why;
    phase = 'destroy';
    clearTimeout(timer);
    // Child handle, never a stale saved PID. No descendants are allowed by sandbox.
    child.kill('SIGKILL');
    child.stdin.destroy();
  }
  function arm(ms, why) {
    clearTimeout(timer);
    deadline = performance.now() + ms;
    timer = setTimeout(() => kill(why), ms);
  }
  function checkDeadline() {
    if (performance.now() >= deadline) { kill('deadline'); return false; }
    return phase !== 'destroy' && phase !== 'reaped';
  }
  const reaped = new Promise(resolve => {
    let spawnError;
    child.on('error', error => { spawnError = error.message; reason ??= 'spawn'; });
    child.once('close', (code, signal) => {
      phase = 'reaped'; clearTimeout(timer);
      // Pool releases its active slot only here. Caller need not block on this promise.
      resolve({ code, signal, reason, spawnError });
    });
  });
  child.stdin.on('error', () => kill('pipe'));
  child.stdout.on('data', bytes => {
    if (!checkDeadline()) return;
    // Consumer MUST bound frames/total output and reject malformed JSON before tool calls.
    try { onData(bytes); } catch { kill('protocol'); }
  });
  child.stderr.on('data', bytes => {
    diagnosticBytes += bytes.length;
    if (diagnosticBytes > 65536) kill('diagnostic-budget');
  });
  arm(bootMs, 'boot-deadline');
  return {
    pid: child.pid, reaped, kill, checkDeadline,
    get phase() { return phase; },
    ready() {
      if (phase !== 'boot' || !checkDeadline()) throw Error('invalid ready');
      phase = 'park'; arm(parkMs, 'park-expired');
    },
    // Invoke once, after a validated READY and with the executor's bounded encoded frame.
    run(frame, timeoutMs) {
      if (phase !== 'park' || !checkDeadline()) throw Error('invalid run');
      if (frame.length > 65536) throw Error('code frame too large');
      phase = 'run'; arm(timeoutMs, 'execution-deadline');
      return child.stdin.write(frame); // Caller observes backpressure; no unbounded send queue.
    },
    complete() { kill('completed'); }, // Logical result may resolve now; reaping stays async.
  };
}

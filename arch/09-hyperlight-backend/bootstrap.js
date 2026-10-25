// Snapshot this generic handler before executing any tenant code.
// Rust registry key is literally "jitk"; the NAPI wrapper would use "host:jitk".
import * as bridge from 'jitk';
function handler(event) {
  for (const [ns, names] of event.api) {
    const mod = Object.create(null);
    for (const fn of names) {
      // Host callback blocks this guest until the supervisor replies.
      mod[fn] = async (...args) => bridge.call(ns, fn, args);
    }
    Object.defineProperty(globalThis, ns, { value: Object.freeze(mod) });
  }
  const run = new Function(`return (async () => { ${event.code}\n })()`);
  return run();
}

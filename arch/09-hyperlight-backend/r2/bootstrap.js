// A fixed pre-tenant handler, used verbatim by all three Hyperlight modes.
import * as bridge from 'jitk';
async function handler(event) {
  let next = 1;
  try {
    const params = [], values = [];
    for (const [ns, names] of Object.entries(event.ns)) {
      const mod = Object.create(null);
      for (const fn of names) mod[fn] = async (...args) => {
        if (next > 4096) throw Error('call limit');
        const id = next++;
        // Synchronous crossing: Promise.all cannot overlap these exchanges.
        const r = bridge.exchange({t:'call', id, ns, fn, args});
        if (r.t !== 'ret' || r.id !== id) throw Error('invalid reply');
        if (Object.hasOwn(r, 'err')) {
          const e = Error(r.err.message); e.code = r.err.code; throw e;
        }
        return r.ok;
      };
      params.push(ns); values.push(Object.freeze(mod));
    }
    let logs = 0, bytes = 0;
    const localConsole = Object.freeze(Object.fromEntries(
      ['log','info','warn','error','debug'].map(level => [level, (...args) => {
        const msg = args.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ').slice(0,4096);
        if (++logs <= 1024 && (bytes += msg.length) <= 262144)
          bridge.exchange({t:'log', level, msg});
      }])));
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const value = await new AsyncFunction(...params,'console','print',event.code)(...values,localConsole,localConsole.log);
    return {t:'done', ok:value === undefined ? null : value};
  } catch (e) {
    return {t:'done', err:{name:String(e.name || 'Error').slice(0,128),
      message:String(e.message || e).slice(0,4096)}};
  }
}

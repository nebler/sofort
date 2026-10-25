# executor/policy — host policy and dispatcher rules (owner: 07; binding per DECISIONS-R2 E5)

`policy.mjs` is plain ESM with no dependencies; its types are in `policy.d.ts`. 04 loads it through `executor/policy-adapter.ts`.

## Hook signature 04 must call, once per guest `call` frame (after 03's decoder caps and parse)
```ts
import {createRun, decide, approve, dispatch, Violation} from './policy/policy.mjs';
const run = createRun({tools, deadline: Date.now()+timeoutMs, limits?: {calls, outstanding, denials}});
try {
  const d = decide(run, {t:'call', id, ns, fn, args});        // sync; never invokes a tool
  if (d.kind === 'deny') reply({t:'ret', id, err:{code:'DENIED', message:d.reason}});
  let call = d.call;
  if (d.kind === 'approve') {                                  // human/host approval UI, bound to d.digest
    if (!(await approvalUI(d.call))) return reply(DENIED);
    call = approve(run, d.digest);                             // single use; null => DENIED
  }
  const value = await dispatch(run, call, {issuer, signal});   // mints + revokes a scoped credential
  reply({t:'ret', id, ok:value});
} catch (e) { if (e instanceof Violation) { run.dead = true; sigkillVm(); failRun(); } else reply(TOOL_ERROR); }
```

## Rules
- **Kill (`Violation`).** All of these SIGKILL the VM and fail the run:
  - an extra or missing envelope key, or `t` other than `call`;
  - an id that is not exactly the next one;
  - a name that does not match `[A-Za-z_$][A-Za-z0-9_$]{0,63}`;
  - an **unknown tool**, including prototype names, since generated stubs never emit one;
  - exceeding the call budget (256) or the outstanding limit (64);
  - a passed deadline;
  - more than 16 denials;
  - dispatching any call object that `decide`/`approve` did not grant, including replays.

  A violation makes the run dead, so every later call is also a violation.
- **Deny (sent to the guest as `err`).** The strict `tool.args` validator throws, or a taint rule forbids the call.
- **Taint (v0).** Labels are sticky, owned by the host, and kept per run.
  - **Confidentiality.** After a `reads:'private'` result, an `egress` tool needs approval if it is `endorsable`; otherwise it is denied.
  - **Integrity.** After any tool output, a `writes` tool needs approval.
- **Credentials.** Each call gets one from `issuer.issue({run,scope:'ns.fn',ttlMs})`, which is passed only to `tool.invoke` and revoked in `finally`. It is never placed in a frame.
- **v1 (not built).** Host-side opaque handles for private data. Per-value labels inside the VM are unsound because the interpreter is attacker-controlled.
- **Framing.** `LineReader` enforces the frame cap before accumulating bytes. It is a reference for 03's decoder.

## Tests
```sh
/tmp/jitk-09/node-real policy-test.mjs      # 22 owner assertions
/tmp/jitk-09/node-real policy-hostile.mjs   # 32 H5 policy-bypass cases
```

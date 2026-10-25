04 / Round 4 — functional recertification PASS; F2 timing gate FAIL.
`executor/.R4` records this partial status and the exact tested hashes.

FIXED F1 (04-owned files): root derives from the emitted module location;
no checkout basename, old area fallback, or machine-specific temporary path.
`JITK_VMM_BINARY` and `JITK_KERNEL_IMAGE` select built inputs with clear missing
artifact errors. `JITK_NODE` must be an absolute real Node executable.
Compiled profiles use process-owned temporary directories, removed at exit.
Old machine-specific receipts moved to this area's r3-canonical-history/.
Relocated `clean` executor build, local selection, both overrides and missing
input rejection PASS (load1 94.55). Its real demo returns total=2, concurrent
host tools=2 (load1 64.17). This is executor portability, not aggregate I1.
See r4/portable-build.log, portable-selection.json and portable-demo.log.
07-owned policy/README.md still has two machine-specific Node examples; that
foreign subtree was left to its owner, per the hands-off rule.

FIXED F3: deleted fixtures/policy-owner-test.mjs; policy-check loads the canonical
policy/policy-test.mjs. Executor owns the sole per-VM watchdog used by 09's
ProcessBackend adapter; bench/hyperlight and executor/build have no watchdog copy.
Owned physical LOC=1158 (was1089), including tests/build, excluding 07 policy,
vendor/generated/cache/output; r4/owned-loc.json (inventory load1 140.85).

FIXED F2 mechanism: execute creates one absolute deadline, passes it at cold
watchdog startup or arms a parked watchdog through stdin, and awaits its ack
before guest run. Watchdog monotonic timer sends SIGKILL to the VMM process group
independently of Node; EOF also kills it. Lifetime remains an upper bound.
Executor rejects expired results. Tool.invoke gets context.signal; compatibility
provider functions get this.signal without changing positional guest arguments.
Signals are cooperative and cannot interrupt synchronous host JavaScript.

F2 FINAL n=30/case, original area-10 script with path substitutions and extra
watchdog timestamp/signal observation: r4/h5-resource-probe.mjs.
Blocking callback=200ms, deadline=30ms, load1 63.59–83.41:
- API overshoot<=50ms: 0/30; median elapsed214.215ms; max overshoot296.481ms.
- Recorded VM kill bound<=50ms:29/30; worst143.072ms. Watchdog receipts30/30.
- Timeout results30/30; recovery30/30; admitted callbacks29, signals29/29 aborted.
CPU loop, deadline=30ms, load1 73.06–112.85:
- API overshoot<=50ms:28/30; median elapsed34.240ms; max overshoot295.795ms.
- Recorded VM kill bound<=50ms:28/30; worst139.456ms. Watchdog receipts13/30;
  other kills came from the Node timer. These are kill syscall completion
  timestamps, not independently measured process-death times.
- Timeout results30/30; recovery30/30; no late successes in either case.
Raw final receipts/logs: r4/h5-resource-probe-final.*, h5-cpu-probe-final.*.
Earlier exploratory receipts are retained separately without the -final suffix.

FIXED F4 functional: frozen final certify exits0; executor/r4-certify.log and
.READY bind all inputs. Every hash remained unchanged through certification.
- 20/20 executor (includes actual TanStack): load1 136.22–140.85.
- Cloudflare wrappers2/2: load1 137.01–140.85.
- 30x64=1920 reversed-reply calls: load1 132.69–137.01.
- Canonical policy22 + executor policy22: load1 132.69–136.10.
- Hyperlight6/6: load1 129.28–136.10, explicit worker/snapshot overrides.
- Lifecycle/host ack/hostile transport/watchdog pass; load1 126.52–136.22.
- E4 n50 diagnostic, warm reserve2 (four-VM cap): load1 88.59–129.28;
  all kills after caller resolution; final tokens/creating/parked/live=0.
External inputs are cached as ignored outputs in executor/.cache/inputs/.
VMM v2 SHA256:
276463d01ac6956a095814ed77053989d21bb52a7ef702f5c2698eb98daba20e
Current kernel SHA256:
a7c39ab5679e75d3242f6f318cd5367ff866380e8f509085e974a49f1b6a6364
Executor bundle SHA256:
9a8552c76f79390f10ee2f8c278a5d9fb5dc287372cbb9ba50d15c04d94f53ed
Watchdog SHA256:
206b9d37ef9a0dea0a9c45829101f3fa50b47df3fbaa84d1324e4cb44a93e014

OPEN: prescribed watchdog fix cannot meet the original API-return criterion
while a host callback blocks the same Node thread200ms. Promise settlement and
signal delivery require that thread to resume. External watchdog scheduling also
exceeded50ms under recorded contention. F2/I2 remains FAIL; no quiet-host or
production Linux recertification claim. No foreign job/subtree was modified.
All owned launches were killed and reaped; at most four VMs were alive.

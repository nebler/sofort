# jitk channel protocol v1 — normative

This document supersedes both round-1 channel proposals. MUST means required.
The trusted endpoint is one TypeScript process containing dispatcher, policy,
tools and credentials (D9). The VMM and all guest data are outside that trust.

## Framing and encoding (D8)

Each direction is an independent byte stream. Each guest/host frame is exactly
one JSON object followed by LF (0x0A). A frame is at most 1,048,576 bytes excluding
LF. Partial reads/writes and multiple frames per read MUST work. No empty lines,
CRLF, BOM, tabs, comments, resynchronization, or raw bytes outside 0x20–0x7E.
Whitespace SPACE is allowed wherever JSON permits it. String newlines and controls
use JSON escapes; non-ASCII UTF-16 units use `\uXXXX` (pairs for supplementary
characters). Reject unpaired surrogates in keys or values, duplicate decoded
object keys at any depth, and numbers whose parsed value is nonfinite or exceeds
9,007,199,254,740,991 in absolute value. Fractional finite numbers are allowed.
JSON.parse number rounding/underflow semantics apply; exact large values use strings.

The kernel prefixes its own diagnostic records with byte 0x1E at line start,
then at most 4,096 printable ASCII bytes and LF. The remaining text is opaque,
not JSON. A record may appear only between complete guest frames. Kernel writers
MUST defer diagnostics until a partial guest line completes, or terminate the
VM without adding a record. These records never dispatch tools or establish success.
They share total byte/frame limits, including the prefix and LF.
Any other occurrence of 0x1E is a framing violation. Kernel panic/exit records
remain diagnostics; EOF/process status is never a successful application result.
The host recognizes these records before guest JSON parsing and bounds their sink.

On EL0 `write(1)`/`writev(1)`, any byte below 0x20 except LF MUST kill the guest;
the kernel MUST validate the entire write before emitting any of its bytes.
Thus EL0 cannot forge 0x1E records through the permitted syscall interface.
fd2 is dropped in production; development kernel output wraps fd2 as bounded
0x1E records. No raw kernel, qjs or VMM text belongs on the protocol stream.
An EL1 compromise can forge diagnostics; they are never authorization evidence.

## Message set (D10)

All fields shown are required; no extra envelope/error fields are permitted.
`ok` and `err` are mutually exclusive, distinguished by property presence.
`J` means any JSON value satisfying the limits, including null/false/arrays.

```text
G→H {"t":"ready","v":1}
H→G {"t":"run","code":"<async function body>","ns":{"github":["listIssues"]}}
G→H {"t":"call","id":1,"ns":"github","fn":"listIssues","args":[{"repo":"x"}]}
H→G {"t":"ret","id":1,"ok":J}
H→G {"t":"ret","id":1,"err":{"code":"DENIED","message":"policy denied"}}
G→H {"t":"log","level":"info","msg":"text"}
G→H {"t":"done","ok":J}
G→H {"t":"done","err":{"name":"Error","message":"execution failed"}}
```

There is no hello/code/result/error/fatal/cancel message or implicit version alias.
`run.code` is a JavaScript async function BODY, allowing top-level return/await;
static module imports are outside the body contract. v1 ships source to stock qjs.
`ns` maps names to arrays of allowed method names; args is always an ARRAY,
preserving variadic functions. Proxy namespaces are lexical AsyncFunction parameters.
Both names match `[A-Za-z_$][A-Za-z0-9_$]{0,63}`. Namespaces additionally exclude
this exact set (including strict-mode reserved words):
```text
await break case catch class const continue debugger default delete do else enum
export extends false finally for function if implements import in instanceof
interface let new null package private protected public return static super
switch this throw true try typeof var void while with yield arguments eval then
console print setTimeout clearTimeout globalThis
```
Methods named `then` and duplicate methods are forbidden (avoid thenable proxies).
At most 64 namespaces, 256 methods per namespace and 1,024 methods overall.
No prelude, binary envelope, aliases, or credentials are protocol fields.
Applications may agree on ordinary JSON base64 fields; transport does not decode them.

`ret.err.code` matches `[A-Z][A-Z0-9_]{0,63}`; message ≤4,096 UTF-16 units.
`done.err.name` ≤128 units and message ≤4,096 units. An error ret rejects one
promise and may be caught. An error done terminates the run. Empty error strings
are allowed except ret error code. Tool errors SHOULD use DENIED, TOOL_ERROR,
TOOL_TIMEOUT, BAD_ARGS or BAD_RESULT; host policy owns their interpretation.
Serialization follows JSON.stringify for nested undefined/nonfinite values;
top-level undefined tool/final results MUST become null. Cycles and BigInt
fail serialization. Serializing invalid scalar text/oversized values fails the run;
there is no silent truncation of tool args/results. Logs may be truncated/dropped.

## State and cancellation

Host state: awaiting-ready → parked → running → terminal; violations → dead.
One ready(v=1) is accepted, then exactly one host run, then call/log/done only.
The host binds run identity, principal, policy and deadline before sending run.
No guest message, including logs, is valid before run except ready. Kernel
diagnostics are permitted in every live state, including after done until reap.
After done, any additional guest frame is a violation; EOF on a complete done
is valid. EOF while parked/running or with any partial line is failure.

Call IDs are integers consecutive from 1, never reused, at most 4,096 per run.
Ret IDs MUST refer to currently outstanding calls; replies may be out of order.
A call becomes outstanding before its host callback. It ceases to be outstanding
only when the corresponding complete ret is committed to a bounded output queue.
No retry or ambiguous completion is allowed. A refused queue admission MUST
retain/retry the response without releasing credit or advancing state.
Successful done requires zero outstanding calls. Error done may have outstanding
calls (e.g. Promise.all rejection); all are cancelled and late completions dropped.
Host integrations MUST suppress late completions before calling the dispatcher.

There is no in-band cancellation. Deadline, external abort, protocol violation,
guest failure, or any done ends admission, aborts host work cooperatively and
destroys/reaps the single-use VM. Use an external wall-clock SIGKILL watchdog,
including for CPU loops and parked/never-settling guests; retain panic=abort and
one console port. Exit status cannot replace done. Killing cannot undo external
side effects; host tools need their own abort/deadline and idempotency behavior.
No per-call cancel, execution replay, reconnect, or VM reuse is specified.

## Fixed limits and failure handling

Limits apply to untrusted frames regardless of bootstrap behavior:

| Resource | Limit / accounting |
|---|---|
| Frame | 1,048,576 wire bytes excluding LF; check before accumulation |
| JSON depth | 32 nested containers, envelope counts as depth 1 |
| Structure | 32,768 opening string quotes and `{ } [ ] , :` outside strings |
| Code | 65,536 decoded UTF-8 bytes and the enclosing encoded frame cap |
| Calls | 64 outstanding; 4,096 total |
| Inflight args | 2,097,152 complete call-frame bytes including LF until ret commit |
| Wire | 16,777,216 bytes per direction including all LF/prefix bytes |
| G→H records | 8,192, including kernel records |
| Host output FIFO | ≤2 × (MAX_FRAME+1) bytes, one partial-write-safe writer |
| Logs | levels log/info/warn/error/debug; msg ≤4,096 decoded UTF-8 bytes |
| Log totals | 1,024 records, 262,144 decoded UTF-8 bytes |
| Kernel text | 4,096 bytes per record, bounded diagnostic sink |

Budget checks, schema/state checks and parsing MUST precede tool invocation.
Maintain byte budgets before appending chunks; a delimiter-free attack must not
allocate an unbounded string/fragment list. Limit depth/structure BEFORE JSON.parse.
Reject duplicate decoded keys with a bounded structural pre-scan; use the same
JSON.parse implementation to decode key escapes and the full document. Do not
introduce a second authoritative parser or merge objects into host prototypes.
Callbacks must admit bounded work synchronously and never await tools inside
the decoder. Continue draining guest output while tools/host writes wait.
Wire caps do not bound arbitrary provider SDK allocations: adapters must bound
tool inputs/outputs, network operations and global concurrent admissions too.

Local fatal codes: ASCII, FRAME_LIMIT, KERNEL_LIMIT, FRAME_COUNT, WIRE_LIMIT,
JSON, DUPLICATE, DEPTH, STRUCTURE, UNICODE, NUMBER, SCHEMA, ID, STATE,
CALL_LIMIT, OUTSTANDING, INFLIGHT, LOG_LIMIT, OUTSTANDING_DONE, EOF,
SERIALIZE, HOST_ERROR, CANCELLED, DEADLINE. Codes are host diagnostics, not wire
frames. Any violation poisons the dispatcher, cancels the run and invokes kill
exactly once. Do not send a recovery error to an untrusted broken stream.
When multiple rules fail, the first detected code wins; exact precedence is not
portable except for single-rule conformance cases. Bound diagnostic error text.

## Trust boundary and integration contract

Every call is untrusted intent, even a valid frame matching the namespace map.
The host MUST check own-property capability lookup, per-tool argument/result
schemas, principal, credentials, approvals, rate limits and policy for EVERY call.
Forged/unknown capabilities are denied by policy, never dispatched through
prototype lookup. The ns map helps the API; it grants no additional authority.
Freeze/copy the exact validated call snapshot for policy and invocation; never
reparse a raw frame differently or trust guest execution IDs/provenance/approvals.
Guest logs, final results, tool-supplied values and kernel records are untrusted
display data. Escape them for UI/audit sinks. No credentials enter guest memory.
Bootstrap/proxies are not a sandbox: guest code can import std/os or forge frames.
Native qjs pipe tests verify protocol behavior, not hardware/process containment.

# Hosted competitors (design only; deliberately not implemented)

All three should default-export the SPEC §1 adapter and keep tools in the
harness process. Programs are frozen; account startup, network and resource
costs belong in the measurements. No credentials or paid resources were used.

- **Vercel Sandbox**: boot a pinned Node/QuickJS runner in a fresh Sandbox;
  inject namespace proxies that POST to the host's HTTPS `/call` endpoint.
  Register an execution-scoped provider set before starting; release it after
  completion. Record VM creation/resume, CPU/vCPU time, memory-GB-seconds,
  sandbox duration, storage, egress, billed minimums and account region.
- **E2B**: use a versioned sandbox template with the same runner/proxies;
  return results and logs over the SDK while host tools use HTTPS callbacks.
  Record template hash, cold/resume time, vCPU/memory allocation, billed
  sandbox seconds, storage, egress, idle retention and cleanup time.
- **Deployed Cloudflare DynamicWorkerExecutor**: deploy the supervisor from
  `cf-worker.mjs`, keep `globalOutbound:null` on generated Workers, and let
  only supervisor tool closures call the authenticated host HTTPS endpoint.
  Use Worker Loader and native ToolDispatcher RPC inside Cloudflare. Record
  Worker requests, CPU-ms, applicable Dynamic Workers billing units,
  subrequests/egress, deployment/version id, region, cold startup and callback
  round-trip time. Verify actual invoice dimensions when enabling this arm.

HTTP shape (agreed with harness agent; `harness/contract.ts`):

```text
POST {url}/call
Authorization: Bearer {token}
Content-Type: application/json
{"executionId":"…","namespace":"api","tool":"echo","args":[{"x":1}]}
200 {"result":…}       // undefined becomes null
200 {"error":"…"}     // the guest tool promise rejects
4xx {"error":"…"}     // bad token, expired id, invalid call
```

`http-client.ts` implements this client. Harness recordings are plain JSON.
The local Cloudflare adapter also accepts codemode 0.5.5's
`__codemode_binary_v1__` envelopes via `executor/codec.mjs`; ordinary JSON is
unchanged. The local adapter owns its loopback callback listener and invokes
passed `fns`, so replay accounting remains in the harness's tool functions.
Hosted adapters should use the harness replay endpoint or an HTTPS tunnel to
an equivalent listener, never move tool execution into the remote sandbox.

Measure end-to-end latency from scheduled arrival, tool replay time, callback
wall time, executor overhead, answer correctness, maximum simultaneous tool
calls, timeout recovery and capacity reusable time. Separate cold service,
cold sandbox and warm runs. Keep all failed requests and incurred billing;
do not extrapolate hosted prices from local workerd measurements.

# scriptc 0.4.5 kernel findings

See ../docs/SCRIPTC-GAPS.md for process/env helpers. No upstream issues filed.

- Child-process ReadableStream.destroy is not in bundled declarations. Await
  close (which drains both pipes) and destroy only the writable stdin.
- Deep strict equality between a parsed frame projected into an optional-field
  interface and a fixed-layout object can report false despite identical JSON.
  Repro: parse ready into `{t:string,v?:number,id?:number}` and compare to the
  ready literal after an async receive. `same` round-trips both values through
  JSON before util.isDeepStrictEqual, preserving order-insensitive JSON equality.
- Python ctypes clock/process metrics require native APIs. Supported scriptc FFI
  links native.c (Mach counter/realtime/proc_pid_rusage) with explicit signatures.
  Tests/controllers, formats and pass/fail decisions remain TypeScript. Double
  milliseconds quantize realtime by about .00025 ms, within the original 1 ms
  clock bound; both 30-sample clock tests pass.
- No Python fallback remains. ELF64 fields use BigInt for decoding; out-of-arena
  values are refused before Number conversion, and alignment stays BigInt.

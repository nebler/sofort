# Native feasibility spike

From `arch/jitk/grow-ts`:

```sh
npm ci --no-audit --no-fund
mkdir -p build
node_modules/.bin/scriptc build spike/main.ts -o build/spike
build/spike --probe yes
```

scriptc 0.4.5 emits a Mach-O arm64 executable. All required primitives pass;
`SCRIPTC-GAPS.md` records refusals and the process API workaround. No Python
controller or Node process is used by the native spike.

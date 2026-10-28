import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import {
  ROOT,
  canonical,
  check,
  env,
  json,
  read,
  run,
  sha,
  type Json,
} from "./lib.ts";
export const WORK = canonical(process.env.JITK_WORK || join(ROOT, ".work"));
const IGNORED = new Set([
  ".work",
  "target",
  "target-ring",
  "dist",
  "__pycache__",
  ".READY",
  // Kernel tests leave read-only fixture trees here; never copy them.
  "test-work",
  "test-results",
  "node_modules",
  ".scriptc",
]);
// rmSync cannot remove entries inside read-only directories; restore owner write first.
function makeWritable(path: string): void {
  if (!existsSync(path) || lstatSync(path).isSymbolicLink()) {
    return;
  }
  const stat = lstatSync(path);
  chmodSync(path, stat.mode | 0o700);
  if (stat.isDirectory()) {
    for (const name of readdirSync(path)) {
      makeWritable(join(path, name));
    }
  }
}
function copyTree(source: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(source)) {
    if (IGNORED.has(name)) {
      continue;
    }
    const from = join(source, name);
    const to = join(dest, name);
    if (lstatSync(from).isDirectory()) {
      copyTree(from, to);
    } else {
      copyFileSync(from, to);
    }
  }
}
function rustFiles(directory: string): string[] {
  let result: string[] = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (lstatSync(path).isDirectory()) {
      result = result.concat(rustFiles(path));
    } else if (name.endsWith(".rs")) {
      result.push(path);
    }
  }
  return result;
}
export function splitCommand(text: string): string[] {
  const result: string[] = [];
  let word = "";
  let quote = "";
  let escape = false;
  let active = false;
  for (const c of text) {
    if (escape) {
      word += c;
      escape = false;
    } else if (c === "\\" && quote !== "'") {
      escape = true;
      active = true;
    } else if (quote) {
      if (c === quote) {
        quote = "";
      } else {
        word += c;
      }
    } else if (c === '"' || c === "'") {
      quote = c;
      active = true;
    } else if (/\s/.test(c)) {
      if (active || word.length) {
        result.push(word);
        word = "";
        active = false;
      }
    } else {
      word += c;
      active = true;
    }
  }
  check(!quote && !escape, "invalid shell words");
  if (active || word.length) {
    result.push(word);
  }
  return result;
}
export async function buildKernel(): Promise<void> {
  mkdirSync(WORK, { recursive: true });
  const dest = join(WORK, "kernel");
  makeWritable(dest);
  rmSync(dest, { recursive: true, force: true });
  copyTree(join(ROOT, "../kernel"), dest);
  const script = read(join(ROOT, "../protocol/bootstrap.js"));
  // The disposable source copy has neither tools/scriptc.mk nor compiled tools.
  // Execute canonical host tools while building only the copied kernel source.
  const tools = process.env.JITK_TOOLS_DIR || join(ROOT, "../kernel/.work", process.platform === "linux" ? "linux" : "bin");
  if (!process.env.JITK_TOOLS_DIR && process.platform === "darwin") {
    await run(["make", "-C", join(ROOT, "../kernel"), ".work/bin/prepare", ".work/bin/build-args", ".work/bin/artifact"], { inherit: true });
  }
  const variables = env({
    JITK_SCRIPT: script,
    CARGO_TARGET_DIR: join(WORK, "kernel-target"),
    JITK_OUT_DIR: WORK,
    JITK_TOOLS_DIR: canonical(tools),
    RUST_TOOLCHAIN: String(JSON.parse(read(join(ROOT, "../tools/deps.json"))).rust_toolchain),
  });
  if (process.platform === "linux") {
    variables.OBJCOPY = "llvm-objcopy";
  }
  await run(["sh", "build.sh"], { cwd: dest, env: variables, inherit: true });
  const files = [
    ...rustFiles(dest),
    join(dest, "Cargo.toml"),
    join(dest, "build.rs"),
    join(dest, "payload/qjs"),
  ];
  const inputs: Record<string, string> = {};
  for (const path of files) {
    inputs[relative(WORK, path)] = sha(path);
  }
  inputs["protocol/bootstrap.js"] = sha(join(ROOT, "../protocol/bootstrap.js"));
  writeFileSync(
    join(WORK, "kernel-inputs.json"),
    JSON.stringify(inputs, null, 2),
  );
}
export async function buildProbes(): Promise<void> {
  mkdirSync(WORK, { recursive: true });
  const module = read(join(ROOT, "../vmm/sandbox/mod.rs"));
  let source = module.slice(
    module.indexOf("pub mod bpf {"),
    module.indexOf("#[cfg(test)]"),
  );
  source +=
    '\nfn main() {\n use bpf::*;\n for (role,sets) in [("main",&[COMMON,MAIN,CONSOLE][..]),("vcpu",&[COMMON,VCPU][..]),("console",&[COMMON,CONSOLE][..])] {\n  let bytes:Vec<u8>=compile(sets).iter().flat_map(|n|n.to_le_bytes()).collect();\n  std::fs::write(format!("{role}.bpf"),bytes).unwrap();\n }\n}\n';
  writeFileSync(join(WORK, "filter-gen.rs"), source);
  await run(
    [
      "rustc",
      "--edition=2024",
      join(WORK, "filter-gen.rs"),
      "-o",
      join(WORK, "filter-gen"),
    ],
    { inherit: true },
  );
  await run([join(WORK, "filter-gen")], { cwd: WORK, inherit: true });
  const cc = splitCommand(process.env.CC || "cc");
  await run(
    [
      ...cc,
      "-O2",
      join(ROOT, "seccomp-probe.c"),
      "-o",
      join(WORK, "seccomp-probe"),
    ],
    { inherit: true },
  );
  writeFileSync(
    join(WORK, "probe-inputs.json"),
    JSON.stringify(
      {
        sandbox_module_sha256: sha(join(ROOT, "../vmm/sandbox/mod.rs")),
        probe_source_sha256: sha(join(ROOT, "seccomp-probe.c")),
      },
      null,
      2,
    ),
  );
}
export async function buildFaults(): Promise<void> {
  mkdirSync(WORK, { recursive: true });
  for (const name of [
    "bad-sysreg",
    "console_avail_oob",
    "mmio-halfword",
    "rtc_oob_read",
    "unknown-hvc",
    "unknown-smc",
  ]) {
    const source = join(ROOT, "../vmm/tests/fixtures", name + ".S");
    const obj = join(WORK, name + ".o");
    const image = join(WORK, name + ".bin");
    await run(["clang", "--target=aarch64-none-elf", "-c", source, "-o", obj], {
      inherit: true,
    });
    await run(
      [
        "ld.lld",
        "-T",
        join(ROOT, "guest/link.ld"),
        "--oformat=binary",
        obj,
        "-o",
        image,
      ],
      { inherit: true },
    );
  }
  copyFileSync(join(ROOT, "guest/kk.bin"), join(WORK, "kk.bin"));
}
interface Canonical {
  sandbox_ready: boolean;
  revision: string;
  panic: string;
  features: string[];
  binary_sha256: string;
  patches_sha256: Record<string, string>;
  [key: string]: unknown;
}
export function stageCanonical(path: string): void {
  const binary = canonical(path);
  const metadata = json(join(dirname(binary), "build.json")) as Canonical;
  check(
    metadata.sandbox_ready,
    "canonical binary still has fail-closed sandbox stub",
  );
  check(
    metadata.revision === "a1d8616765da03980f3be1bb8714bfdd3842f33c",
    "canonical revision",
  );
  check(
    metadata.panic === "abort" && metadata.features.length === 0,
    "canonical flags",
  );
  check(sha(binary) === metadata.binary_sha256, "canonical checksum");
  mkdirSync(WORK, { recursive: true });
  for (const name of Object.keys(metadata.patches_sha256)) {
    check(
      sha(join(ROOT, "../vmm/patches", name)) === metadata.patches_sha256[name],
      name + " patch drift",
    );
  }
  copyFileSync(binary, join(WORK, "jitk-vmm"));
  copyFileSync(join(dirname(binary), "build.json"), join(WORK, "build.json"));
  console.log(JSON.stringify(metadata));
}

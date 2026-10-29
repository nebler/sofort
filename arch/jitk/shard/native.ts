import { spawn, type ChildProcess } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { loadavg } from "node:os";
import { cacheRoot, requireArtifact } from "../tslib/deps.ts";
import { skipOrFail } from "../tslib/skip.ts";
import {
  ROOT,
  capture,
  cargoEnv,
  check,
  digest,
  dump,
  env,
  json,
  kill,
  locked,
  read,
  run,
  saveResult,
  sha,
  track,
  sleep,
  tool,
  type Json,
} from "./lib.ts";

interface Profile {
  binary: string;
  sha256: string;
  bytes: number;
  memory_class: string;
}
interface Case {
  tool: string;
  label: string;
  args: string[];
  files: Record<string, Buffer>;
}
const PINS: Record<string, string[]> = {
  "jq-musl": [
    "jq-musl",
    "8d689ba1c53a9aed4311a2f4406a33e8c7bbb4d7a54f50a7c8e1d393807e3ff7",
  ],
  sqlite3: [
    "sqlite3",
    "005073a6c1c0e71c22ad8b752f1ffb6c35c8d913fe91f5795038c7d52cf639ff",
  ],
  lua: [
    "lua",
    "6d825f225d7beff5a9707ec10db63cf3347524dc3ba183b16d0f6d809d2f0929",
  ],
  micropython: [
    "micropython",
    "4626bf11458cb18785515ddc8a26246a12aafa602fa197346327602489c4ca62",
  ],
  busybox: [
    "bb-gzip",
    "e6e0d9874eef980f1bf6ce107494bbaed97f37449815acb991f4dd0ed4eb5ec8",
  ],
  zstd: [
    "zstd",
    "5a52c331442b8939469c1337d2526167f4f17bf16fe976b37d8b8c1246b3002c",
  ],
};
const RUN = resolve(process.env.JITK_NATIVE_RUN_DIR || ROOT);
const RAW = join(RUN, "raw");
const MAC = process.platform === "darwin";
// The worker binary: Linux `real` (prepare builds it), macOS the signed HVF
// engine from the deps cache (JITK_SHARD_BINARY, `make -C arch/jitk deps`).
function real(): string {
  return MAC
    ? requireArtifact("JITK_SHARD_BINARY")
    : join(ROOT, "arch/jitk/shard/target/release/real");
}
// KVM measurements serialize on the bench lock; the Mac has none.
function measured(command: string[], wait?: number): string[] {
  return MAC ? command : locked(command, wait);
}
const BUILD_ENV = env(cargoEnv());
// The six census binaries are pinned inputs, not evidence: static aarch64
// musl builds from the R6 census (Alpine 3.21 recipes; jq differs from the
// upstream release asset). They are 0.3-1.4 MB each and have no URL that
// serves these exact bytes, so they live in a content-addressed store,
// CENSUS/<sha256>, filled once by `./tool.sh import-census PATH...`. The
// SQLite fixture is small and committed with its pin.
const CENSUS = resolve(
  process.env.JITK_NATIVE_CENSUS || join(cacheRoot(), "native-census"),
);
const DEMO_DB = join(ROOT, "arch/jitk/shard/harness/census-demo.db");
const DEMO_DB_SHA256 =
  "f3d4180cd07ad9eed5a674c7ff4e5f6d817eb517029c185f66af862a30eac059";
function censusBinary(name: string): string {
  return join(CENSUS, PINS[name][1]);
}
function censusMissing(): string[] {
  return Object.keys(PINS).filter((name) => !existsSync(censusBinary(name)));
}
// Copies every given file whose sha256 is a pinned census binary into the
// store. A directory is read as an R6 census run (raw/<tool>/metadata.json
// names each binary).
export function importCensus(paths: string[]): void {
  check(paths.length > 0, "usage: tool.sh import-census FILE|CENSUS_DIR...");
  const files: string[] = [];
  for (const path of paths) {
    if (!statSync(path).isDirectory()) {
      files.push(path);
      continue;
    }
    for (const name of Object.keys(PINS)) {
      const metadata = join(path, "raw", PINS[name][0], "metadata.json");
      if (existsSync(metadata)) {
        files.push(String(json(metadata).binary));
      }
    }
  }
  const wanted = new Set(Object.keys(PINS).map((name) => PINS[name][1]));
  mkdirSync(CENSUS, { recursive: true });
  for (const file of files) {
    const hash = sha(file);
    if (!wanted.has(hash)) {
      console.log("census: skip " + file + " (sha256 " + hash + " is not pinned)");
      continue;
    }
    const staging = join(CENSUS, hash + ".tmp-" + process.pid);
    copyFileSync(file, staging);
    chmodSync(staging, 0o555);
    renameSync(staging, join(CENSUS, hash));
    console.log("census: " + hash + " <- " + file);
  }
  const missing = censusMissing();
  console.log(
    "census: " + CENSUS + (missing.length ? " still lacks " + missing.join(" ") : " complete"),
  );
}

function uint(value: number, bytes: number): Buffer {
  const result = Buffer.alloc(bytes);
  if (bytes === 2) {
    result.writeUInt16LE(value, 0);
  } else {
    result.writeUInt32LE(value, 0);
  }
  return result;
}
function text(value: string): Buffer {
  const bytes = Buffer.from(value);
  return Buffer.concat([uint(bytes.length, 2), bytes]);
}
export function request(
  name: string,
  args: string[],
  files: Record<string, Buffer>,
): Buffer {
  const pieces = [Buffer.from("JNR7"), text(name), uint(args.length, 2)];
  for (const arg of args) {
    pieces.push(text(arg));
  }
  pieces.push(uint(Object.keys(files).length, 2));
  for (const path of Object.keys(files)) {
    const data = files[path];
    if (data === undefined) {
      throw new Error("missing file");
    }
    pieces.push(text(path), uint(data.length, 4), data);
  }
  const payload = Buffer.concat(pieces);
  return Buffer.concat([uint(payload.length, 4), payload]);
}

// Python tarfile's USTAR fixture: one immutable member, zero owner/time,
// padded to a 10 KiB record. Keep these bytes stable for the native tar oracle.
function fixtureTar(data: Buffer): Buffer {
  const header = Buffer.alloc(512);
  header.write("input.txt", 0);
  header.write("0000444\0", 100);
  header.write("0000000\0", 108);
  header.write("0000000\0", 116);
  header.write(data.length.toString(8).padStart(11, "0") + "\0", 124);
  header.write("00000000000\0", 136);
  header.fill(32, 148, 156);
  header.write("0", 156);
  header.write("ustar\x00", 257);
  header.write("00", 263);
  let checksum = 0;
  for (const byte of header) {
    checksum += byte;
  }
  header.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148);
  const result = Buffer.alloc(10240);
  header.copy(result);
  data.copy(result, 512);
  return result;
}
export async function prepare(): Promise<void> {
  mkdirSync(RAW, { recursive: true });
  mkdirSync(join(RUN, "images"), { recursive: true });
  if (MAC) {
    // The deps cache's signed engine prepares; the kernel build needs this
    // host's prepare/build-args tools (tool.sh builds them on Linux).
    check(existsSync(real()), "JITK_SHARD_BINARY missing");
    if (!process.env.JITK_TOOLS_DIR) {
      const kernel = join(ROOT, "arch/jitk/kernel");
      await run(["make", "-s", "-C", kernel, ".work/bin/prepare", ".work/bin/build-args"]);
      BUILD_ENV.JITK_TOOLS_DIR = join(kernel, ".work/bin");
    }
  } else {
    saveResult(
      await run(["cargo", "build", "--release", "--locked", "--offline"], {
        cwd: join(ROOT, "arch/jitk/shard"),
        env: BUILD_ENV,
      }),
      join(RAW, "shard-build.log"),
    );
  }
  const profiles: Record<string, Profile> = {};
  const prepared: Record<string, Json> = {};
  const classes = JSON.parse(process.env.JITK_NATIVE_CLASSES || "{}") as Record<
    string,
    string
  >;
  const names = (
    process.env.JITK_NATIVE_TOOLS || Object.keys(PINS).join(" ")
  ).split(/\s+/);
  for (const name of names) {
    const pin = PINS[name];
    const binary = censusBinary(name);
    check(
      existsSync(binary),
      "census binary missing: " + name + " (" + binary + "); ./tool.sh import-census",
    );
    check(sha(binary) === pin[1], "census checksum mismatch: " + name);
    const cls =
      classes[name] ||
      (["zstd", "micropython"].includes(name) ? "glue-4m" : "glue-2m");
    profiles[name] = {
      binary,
      sha256: pin[1],
      bytes: statSync(binary).size,
      memory_class: cls,
    };
    const base = join(RUN, "images", name + "-r7");
    check(
      !existsSync(base + ".mem") && !existsSync(base + ".regs"),
      "snapshot already exists: " + base,
    );
    const build = await run(["sh", "build-ring.sh"], {
      cwd: join(ROOT, "arch/jitk/kernel"),
      env: env({
        ...BUILD_ENV,
        JITK_ELF: binary,
        JITK_RING_NATIVE: "1",
        JITK_RING_CLASS: cls,
        JITK_RING_OUT: base + ".bin",
      }),
    });
    writeFileSync(
      join(RAW, "build-" + name + ".log"),
      Buffer.concat([build.stdout, build.stderr]),
    );
    saveResult(
      await run(measured([real(), "prepare", base + ".bin", base], 600)),
      join(RAW, "prepare-" + name + ".jsonl"),
      join(RAW, "prepare-" + name + ".stderr"),
    );
    const files: Record<string, Json> = {};
    for (const ext of ["bin", "mem", "regs", "layout"]) {
      files[ext] = {
        sha256: sha(base + "." + ext),
        bytes: statSync(base + "." + ext).size,
      };
    }
    prepared[name] = files;
    console.log(name + " prepared");
  }
  dump(join(RUN, "profiles.json"), profiles);
  dump(join(RAW, "prepared.json"), prepared);
}
function cases(): Case[] {
  const demo = readFileSync(DEMO_DB);
  check(digest(demo) === DEMO_DB_SHA256, "census-demo.db checksum mismatch");
  const fixture: Record<string, Buffer> = {
    "data/input.txt": Buffer.from("alpha 2\nbeta 5\nalpha 3\n"),
    "data/input.json": Buffer.from('{"items":[{"n":2},{"n":5}]}\n'),
    "dev/null": Buffer.alloc(0),
    "data/demo.db": demo,
  };
  fixture["data/fixture.tar"] = fixtureTar(fixture["data/input.txt"]);
  const chunks: Buffer[] = [];
  for (let i = 0; i < 5000; i++) {
    chunks.push(Buffer.from(digest(Buffer.from(String(i))), "hex"));
  }
  fixture["data/binary"] = Buffer.concat(chunks);
  const all: Case[] = [];
  function add(
    name: string,
    label: string,
    args: string[],
    files: Record<string, Buffer> | undefined,
  ): void {
    all.push({
      tool: name,
      label,
      args: [name, ...args],
      files: files || fixture,
    });
  }
  add(
    "jq-musl",
    "aggregate",
    ["-c", "[.items[].n] | add", "data/input.json"],
    undefined,
  );
  add("jq-musl", "binary", ["-j", '"a\\u0000b"', "data/input.json"], undefined);
  add("jq-musl", "bad-json", [".", "data/bad.json"], {
    "data/bad.json": Buffer.from("{bad\n"),
  });
  add("jq-musl", "partial-error", ["-c", ".", "data/partial.json"], {
    "data/partial.json": Buffer.from("1\n{bad\n"),
  });
  add("jq-musl", "missing", [".", "data/missing"], undefined);
  const sql = [
    "-batch",
    "-init",
    "dev/null",
    "file:data/demo.db?mode=ro&immutable=1",
  ];
  const queries = [
    ["aggregate", "SELECT sum(v) FROM n;"],
    ["ordered", "SELECT v FROM n ORDER BY v;"],
    ["integrity", "PRAGMA integrity_check;"],
    ["bad-query", "SELEC v FROM n;"],
    ["missing-table", "SELECT * FROM missing_table;"],
    ["readonly", "INSERT INTO n VALUES(42);"],
  ];
  for (const pair of queries) {
    add("sqlite3", pair[0], [...sql, pair[1]], undefined);
  }
  const apps: string[][] = [
    ["sed", "s/alpha/agent/g", "data/input.txt"],
    ["awk", "{s+=$2} END {print s}", "data/input.txt"],
    ["grep", "alpha", "data/input.txt"],
    ["sort", "data/input.txt"],
    ["wc", "-l", "data/input.txt"],
    ["tar", "-tf", "data/fixture.tar"],
  ];
  for (const args of apps) {
    add("busybox", args[0], args, undefined);
  }
  const errors: string[][] = [
    ["sed", "[", "data/input.txt"],
    ["awk", "{", "data/input.txt"],
    ["grep", "[", "data/input.txt"],
    ["sort", "data/missing"],
    ["wc", "data/missing"],
    ["tar", "-tf", "data/input.txt"],
  ];
  for (const args of errors) {
    add("busybox", args[0] + "-error", args, undefined);
  }
  add(
    "busybox",
    "grep-nomatch",
    ["grep", "absent", "data/input.txt"],
    undefined,
  );
  add("busybox", "gzip-text", ["gzip", "-c", "data/input.txt"], undefined);
  add("busybox", "gzip-binary", ["gzip", "-c", "data/binary"], undefined);
  add(
    "busybox",
    "gzip-invalid-option",
    ["gzip", "-d", "-c", "data/input.txt"],
    undefined,
  );
  add(
    "zstd",
    "compress-text",
    ["-q", "-c", "-T1", "data/input.txt"],
    undefined,
  );
  add("zstd", "compress-binary", ["-q", "-c", "-T1", "data/binary"], undefined);
  add("zstd", "corrupt", ["-q", "-d", "-c", "data/input.txt"], undefined);
  add(
    "lua",
    "sum",
    [
      "-e",
      'local s=0; for l in io.lines("data/input.txt") do s=s+tonumber(l:match("%d+")) end; print(s)',
    ],
    undefined,
  );
  add(
    "lua",
    "file-binary",
    ["-e", 'io.write(io.open("data/binary"):read("*a"))'],
    undefined,
  );
  add(
    "lua",
    "binary-status",
    [
      "-e",
      'io.write(string.char(0,255,128)); io.flush(); io.stderr:write("err\\n"); os.exit(42)',
    ],
    undefined,
  );
  add("lua", "error", ["-e", 'error("bad")'], undefined);
  add("lua", "exit255", ["-e", "os.exit(511)"], undefined);
  add("lua", "stdin-eof", ["-e", 'print(io.read("*a"))'], undefined);
  add(
    "lua",
    "late-bind-a",
    ["-e", 'io.write(io.open("data/value"):read("*a"))'],
    { "data/value": Buffer.from([102, 105, 114, 115, 116, 0, 255]) },
  );
  add(
    "lua",
    "late-bind-b",
    ["-e", 'io.write(io.open("data/value"):read("*a"))'],
    { "data/value": Buffer.from([115, 101, 99, 111, 110, 100, 128]) },
  );
  add(
    "micropython",
    "sum",
    ["-c", 'print(sum(int(x.split()[1]) for x in open("data/input.txt")))'],
    undefined,
  );
  add(
    "micropython",
    "binary-status",
    [
      "-c",
      'import sys; sys.stdout.buffer.write(bytes([0,255,128])); sys.stderr.write("err\\n"); sys.exit(7)',
    ],
    undefined,
  );
  add("micropython", "error", ["-c", 'raise ValueError("bad")'], undefined);
  check(all.length === 41, "corpus case count");
  return all;
}
class Worker {
  child: ChildProcess;
  bytes = Buffer.alloc(0);
  ended = false;
  errors: Buffer[] = [];
  constructor(args: string[]) {
    this.child = spawn(real(), ["native-worker", ...args], {
      detached: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    track(this.child, 7200);
    this.child.stdout!.on("data", (chunk: Buffer) => {
      this.bytes = Buffer.concat([this.bytes, chunk]);
    });
    this.child.stderr!.on("data", (chunk: Buffer) => {
      this.errors.push(chunk);
    });
    this.child.on("close", () => {
      this.ended = true;
    });
    this.child.on("error", () => {
      this.ended = true;
    });
    this.child.stdin!.on("error", () => {});
  }
  async take(n: number): Promise<Buffer> {
    const deadline = Date.now() + 60000;
    while (this.bytes.length < n) {
      check(
        !this.ended,
        "worker exited: " + Buffer.concat(this.errors).toString(),
      );
      check(Date.now() < deadline, "worker read timeout");
      await sleep(0.001);
    }
    const result = this.bytes.subarray(0, n);
    this.bytes = this.bytes.subarray(n);
    return result;
  }
  async close(): Promise<void> {
    this.child.stdin!.end();
    const deadline = Date.now() + 5000;
    while (!this.ended && Date.now() < deadline) {
      await sleep(0.01);
    }
    if (!this.ended) {
      kill(this.child);
      while (!this.ended) {
        await sleep(0.01);
      }
      throw new Error("worker close timeout");
    }
  }
}
function removeFiles(directory: string): void {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      removeFiles(path);
    } else {
      rmSync(path);
    }
  }
}
// What a case must produce: the program's own run on Linux, or on the Mac
// that run as a Linux corpus recorded it (bytes as sha256; hex when short).
interface Oracle {
  returncode: number;
  stdout: Buffer | null;
  stderr: Buffer | null;
  stdoutSha256: string;
  stderrSha256: string;
  stdoutHex: string | null;
  stderrHex: string | null;
}
function linuxOracle(r: { returncode: number; stdout: Buffer; stderr: Buffer }): Oracle {
  return {
    returncode: r.returncode,
    stdout: r.stdout,
    stderr: r.stderr,
    stdoutSha256: digest(r.stdout),
    stderrSha256: digest(r.stderr),
    stdoutHex: r.stdout.toString("hex"),
    stderrHex: r.stderr.toString("hex"),
  };
}
type ReferenceRow = Record<string, unknown>;
// The Linux corpus.json the Mac compares with: JITK_NATIVE_REFERENCE, all 41
// rows exact on Linux (KVM worker == the program on Linux).
function referenceRows(): ReferenceRow[] {
  const path = process.env.JITK_NATIVE_REFERENCE || "";
  check(
    path.length > 0 && existsSync(path),
    "set JITK_NATIVE_REFERENCE to a Linux native corpus.json (check-native-r7's corpus-1.json; `make -C arch/jitk/executor parity-ssh` fetches it)",
  );
  const rows = json(path) as ReferenceRow[];
  check(
    rows.length === 41 && rows.every((r) => r["pass_exact"] === true),
    "the Linux reference must have 41 exact rows",
  );
  return rows;
}
function referenceOracle(rows: ReferenceRow[], i: number, c: Case): Oracle {
  const r = rows[i];
  check(
    r !== undefined &&
      r["tool"] === c.tool &&
      r["case"] === c.label &&
      JSON.stringify(r["argv"]) === JSON.stringify(c.args),
    "the Linux reference is another corpus (row " + String(i) + ")",
  );
  const inputs = r["inputs"] as Record<string, { sha256: string }>;
  for (const path of Object.keys(c.files)) {
    const data = c.files[path];
    const input = inputs[path];
    check(
      data !== undefined &&
        input !== undefined &&
        input.sha256 === digest(data),
      "the Linux reference ran other inputs (row " + String(i) + ")",
    );
  }
  return {
    returncode: Number(r["linux_exit"]),
    stdout: null,
    stderr: null,
    stdoutSha256: String(r["linux_stdout_sha256"]),
    stderrSha256: String(r["linux_stderr_sha256"]),
    stdoutHex: (r["linux_stdout_hex"] as string | null) ?? null,
    stderrHex: (r["linux_stderr_hex"] as string | null) ?? null,
  };
}
export async function corpus(): Promise<void> {
  mkdirSync(RAW, { recursive: true });
  const uname = (await run(["uname", "-s", "-n", "-r", "-v", "-m"])).stdout
    .toString()
    .trim();
  const fields = uname.split(" ");
  dump(join(RAW, "environment.json"), {
    uname: [
      fields[0],
      fields[1],
      fields[2],
      fields.slice(3, -1).join(" "),
      fields[fields.length - 1],
    ],
    load: loadavg(),
    uptime: MAC ? null : read("/proc/uptime"),
    nested: !MAC,
    hypervisor: MAC ? "hvf" : "kvm",
  });
  // The oracle is the program itself on Linux. A Mac cannot run Linux
  // binaries: it takes the Linux oracle's bytes (sha256) and status from a
  // Linux run of this corpus (JITK_NATIVE_REFERENCE, corpus.json of
  // check-native-r7), each of whose rows must have matched there too.
  const reference = MAC ? referenceRows() : [];
  const profiles = json(join(RUN, "profiles.json")) as Record<string, Profile>;
  for (const name of Object.keys(profiles)) {
    check(
      sha(profiles[name].binary) === profiles[name].sha256,
      "profile checksum: " + name,
    );
  }
  const worker = new Worker(
    Object.keys(profiles).map((p) => p + "=" + join(RUN, "images", p + "-r7")),
  );
  const oracle = join(RUN, "oracle");
  mkdirSync(oracle, { recursive: true });
  const results: Record<string, unknown>[] = [];
  try {
    const all = cases();
    for (let i = 0; i < all.length; i++) {
      const c = all[i];
      removeFiles(oracle);
      const inputs: Record<string, Json> = {};
      for (const path of Object.keys(c.files)) {
        const data = c.files[path];
        if (data === undefined) {
          throw new Error("missing file");
        }
        const p = join(oracle, path);
        mkdirSync(dirname(p), { recursive: true });
        writeFileSync(p, data);
        chmodSync(p, 0o444);
        utimesSync(p, 0, 0);
        inputs[path] = { bytes: data.length, sha256: digest(data) };
      }
      const native = MAC
        ? referenceOracle(reference, i, c)
        : linuxOracle(
            await capture(
              [
                // bash exec -a preserves Python subprocess(executable=...) argv[0].
                "/bin/bash",
                "-c",
                'exec -a "$0" "$@"',
                c.args[0],
                profiles[c.tool].binary,
                ...c.args.slice(1),
              ],
              {
                cwd: oracle,
                timeout: 10,
                env: {
                  PATH: "/usr/bin:/bin",
                  HOME: "/nonexistent",
                  LC_ALL: "C",
                  LANG: "C",
                  TZ: "UTC",
                },
              },
            ),
          );
      const wire = request(c.tool, c.args, c.files);
      if (c.tool === "lua" && c.label === "sum") {
        writeFileSync(
          join(RUN, "ledger.request"),
          request(c.tool, c.args, {
            "data/input.txt": c.files["data/input.txt"],
          }).subarray(4),
        );
      }
      const ledger = {
        "jq-musl": "aggregate",
        sqlite3: "aggregate",
        busybox: "gzip-binary",
        zstd: "compress-binary",
        lua: "sum",
        micropython: "sum",
      } as Record<string, string>;
      if (ledger[c.tool] === c.label) {
        writeFileSync(
          join(RUN, "ledger-" + c.tool + ".request"),
          wire.subarray(4),
        );
      }
      const start = process.hrtime.bigint();
      worker.child.stdin!.write(wire);
      const header = await worker.take(4);
      const out = await worker.take(header.readUInt32LE(0));
      const status = out.readUInt32LE(0);
      const code = out.readUInt32LE(4);
      const olen = out.readUInt32LE(8);
      const elen = out.readUInt32LE(12);
      const stdout = out.subarray(20, 20 + olen);
      const stderr = out.subarray(20 + olen, 20 + olen + elen);
      const passed =
        status === 0 &&
        code === native.returncode &&
        digest(stdout) === native.stdoutSha256 &&
        digest(stderr) === native.stderrSha256;
      const row: Record<string, unknown> = {
        i,
        memory_class: profiles[c.tool].memory_class,
        tool: c.tool,
        case: c.label,
        argv: c.args,
        pass_exact: passed,
        worker_status: status,
        exit_code: code,
        limited: out.readUInt32LE(16),
        stdout_hex: stdout.toString("hex"),
        stderr_hex: stderr.toString("hex"),
        linux_stdout_hex: native.stdoutHex,
        linux_stderr_hex: native.stderrHex,
        linux_exit: native.returncode,
        linux_stdout_sha256: native.stdoutSha256,
        linux_stderr_sha256: native.stderrSha256,
        oracle: MAC ? "reference" : "linux",
        elapsed_ns: Number(process.hrtime.bigint() - start),
        load: loadavg(),
        error: status ? out.subarray(20).toString() : null,
        inputs,
      };
      const streams: Record<string, Buffer | null> = {
        stdout,
        stderr,
        linux_stdout: native.stdout,
        linux_stderr: native.stderr,
      };
      for (const key of Object.keys(streams)) {
        const value = streams[key];
        if (value === undefined) {
          throw new Error("missing stream");
        }
        if (value === null) {
          continue; // the reference oracle's bytes: only their hash is here
        }
        writeFileSync(
          join(RAW, String(i).padStart(2, "0") + "-" + key + ".bin"),
          value,
        );
        row[key + "_sha256"] = digest(value);
        row[key + "_bytes"] = value.length;
        if (value.length > 8192) {
          row[key + "_hex"] = null;
        }
      }
      results.push(row);
      dump(join(RAW, "corpus.json"), results);
      console.log(
        c.tool +
          " " +
          c.label +
          " " +
          (passed ? "PASS" : "FAIL") +
          " " +
          olen +
          " " +
          elen +
          " " +
          code,
      );
    }
  } finally {
    await worker.close();
    writeFileSync(join(RAW, "worker.stderr"), Buffer.concat(worker.errors));
  }
  check(
    results.every((r) => Boolean(r["pass_exact"])),
    "native corpus mismatch",
  );
}
// One frame to the worker and its response payload.
async function ask(worker: Worker, payload: Buffer): Promise<Buffer> {
  worker.child.stdin!.write(Buffer.concat([uint(payload.length, 4), payload]));
  const header = await worker.take(4);
  return await worker.take(header.readUInt32LE(0));
}
function answered(out: Buffer, expected: string, what: string): void {
  const olen = out.readUInt32LE(8);
  check(
    out.readUInt32LE(0) === 0 &&
      out.readUInt32LE(4) === 0 &&
      out.subarray(20, 20 + olen).toString() === expected,
    what + ": " + out.subarray(20).toString(),
  );
}
// The worker command as Node runs it (confined on Linux), on two profiles:
// each malformed frame fails alone (worker status 1) and the worker then
// serves requests that switch profiles, exactly.
export async function supervision(): Promise<void> {
  const images = join(RUN, "images");
  const worker = new Worker([
    "lua=" + join(images, "lua-r7"),
    "micropython=" + join(images, "micropython-r7"),
  ]);
  const lua = request("lua", ["lua", "-e", "print(6*7)"], {}).subarray(4);
  const python = request("micropython", ["micropython", "-c", "print(6*7)"], {}).subarray(4);
  const malformed = [
    Buffer.alloc(0),
    Buffer.from("JNR0"),
    lua.subarray(0, lua.length - 1),
    Buffer.concat([lua, Buffer.from([0])]),
    request("../lua", ["lua"], {}).subarray(4),
    request("absent", ["absent"], {}).subarray(4),
    request("lua", ["lua"], { "../escape": Buffer.from([1]) }).subarray(4),
  ];
  try {
    for (const bad of malformed) {
      const out = await ask(worker, bad);
      check(
        out.readUInt32LE(0) === 1,
        "malformed native request accepted: " + bad.subarray(0, 16).toString("hex"),
      );
    }
    answered(await ask(worker, lua), "42\n", "lua after malformed requests");
    answered(await ask(worker, python), "42\n", "profile switch to micropython");
    answered(await ask(worker, lua), "42\n", "profile switch back to lua");
  } finally {
    await worker.close();
  }
  console.log(
    "native supervision: " + malformed.length + " malformed requests refused alone; profile switches exact",
  );
}
export async function probe(kind: string): Promise<void> {
  const source = join(ROOT, "arch/jitk/shard/harness/native-" + kind + "-r7.c");
  const obj = join(RUN, "native-" + kind + ".o");
  const elf = join(RUN, "native-" + kind);
  const base = join(RUN, "images/native-" + kind);
  await run([
    "clang",
    "--target=aarch64-unknown-none",
    "-ffreestanding",
    "-nostdlib",
    "-fno-stack-protector",
    "-O1",
    "-c",
    source,
    "-o",
    obj,
  ]);
  const linker =
    kind === "fd"
      ? join(ROOT, "arch/jitk/grow/probe.ld")
      : source.replace(/\.c$/, ".ld");
  await run(["ld.lld", "-T", linker, obj, "-o", elf]);
  const build = await run(["sh", "build-ring.sh"], {
    cwd: join(ROOT, "arch/jitk/kernel"),
    env: env({
      ...BUILD_ENV,
      JITK_RING_NATIVE: "1",
      JITK_ELF: elf,
      JITK_RING_OUT: base + ".bin",
    }),
  });
  writeFileSync(
    join(RAW, "build-native-" + kind + ".log"),
    Buffer.concat([build.stdout, build.stderr]),
  );
  saveResult(
    await run(measured([real(), "prepare", base + ".bin", base])),
    join(RAW, "prepare-native-" + kind + ".jsonl"),
  );
  const data =
    kind === "fd"
      ? Buffer.from([0, 255, 128, 65, 90])
      : Buffer.from(Array.from({ length: 32 }, (_, i) => i));
  const oracle = join(RUN, "fd-oracle");
  mkdirSync(join(oracle, "data"), { recursive: true });
  writeFileSync(join(oracle, "data/input"), data);
  const linux = await capture([elf], { cwd: oracle, timeout: 10 });
  if (kind === "regions") {
    check(linux.returncode === 37, "regions oracle exit");
  }
  const worker = await capture(measured([real(), "native-worker", "fd=" + base]), {
    input: request("fd", ["fd"], { "data/input": data }),
    timeout: 60,
  });
  const out = worker.stdout;
  check(out.readUInt32LE(0) + 4 === out.length, "probe response length");
  const status = out.readUInt32LE(4);
  const code = out.readUInt32LE(8);
  const olen = out.readUInt32LE(12);
  const stdout = out.subarray(24, 24 + olen);
  const stderr = out.subarray(24 + olen);
  const result = {
    status,
    exit_code: code,
    stdout_hex: stdout.toString("hex"),
    stderr_hex: stderr.toString("hex"),
    linux_exit: linux.returncode,
    linux_stdout_hex: linux.stdout.toString("hex"),
    linux_stderr_hex: linux.stderr.toString("hex"),
    pass_exact:
      status === 0 &&
      code === linux.returncode &&
      stdout.equals(linux.stdout) &&
      stderr.equals(linux.stderr),
  };
  dump(join(RAW, "native-" + kind + ".json"), result);
  check(result.pass_exact, "native " + kind + " mismatch");
}
export async function gate(): Promise<void> {
  const missing = censusMissing();
  if (missing.length) {
    skipOrFail(
      "check-native-r7",
      "pinned census binaries absent from " +
        CENSUS +
        " (" +
        missing.join(" ") +
        "); import them once with `./tool.sh import-census FILE|CENSUS_DIR...` (sha256-checked)",
    );
    return;
  }
  const out = resolve(
    process.env.JITK_NATIVE_CHECK_OUTPUT ||
      join(ROOT, "arch/jitk/shard/test-results/native"),
  );
  mkdirSync(out, { recursive: true });
  const tmp = mkdtempSync(join(ROOT, ".native-check-"));
  const childEnv = env({ JITK_NATIVE_ROOT: ROOT, JITK_NATIVE_RUN_DIR: tmp });
  delete childEnv.JITK_NATIVE_CLASSES;
  delete childEnv.JITK_NATIVE_TOOLS;
  try {
    await run(tool("prepare-native-r7"), { env: childEnv, inherit: true });
    for (const rep of [1, 2]) {
      await run(locked(tool("native-corpus-r7")), {
        env: childEnv,
        inherit: true,
      });
      const rows = json(join(tmp, "raw/corpus.json")) as {
        pass_exact: boolean;
      }[];
      check(
        rows.length === 41 && rows.every((r) => r.pass_exact),
        "41 exact cases required",
      );
      copyFileSync(
        join(tmp, "raw/corpus.json"),
        join(out, "corpus-" + rep + ".json"),
      );
    }
    for (const kind of ["fd", "regions"]) {
      await run(tool("check-native-" + kind + "-r7"), {
        env: childEnv,
        inherit: true,
      });
    }
    await run(tool("check-native-supervision"), { env: childEnv, inherit: true });
    // The confinement probes on the native worker (`real confine --native`):
    // a confined worker still runs a request and is killed for file opens,
    // network, exec, ptrace, setuid, signals and ioctls.
    await run(
      [
        real(),
        "confine",
        "--native",
        join(tmp, "ledger-lua.request"),
        "lua=" + join(tmp, "images/lua-r7"),
      ],
      { inherit: true },
    );
    const bad = join(tmp, "images/mismatched");
    for (const ext of ["mem", "regs"]) {
      symlinkSync(join(tmp, "images/lua-r7." + ext), bad + "." + ext);
    }
    copyFileSync(join(tmp, "images/zstd-r7.layout"), bad + ".layout");
    const denied = await capture([real(), "native-worker", "bad=" + bad]);
    check(
      denied.returncode !== 0 &&
        denied.stderr.toString().includes("snapshot/layout mismatch"),
      "layout mismatch must be rejected",
    );
    dump(
      join(tmp, "raw/layout-defense.json"),
      {
        rejected: true,
        returncode: denied.returncode,
        stderr: denied.stderr.toString(),
      },
      false,
    );
    cpSync(join(tmp, "raw"), out, { recursive: true });
    copyFileSync(join(tmp, "profiles.json"), join(out, "profiles.json"));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  console.log(
    "native regression: 41/41 exact twice; fd and region probes, supervision and confinement PASS",
  );
}
// The Mac's native regression on the HVF engine's worker (`hvf native-worker`,
// src/hvf/native.rs): the six profiles prepared by HVF, the 41 cases twice
// against a Linux run's recorded oracle (JITK_NATIVE_REFERENCE), and the
// mismatched-layout rejection. The fd and region probes compare with the
// probe itself running on Linux and stay Linux-only. Without the census or
// the reference it fails unless JITK_ALLOW_SKIP names check-native-hvf.
export async function gateHvf(): Promise<void> {
  const missing = censusMissing();
  const path = process.env.JITK_NATIVE_REFERENCE || "";
  if (missing.length || !path || !existsSync(path)) {
    skipOrFail(
      "check-native-hvf",
      missing.length
        ? "pinned census binaries absent from " +
            CENSUS +
            " (" +
            missing.join(" ") +
            "); `./tool.sh import-census FILE|CENSUS_DIR...`"
        : "no Linux reference corpus (JITK_NATIVE_REFERENCE=" +
            path +
            "); `make -C arch/jitk/executor parity-ssh` fetches it from kvm-dev",
    );
    return;
  }
  const out = resolve(
    process.env.JITK_NATIVE_CHECK_OUTPUT ||
      join(ROOT, "arch/jitk/shard/test-results/native-hvf"),
  );
  mkdirSync(out, { recursive: true });
  const tmp = mkdtempSync(join(ROOT, ".native-check-"));
  const childEnv = env({
    JITK_NATIVE_ROOT: ROOT,
    JITK_NATIVE_RUN_DIR: tmp,
    JITK_NATIVE_REFERENCE: resolve(path),
  });
  delete childEnv.JITK_NATIVE_CLASSES;
  delete childEnv.JITK_NATIVE_TOOLS;
  try {
    await run(tool("prepare-native-r7"), { env: childEnv, inherit: true });
    for (const rep of [1, 2]) {
      await run(tool("native-corpus-r7"), { env: childEnv, inherit: true });
      const rows = json(join(tmp, "raw/corpus.json")) as {
        pass_exact: boolean;
      }[];
      check(
        rows.length === 41 && rows.every((r) => r.pass_exact),
        "41 exact cases required",
      );
      copyFileSync(
        join(tmp, "raw/corpus.json"),
        join(out, "corpus-" + rep + ".json"),
      );
    }
    await run(tool("check-native-supervision"), { env: childEnv, inherit: true });
    const bad = join(tmp, "images/mismatched");
    for (const ext of ["mem", "regs"]) {
      symlinkSync(join(tmp, "images/lua-r7." + ext), bad + "." + ext);
    }
    copyFileSync(join(tmp, "images/zstd-r7.layout"), bad + ".layout");
    const denied = await capture([real(), "native-worker", "bad=" + bad]);
    check(
      denied.returncode !== 0 &&
        denied.stderr.toString().includes("snapshot/layout mismatch"),
      "layout mismatch must be rejected: " + denied.stderr.toString(),
    );
    copyFileSync(join(tmp, "profiles.json"), join(out, "profiles.json"));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  console.log(
    "native regression on HVF: 41/41 exact twice against the Linux oracle; supervision PASS; layout mismatch rejected",
  );
}

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  ROOT,
  canonical,
  check,
  digest,
  dump,
  env,
  read,
  run,
  sha,
} from "../lib.ts";
import { watchRun } from "./watch.ts";
export function quote(text: string): string {
  return "'" + text.replace(/'/g, "'\\''") + "'";
}
export async function runSsh(workArgument: string, log: string): Promise<void> {
  const work = canonical(workArgument);
  let ssh = process.env.JITK_NESTED_SSH || "";
  if (ssh) {
    ssh = canonical(ssh);
  } else {
    const common = (
      await run([
        "git",
        "-C",
        ROOT,
        "rev-parse",
        "--path-format=absolute",
        "--git-common-dir",
      ])
    ).stdout
      .toString()
      .trim();
    ssh = join(dirname(common), "kvm-dev/ssh.sh");
  }
  check(
    existsSync(ssh),
    "existing nested VM required: set JITK_NESTED_SSH to its ssh wrapper; see linux/README.md",
  );
  const identity = digest(Buffer.from(ROOT)).slice(0, 12);
  // Default: jitk-suite in the remote user's home, made absolute by the remote
  // shell in the same round trip that creates the run directory.
  const remoteRoot = process.env.JITK_NESTED_SSH_DIR || "";
  check(
    remoteRoot === "" ||
      (remoteRoot.startsWith("/") && !remoteRoot.split("/").includes("..")),
    "JITK_NESTED_SSH_DIR must be an absolute remote scratch directory",
  );
  const leaf = identity + "-" + process.pid;
  const target = remoteRoot
    ? quote(remoteRoot + "/" + leaf)
    : '"$HOME"/jitk-suite/' + leaf;
  const remote = (
    await run([ssh, "mkdir -p " + target + " && cd " + target + " && pwd -P"], {
      timeout: 20,
    })
  ).stdout
    .toString()
    .trim();
  check(
    remote.startsWith("/") && remote.endsWith("/" + leaf),
    "remote run directory " + remote + " is not absolute",
  );
  const files: { source: string; name: string }[] = [
    { source: join(ROOT, "build/linux/linux-tools"), name: "linux-tools" },
  ];
  for (const name of [
    "jitk-vmm",
    "spawn-cg",
    "kernel.bin",
    "seccomp-probe",
    "kk.bin",
    "bad-sysreg.bin",
    "console_avail_oob.bin",
    "mmio-halfword.bin",
    "rtc_oob_read.bin",
    "unknown-hvc.bin",
    "unknown-smc.bin",
    "main.bpf",
    "vcpu.bpf",
    "console.bpf",
  ]) {
    files.push({ source: join(work, name), name });
  }
  const temp = mkdtempSync(join(tmpdir(), "jitk-suite-transfer-"));
  try {
    for (const file of files) {
      copyFileSync(file.source, join(temp, file.name));
    }
    const payload = await run(
      ["tar", "-cf", "-", ...files.map((f) => f.name)],
      { cwd: temp, env: env({ COPYFILE_DISABLE: "1" }), timeout: 30 },
    );
    await run([ssh, "cd " + quote(remote) + " && tar xf -"], {
      input: payload.stdout,
      timeout: 30,
    });
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  const variables: Record<string, string> = {
    JITK_BIN: remote,
    JITK_REPORT: remote + "/report.json",
    JITK_LABEL: "NESTED",
    JITK_HOST_UPTIME: (await run(["uptime"])).stdout.toString().trim(),
  };
  for (const key of [
    "JITK_TIMEOUT_S",
    "JITK_GATE_TIMEOUT_S",
    "JITK_GATE_DEADLINE_S",
    "JITK_STARTUP_TIMEOUT_S",
    "JITK_NESTED_TIMEOUT",
    "JITK_BOOT_N",
    "JITK_SWEEP_N",
    "JITK_MAX_CONCURRENCY",
    "JITK_DENSITY",
  ]) {
    const value = process.env[key];
    if (value !== undefined) {
      variables[key] = value;
    }
  }
  const lockTimeout = Number(process.env.JITK_LOCK_TIMEOUT_S || 600);
  check(lockTimeout > 0, "JITK_LOCK_TIMEOUT_S must be positive");
  const command = [
    "sudo",
    "flock",
    "-E",
    "75",
    "-w",
    String(lockTimeout),
    process.env.JITK_BENCH_LOCK || "/home/dev/bench.lock",
    "env",
    ...Object.keys(variables).map((key) => key + "=" + variables[key]),
    "sh",
    "-c",
    'ulimit -n 16384; exec "$@"',
    "sh",
    remote + "/linux-tools",
    "watch",
    "--log",
    remote + "/suite.log",
    "--",
    remote + "/linux-tools",
    "suite",
  ];
  const hashes: Record<string, string> = {};
  for (const file of files) {
    hashes[file.name] = sha(file.source);
  }
  dump(join(dirname(log), "nested-command.json"), {
    backend: "ssh",
    ssh_wrapper: ssh,
    remote_directory: remote,
    started_unix: Date.now() / 1000,
    source_sha256: hashes,
    command,
    lock_timeout_s: lockTimeout,
    vm_lifecycle_changes: false,
  });
  console.log(
    "jitk: full NESTED suite over " +
      ssh +
      "; scratch=" +
      remote +
      "; bench.lock wait <= " +
      lockTimeout +
      "s",
  );
  const code = await watchRun(
    [ssh, command.map((s) => quote(s)).join(" ")],
    log,
    {
      progressTimeout: Number(process.env.JITK_GATE_TIMEOUT_S || 60) + 15,
      startupAllowance: lockTimeout,
      suiteAllowance: lockTimeout,
    },
  );
  if (code === 75) {
    throw new Error(
      "jitk: bench.lock busy after " +
        lockTimeout +
        "s; no test gate ran (log=" +
        log +
        ")",
    );
  }
  if (code) {
    const messages = read(log)
      .split("\n")
      .filter((s) => s.startsWith("JITK_TIMEOUT "));
    if (messages.length) {
      console.error(messages[messages.length - 1].slice(0, 1000));
    }
    console.error("jitk: nested suite failed (exit " + code + "); log=" + log);
  } else {
    await run([ssh, "sudo rm -rf -- " + quote(remote)], { timeout: 20 });
  }
  process.exitCode = code;
}
export async function runQemu(work: string, log: string): Promise<void> {
  const command = [
    "qemu-system-aarch64",
    "-M",
    "virt,virtualization=on,gic-version=3",
    "-accel",
    "hvf",
    "-cpu",
    "host",
    "-smp",
    process.env.JITK_NESTED_VCPUS || "1",
    "-m",
    "6144",
    "-kernel",
    join(work, "vmlinuz"),
    "-initrd",
    join(work, "test.cpio.gz"),
    "-append",
    "console=ttyAMA0 rdinit=/init quiet",
    "-nographic",
    "-no-reboot",
  ];
  dump(
    join(dirname(log), "nested-command.json"),
    command.map((s) => s.replace(work, "$JITK_WORK")),
  );
  process.exitCode = await watchRun(command, log);
}

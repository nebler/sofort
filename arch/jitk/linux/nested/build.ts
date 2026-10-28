// The Mac side of the Linux build: kvm-dev (native arm64 Linux, rustup with the
// pinned toolchain) builds the canonical libkrun VMM, spawn-cg and the seccomp
// probes; Docker on the Mac is no longer involved. The VMM's build inputs
// (exactly the files ../../tslib/deps.ts fingerprints, plus the libkrun patch
// set and the sandbox .READY gate), the Mac-cross-built Linux builder
// (vmm/.work/linux/build), build-linux.sh and the probe sources are shipped
// over the ssh wrapper into a scratch directory. There build-linux.sh runs
// under bench.lock and leaves the VMM in kvm-dev's jitk cache, keyed by the
// same input fingerprint as a checkout on that host, so unchanged inputs only
// re-verify. The binaries come back into $JITK_WORK, where nested.sh expects
// them; the scratch directory is removed after a successful build.
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { ROOT, capture, canonical, check, dump, env, json, read, run, sha } from "../lib.ts";
import { VMM_INPUT_FILES } from "../../tslib/deps.ts";
import { quote, remoteScratch, sshWrapper } from "./run.ts";

const JITK = resolve(ROOT, "..");
// Produced in $JITK_WORK by build-linux.sh and consumed by nested.sh/run-ssh.
const OUTPUTS = ["jitk-vmm", "build.json", "spawn-cg", "seccomp-probe", "main.bpf", "vcpu.bpf", "console.bpf"];

function shippedFiles(): string[] {
  const vmm = VMM_INPUT_FILES.map((name) => "vmm/" + name);
  const series = read(join(JITK, "vmm/patches/series")).split("\n").filter(Boolean);
  return [
    "tools/deps.json",
    ...vmm,
    "vmm/patches/series",
    ...series.map((name) => "vmm/patches/" + name),
    "vmm/sandbox/.READY",
    "vmm/.work/linux/build",
    "linux/build-linux.sh",
    "linux/tool.sh",
    "linux/spawn-cg.c",
    "linux/seccomp-probe.c",
    "linux/build/linux/linux-tools",
  ];
}

export async function buildSsh(workArgument: string, outArgument: string): Promise<void> {
  mkdirSync(workArgument, { recursive: true });
  const work = canonical(workArgument);
  const out = canonical(outArgument);
  check(existsSync(join(JITK, "vmm/sandbox/.READY")), "canonical sandbox not READY");
  await run(["make", "-s", "-C", join(JITK, "vmm"), ".work/linux/build"], { inherit: true, timeout: 1800 });
  const files = shippedFiles();
  for (const file of files) {
    check(existsSync(join(JITK, file)), "linux build input missing: " + file);
  }
  const ssh = await sshWrapper();
  const remote = remoteScratch("-build");
  const pin = String(json(join(JITK, "tools/deps.json")).rust_toolchain);
  const payload = await run(["tar", "-cf", "-", ...files], { cwd: JITK, env: env({ COPYFILE_DISABLE: "1" }), timeout: 60 });
  await run([ssh, "mkdir -p " + quote(remote + "/jitk") + " " + quote(remote + "/work") + " && cd " + quote(remote + "/jitk") + " && tar xf -"], { input: payload.stdout, timeout: 60 });
  const lockTimeout = Number(process.env.JITK_LOCK_TIMEOUT_S || 600);
  check(lockTimeout > 0, "JITK_LOCK_TIMEOUT_S must be positive");
  // kvm-dev's non-login shell lacks rustup's bin directory; RUSTUP_TOOLCHAIN
  // pins the probes' rustc (vmm/build.ts sets its own from deps.json).
  const variables = ["RUSTUP_TOOLCHAIN=" + quote(pin), "JITK_WORK=" + quote(remote + "/work"), "JITK_VMM_BUILDER=" + quote(remote + "/jitk/vmm/.work/linux/build")];
  if (process.env.JITK_NESTED_CACHE) {
    variables.push("JITK_CACHE=" + quote(process.env.JITK_NESTED_CACHE));
  }
  const command = "PATH=\"$HOME/.cargo/bin:$PATH\" flock -E 75 -w " + String(lockTimeout) + " /home/dev/bench.lock env " + variables.join(" ") + " bash " + quote(remote + "/jitk/linux/build-linux.sh");
  const hashes: Record<string, string> = {};
  for (const file of files) {
    hashes[file] = sha(join(JITK, file));
  }
  dump(join(out, "build-command.json"), { backend: "ssh", ssh_wrapper: ssh, remote_directory: remote, started_unix: Date.now() / 1000, rust_toolchain: pin, source_sha256: hashes, command, lock_timeout_s: lockTimeout });
  console.log("jitk: Linux build on " + ssh + "; scratch=" + remote + "; bench.lock wait <= " + lockTimeout + "s");
  const built = await capture([ssh, command], { inherit: true, timeout: 7200 + lockTimeout });
  if (built.returncode === 75) {
    throw new Error("jitk: bench.lock busy after " + lockTimeout + "s; Linux build did not run (scratch " + remote + ")");
  }
  check(built.returncode === 0, "jitk: Linux build failed (exit " + built.returncode + "); scratch kept at " + remote);
  const back = await run([ssh, "cd " + quote(remote + "/work") + " && tar cf - " + OUTPUTS.join(" ")], { timeout: 120 });
  await run(["tar", "xf", "-", "-C", work], { input: back.stdout, timeout: 60 });
  const metadata = json(join(work, "build.json"));
  check(metadata.binary_sha256 === sha(join(work, "jitk-vmm")), "jitk: fetched jitk-vmm does not match its build.json");
  check(metadata.sandbox_ready === true && metadata.panic === "abort", "jitk: Linux VMM build flags");
  await run([ssh, "rm -rf -- " + quote(remote)], { timeout: 30 });
  console.log("jitk: Linux VMM " + metadata.binary_sha256 + " (inputs " + metadata.inputs_sha256 + ")");
}

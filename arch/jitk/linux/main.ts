import { analyzeR7 } from "./historical.ts";
import {
  parkingCheck,
  preflight,
  reproduce,
  cleanupChild,
} from "./nested/diagnostics.ts";
import { runSsh, runQemu } from "./nested/run.ts";
import { buildSsh } from "./nested/build.ts";
import { testWatch, watchFixture } from "./nested/test-watch.ts";
import { suiteMain } from "./suite.ts";
import {
  cpuAnalysis,
  summarizeLinux,
  collectReport,
  certify,
} from "./report.ts";
import { watchCli } from "./nested/watch.ts";
import {
  buildFaults,
  buildKernel,
  buildProbes,
  stageCanonical,
} from "./build.ts";
async function main(): Promise<void> {
  const name = process.argv[2];
  if (name === "build-faults") {
    await buildFaults();
  } else if (name === "build-kernel") {
    await buildKernel();
  } else if (name === "build-probes") {
    await buildProbes();
  } else if (name === "stage-canonical") {
    stageCanonical(String(process.argv[3]));
  } else if (name === "watch") {
    await watchCli(process.argv.slice(3));
  } else if (name === "cpu-analysis") {
    cpuAnalysis();
  } else if (name === "summarize") {
    summarizeLinux();
  } else if (name === "collect-report") {
    collectReport(String(process.argv[3]));
  } else if (name === "certify") {
    certify();
  } else if (name === "suite") {
    await suiteMain();
  } else if (name === "build-ssh") {
    await buildSsh(String(process.argv[3]), String(process.argv[4]));
  } else if (name === "run-ssh") {
    await runSsh(String(process.argv[3]), String(process.argv[4]));
  } else if (name === "run-qemu") {
    await runQemu(String(process.argv[3]), String(process.argv[4]));
  } else if (name === "test-watch") {
    await testWatch();
  } else if (name === "fixture-watch") {
    await watchFixture(String(process.argv[3]));
  } else if (name === "parking-check") {
    await parkingCheck();
  } else if (name === "preflight") {
    await preflight();
  } else if (name === "reproduce") {
    await reproduce();
  } else if (name === "watch-cleanup-child") {
    await cleanupChild();
  } else if (name === "analyze-r7") {
    analyzeR7();
  } else {
    throw new Error("unknown linux tool: " + name);
  }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

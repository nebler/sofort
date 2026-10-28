import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { waitDeadlineR6, traceMemory, pilotBrk } from "./diagnostics.ts";
import { summarize } from "./summarize.ts";
import {
  analyzeR6,
  analyzeNative,
  analyzeRng,
  analyzeIntegrate,
  analyzeShard,
} from "./evidence.ts";
import { checkRng } from "./rng.ts";
import { escalation, ledger, waitObserver } from "./observe.ts";
import { check } from "./lib.ts";
import { corpus, gate, importCensus, prepare, probe } from "./native.ts";
async function main(): Promise<void> {
  const name = process.argv[2];
  if (name === "prepare-native-r7") {
    await prepare();
  } else if (name === "native-corpus-r7") {
    await corpus();
  } else if (name === "import-census") {
    importCensus(process.argv.slice(3));
  } else if (name === "check-native-r7") {
    await gate();
  } else if (
    name === "check-native-fd-r7" ||
    name === "check-native-regions-r7"
  ) {
    await probe(name === "check-native-fd-r7" ? "fd" : "regions");
  } else if (name === "ledger-r6" || name === "ledger-native-r7") {
    await ledger(name === "ledger-native-r7");
  } else if (name === "wait-r7") {
    await waitObserver(process.argv.slice(3));
  } else if (name === "escalation-r7") {
    await escalation(process.argv.slice(3));
  } else if (name === "check-rng") {
    checkRng(String(process.argv[3]));
  } else if (name === "analyze-r6") {
    analyzeR6(String(process.argv[3]));
  } else if (name === "analyze-native-r7") {
    analyzeNative(String(process.argv[3]));
  } else if (name === "analyze-r7-rng") {
    analyzeRng(String(process.argv[3]));
  } else if (name === "analyze-r7-integrate") {
    analyzeIntegrate(String(process.argv[3]));
  } else if (name === "analyze-r7-shard") {
    analyzeShard(String(process.argv[3]));
  } else if (name === "summarize") {
    summarize(
      process.argv[3] || new URL("./results", import.meta.url).pathname,
    );
  } else if (name === "wait-deadline-r6") {
    await waitDeadlineR6();
  } else if (name === "trace-memory") {
    await traceMemory();
  } else if (name === "pilot-brk") {
    await pilotBrk();
  } else if (name === "mutate-libc") {
    const path = join(String(process.argv[3]), "libc-omitted/checkpoint.h");
    const source = readFileSync(path, "utf8");
    const needle = "__jitk_reseed_libc(keys+8);";
    check(source.split(needle).length === 2, "exactly one libc reseed");
    writeFileSync(
      path,
      source.replace(
        needle,
        "(void)0; /* negative mutation: omit libc repair */",
      ),
    );
  } else {
    throw new Error("unknown shard tool: " + name);
  }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

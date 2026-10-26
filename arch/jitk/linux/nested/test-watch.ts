import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check, json, num, sleep, type ObjectValue } from "../lib.ts";
import { DeadlineError, watchRun } from "./watch.ts";
export async function watchFixture(name: string): Promise<void> {
  if (name === "success" || name === "nonzero") {
    console.log('JITK_GATE {"gate":"smoke","event":"start"}');
    console.log('JITK_GATE {"gate":"smoke","event":"end"}');
    process.exitCode = name === "success" ? 0 : 7;
    return;
  }
  if (name === "silent") {
    await sleep(10);
    return;
  }
  if (name !== "transitions") {
    console.log(
      "JITK_GATE " +
        JSON.stringify({
          gate: name === "stall" ? "boot" : "density",
          event: "start",
        }),
    );
  }
  for (let i = 0; i < 100; i++) {
    if (name === "stall") {
      console.log("heartbeat");
      console.log('JITK_GATE {"gate":"boot","event":"progress","completed":1}');
    } else if (name === "absolute") {
      console.log(
        "JITK_GATE " +
          JSON.stringify({ gate: "density", event: "progress", completed: i }),
      );
    } else {
      console.log(
        "JITK_GATE " + JSON.stringify({ gate: String(i), event: "start" }),
      );
    }
    await sleep(0.1);
    if (name === "transitions") {
      console.log(
        "JITK_GATE " + JSON.stringify({ gate: String(i), event: "end" }),
      );
    }
  }
}
export async function testWatch(): Promise<void> {
  let assertions = 0;
  function verify(okay: boolean): void {
    assertions++;
    check(okay, "watch assertion " + assertions);
  }
  async function invoke(name: string): Promise<{
    code: number | null;
    error: string | null;
    receipt: ObjectValue;
  }> {
    const directory = mkdtempSync(join(tmpdir(), "jitk-watch-test-"));
    process.env.JITK_STARTUP_TIMEOUT_S = ".6";
    process.env.JITK_GATE_TIMEOUT_S = ".6";
    process.env.JITK_GATE_DEADLINE_S = name === "absolute" ? ".7" : "3";
    process.env.JITK_NESTED_TIMEOUT = name === "transitions" ? ".7" : "5";
    let code: number | null = null;
    let error: string | null = null;
    try {
      code = await watchRun(
        [process.execPath, "fixture-watch", name],
        join(directory, "test.log"),
        { sampleLoad: false },
      );
    } catch (exc) {
      if (!(exc instanceof DeadlineError)) {
        throw exc;
      }
      error = exc.message;
    }
    const receipt = json(join(directory, "run-timing.json")) as ObjectValue;
    rmSync(directory, { recursive: true, force: true });
    return { code, error, receipt };
  }
  const stall = await invoke("stall");
  verify(stall.code === null);
  verify(String(stall.error).includes("gate boot: no completed-work progress"));
  verify(num(stall.receipt, "wall_s") < 2);
  verify(num(stall.receipt, "returncode") < 0);
  const absolute = await invoke("absolute");
  verify(String(absolute.error).includes("gate density: exceeded absolute"));
  verify(num(absolute.receipt, "wall_s") < 2);
  const silent = await invoke("silent");
  verify(String(silent.error).includes("gate startup"));
  verify(num(silent.receipt, "wall_s") < 2);
  const transitions = await invoke("transitions");
  verify(String(transitions.error).includes("suite exceeded"));
  verify(num(transitions.receipt, "wall_s") < 2);
  for (const name of ["success", "nonzero"]) {
    const result = await invoke(name);
    const expected = name === "success" ? 0 : 7;
    verify(result.code === expected);
    verify(result.error === null);
    verify(num(result.receipt, "returncode") === expected);
  }
  console.log("watchdog: 5 tests, " + assertions + " assertions PASS");
}

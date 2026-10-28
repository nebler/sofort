# Round 10 — 01-hardware: generated device support needs physical witnesses

Research date: **2026-10-28**. Lens: silicon/HDL, FPGAs, firmware, drivers, embedded control, device protocols, and the browser/hardware boundary.

Labels: **F** = sourced fact; **M** = measurement performed for this report; **I** = inference or judgment; **E** = proposed experiment, demo, target, or effort estimate. Living documentation and repository pages were accessed on 2026-10-28; publication/event dates are given where available. Demonstrations below are proposals, not completed hardware experiments.

**I — Verdict:** the strongest side project is **Converter Witness**, a capture-to-regression-test contribution for Zigbee2MQTT's TypeScript device converters. A device already acquires support and a UI from an external definition; the missing candidate is portable evidence that the generated definition means what its author claims. Keep two weaker, contribution-sized finalists: cross-implementation USB-serial witness packs, and a firmware boot-waveform diff. None establishes a vacant general hardware-agent market. Run the two-day kill test for Converter Witness before building its three-week version.

## 1. What changed, and what did not

### Silicon and HDL: the rigor flip is real and already occupied

**F:** NVIDIA's CVDP paper, submitted **2025-06-17**, contains **783 problems across 13 categories**, including RTL generation, verification, debugging, and specification alignment. Its evaluated models achieved at most **34% pass@1 on code generation**. This is that paper's result, not an October 2026 frontier-model score. The repository says its public release omitted 20 problems and withheld reference solutions; benchmark size and public availability should not be conflated. [CVDP paper](https://arxiv.org/abs/2506.14074), [benchmark repository](https://github.com/NVlabs/cvdp_benchmark).

**F:** By **2026-02-04**, LAAFD reported **99.9% geometric-mean performance relative to a hand-tuned Vitis HLS baseline across 15 kernels**, using co-simulation and synthesis feedback. ProofLoop, submitted **2026-04-25**, reports **93.7% syntactic correctness and 82.0% functional correctness** for its assertion-generation evaluation. FormalRTL, submitted **2026-02-25**, explicitly combines executable reference models, RTL generation, and formal equivalence checking. These are direct prior art for the thesis, not evidence that arbitrary generated hardware is correct. [LAAFD](https://arxiv.org/abs/2602.06085), [ProofLoop](https://arxiv.org/abs/2604.23100), [FormalRTL](https://arxiv.org/abs/2603.08738).

**I:** Verbose state machines, invariants, interface contracts, and parameterized generators become easier to author. The scarce work moves toward choosing the authoritative specification, constraining the environment, detecting vacuous properties, and checking the implementation that actually reaches silicon. A proof against an agent-written mistaken model can faithfully certify the mistake. Another natural-language-to-Verilog loop does not fill this gap.

### Firmware: agents can now operate the bench; bench time remains scarce

**F:** BootLoop's **Summer 2025** launch describes a firmware agent that ingests hardware documentation and interacts with boards, debuggers, oscilloscopes, and logic analyzers. Saleae now documents an **experimental** Logic 2 MCP server for Logic 8, Logic Pro 8, and Logic Pro 16. Its product page explicitly describes agents maintaining tests against physical captures. Metalware advertises binary rehosting/fuzzing with replayable crash artifacts. These are vendor-described capabilities; this report did not evaluate their effectiveness. [BootLoop launch](https://www.ycombinator.com/companies/bootloop), [Saleae setup/status](https://docs.saleae.com/mcp/guides/getting-started), [Saleae's testing proposition](https://www.saleae.com/mcp), [Metalware](https://www.metalware.com/).

**I:** The plausible flip is maintaining hundreds of particular device interactions and their evidence, rather than inventing hardware-in-the-loop testing. Physical resets, thermal settling, wiring, component variation, calibration, and instrument access do not become free. **E:** 100 candidates requiring 30 seconds each still consume 50 minutes on one fixture, before setup. Parallel code generation does not parallelize that board.

### The browser is a more useful hardware host than older summaries imply

**F:** Mozilla announced **desktop Firefox 151 Web Serial support on 2026-05-21**, including Adafruit hardware collaboration. Firefox uses site-permission add-on gating as well as port selection. Consequently, “Web Serial requires Chromium” is stale. This does not establish Firefox support for WebUSB or BLE. The March 2026 Chromium Android shipping discussion also exposes platform restrictions and incomplete device-test automation; desktop support cannot be generalized to every phone. [Mozilla announcement](https://hacks.mozilla.org/2026/05/web-serial-support-in-firefox/), [Chromium Android discussion, 2026-03-25](https://groups.google.com/a/chromium.org/g/blink-dev/c/HBJ-uYFvkpM/m/MrLnwZlsAAAJ).

**F:** WebGPU exposes GPU adapters/devices and their capabilities. **I:** it is useful for local visualization, simulation, or inference, but provides no generic route to USB registers or an MCU's peripherals. Treat GPU kernel generation separately; the earlier rounds already rejected that crowded direction. [WebGPU specification](https://gpuweb.github.io/gpuweb/).

**I:** TypeScript should own schemas, driver/UI artifacts, trace comparison, and the browser session. USB access and real-time enforcement stay on the local machine/device. A Cloudflare Worker can distribute accepted packages; R2 can hold approved captures; a Durable Object can coordinate an optional collaborative session. **F:** DO hibernation applies to accepted server-side WebSockets and does not preserve in-memory state. **I:** none of these primitives supplies a physical-device oracle, and none belongs in a timing-critical motor-control loop. [Cloudflare WebSocket documentation, updated 2026-09-30](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).

## 2. Self-extension: identify the pattern and the acceptance boundary

**F:** The most directly matching `bb` found is [get-bb/bb](https://github.com/get-bb/bb), an agentic IDE whose documented purpose includes controlling and modifying itself. [Babashka](https://babashka.org/) also uses `bb`, but is a Clojure scripting runtime. **I:** this report assumes the brief means **get-bb/bb** because the self-extension description matches; the builder's intended referent remains unconfirmed.

**F:** A device describing its capabilities is established territory: [WoT Thing Description 1.1, 2023-12-05](https://www.w3.org/TR/wot-thing-description11/) supplies machine-readable interactions and schemas; [Jacdac's service model, 2023](https://www.microsoft.com/en-us/research/wp-content/uploads/2023/01/MSR-TR-2023-4-63b4a4bb98c7f.pdf) defines interchangeable peripheral interfaces. The old Microsoft TypeScript repository points to [jacdac/jacdac-ts](https://github.com/jacdac/jacdac-ts). Zigbee2MQTT already generates external definitions from discovered features and loads converters at runtime. [Discovery workflow](https://www.zigbee2mqtt.io/advanced/support-new-devices/01_support_new_devices.html), [external converters](https://www.zigbee2mqtt.io/advanced/more/external_converters.html).

**I:** The useful hardware counterpart of a malleable programming environment is:

1. Unknown behavior produces a specimen with device identity and observations.
2. An agent proposes a versioned protocol mapping or state transition.
3. A separate, fixed checker evaluates that artifact against preserved evidence and explicit host permissions.
4. The accepted artifact runs locally without a model and supplies the existing UI renderer with capabilities.
5. A new firmware revision or contradictory observation invalidates the relevant acceptance claim.

**I:** Discovery is not semantic verification. A register called `power` can contain milliwatts, deciwatts, or a proprietary packed value. A successful acknowledgment need not mean a physical actuator moved. An extension can be acceptable for parsing a captured sensor report while remaining unqualified for writes. This is where a rigorous artifact is useful; a generated dashboard alone adds little.

## 3. Catalogue ideas worth revisiting under this lens

| Earlier idea and report | Hardware reinterpretation | Flip-rule assessment |
|---|---|---|
| [Catalogue R2 / 01-archaeology: executable citations](/Users/noah/code/sofort/arch/research/catalogue/R2-moonshots.md#1-executable-citations-a-link-into-the-computation-behind-a-claim) | A converter field points to the exact device exchange and independent observation supporting it. | **I:** keep the evidence link; source, inputs, and a test runner suffice. Heap portability adds nothing. |
| [Catalogue R2 / 07-nextmodel: Reality Slot](/Users/noah/code/sofort/arch/research/catalogue/R2-moonshots.md) | Spend a cheap, local board/instrument run to distinguish protocol interpretations. | **I:** newly practical with instrument APIs, but rig ownership remains the constraint. Narrow to one device family; reject a lab marketplace. |
| [Catalogue R5 / 10-wild: failure specimen](/Users/noah/code/sofort/arch/research/catalogue/R5-teleport-06-10.md#7-failure-specimen-attach-the-actual-failing-computation-to-an-issue) | An issue contains descriptors, firmware identity, input events, wire operations, and expected outputs. | **I:** agents absorb the per-case packaging labor; a deterministic replay is independently checkable. Physical state remains outside the bundle. |
| [Catalogue R6 / 01-systems: peripheral rehosting](/Users/noah/code/sofort/arch/research/catalogue/R6-flip.md#firmware-rehosting-and-peripheral-models-grown-from-failures-10) | A captured device constrains a model's claimed fidelity. | **I:** retain the lesson, reject another emulator-growth product. Fuzzware/Metalware already cover substantial territory. |
| [Catalogue R7 / 05-numerics-data: evidence gate](/Users/noah/code/sofort/arch/research/catalogue/R7-flip2.md#evidence-gate-for-agent-run-ml-experiments-design-of-experiments-sequential-tests-and-the-reusable-holdout-owned-by-the-harness-idea-1) | Separate real regressions from fixture noise; freeze thresholds outside the repair agent. | **I:** essential to the boot-waveform finalist; many repeated captures without a fixed criterion invite cherry-picking. |
| [Catalogue R9 / 03-language: replay diff](/Users/noah/code/sofort/arch/research/catalogue/R9-deep.md#4-replay-diff-edit-a-running-typescript-program-and-see-what-the-edit-does-to-its-past) and [R9 / 06-tooling: Replaygate](/Users/noah/code/sofort/arch/research/catalogue/R9-deep.md#1-replaygate--production-traffic-as-the-regression-oracle-for-agent-changes-on-workers) | Show changed outgoing device commands under preserved incoming messages. | **I:** promising for converters, with a strict limit: if a changed command requires an unseen response, replay stops as unsupported. A tape cannot invent the device's counterfactual behavior. |

## 4. Eighteen ideas, each searched before selection

The verdicts below are **I**. Linked capabilities are **F**, with dates above or access date 2026-10-28. “Occupied” rejects the broad pitch; it does not imply the underlying technique lacks value.

| # | Proposed rigor/self-extension flip | Closest prior art and decisive finding | Verdict |
|---|---|---|---|
| 1 | Agent-written Verilog plus a formal executable specification | [FormalRTL](https://arxiv.org/abs/2603.08738) and [Veri-Sure, 2026-01-27](https://arxiv.org/abs/2601.19747) directly combine these mechanisms. | Reject: occupied. |
| 2 | Every generated RTL module gets assertions, assumptions, and counterexample repair | [ProofLoop](https://arxiv.org/abs/2604.23100) already generates/refines SVA with JasperGold feedback. The assumption model can still be wrong. | Reject: occupied; generic proposer/verifier is on the kill list. |
| 3 | An agent maintains parameterized Chisel peripherals and their simulation matrix | [Chisel](https://github.com/chipsalliance/chisel) already supplies reusable circuit generators and simulation infrastructure; agents can operate that workflow. | Reject: a contribution to an established stack without a distinct pain case. |
| 4 | Agent-written HLS pragmas recover hand-tuned FPGA performance | [LAAFD](https://arxiv.org/abs/2602.06085) directly demonstrates this on Vitis HLS. | Reject: earlier R6 result reconfirmed. |
| 5 | Datasheet-to-verified MCU driver | [Termite-2, OSDI 2014](https://www.usenix.org/system/files/conference/osdi14/osdi14-paper-ryzhyk.pdf) and [Pancake, 2025-01-14](https://arxiv.org/abs/2501.08249) establish synthesis/verification lineages. [BootLoop](https://www.ycombinator.com/companies/bootloop) targets today's agent workflow. | Reject wholesale: specification and device access remain expensive. |
| 6 | One typed register description generates firmware APIs, RTL, tests, and docs | [svd2rust](https://docs.rs/svd2rust/latest/svd2rust/), [PeakRDL](https://github.com/SystemRDL/PeakRDL), and [stm32-data](https://github.com/embassy-rs/stm32-data) already automate major parts. | Reject: typed register maps alone are established. |
| 7 | Executable datasheets generate per-register reset/read tests for silicon | [Keelhaul's 2025 paper](https://trepo.tuni.fi/bitstream/handle/10024/211861/2024-09-02-Keelhaul_TVLSI-final-submission-candidate-1.pdf?isAllowed=y&sequence=1) does specification-derived register testing; [a PR regeneration pipeline](https://github.com/Tabrez-dev/Spec-Driven-Register-Verification-Pipeline) already packages it in CI, while explicitly saying its tests are compiled rather than executed. | Reject the generator pitch. Actual execution/provenance is the interesting remainder, not a new tool family. |
| 8 | A firmware image grows its missing peripheral model until it runs | [Fuzzware, USENIX 2022](https://www.usenix.org/conference/usenixsecurity22/presentation/scharnowski), [Metalware](https://www.metalware.com/), and catalogue R6 cover automatic modeling/rehosting. | Reject: already revived; “boots” is a weak fidelity check. |
| 9 | A USB/BLE device grows a driver and UI from a capability schema | [WoT TD](https://www.w3.org/TR/wot-thing-description11/), [Jacdac](https://github.com/jacdac/jacdac-ts), and [Zigbee2MQTT discovery](https://www.zigbee2mqtt.io/advanced/support-new-devices/01_support_new_devices.html) cover the core pattern. | Reject generic discovery/genUI. Keep evidence for a particular generated mapping in A. |
| 10 | AI-generated Zigbee converters ship reusable device evidence and command diffs | [Existing converter tests](https://github.com/Koenkk/zigbee-herdsman-converters/tree/c18c32d94c77f683fa768618d1fd32b348fdd7b9/test) are substantial. [ZigSight](https://mmornati.github.io/zigsight/testing/) replays downstream MQTT captures. Neither inspected interface supplies the complete proposed capture-to-converter-evidence workflow. | **Keep A, conditional**, as an upstream-oriented tool. |
| 11 | Browser/native USB-serial adapters share physical witness packs and the same behavioral contract | [android-usb-serial](https://docs.rs/crate/android-usb-serial/latest) already has 567 golden fixtures. [umockdev](https://github.com/martinpitt/umockdev) already replays device interactions. WPT has [WebUSB hardware/manual tests](https://github.com/web-platform-tests/wpt/blob/master/webusb/README.md). | **Keep B, conditional**, only for missing cross-project real-device evidence; reject a new replay engine. |
| 12 | An agent writes Saleae/sigrok protocol analyzers and UI annotations | Saleae has an [analyzer SDK](https://www.saleae.com/support/extensions-api/protocol-analyzer-sdk/protocol-analyzer-sdk), [Python extensions](https://www.saleae.com/support/extensions-api/extensions-apis-and-sdks), and [MCP](https://docs.saleae.com/mcp/guides/getting-started). | Reject: instrument owner already supports the loop. |
| 13 | Firmware PRs get a physical boot/output waveform diff, independent of their own logs | [labgrid's SigrokDriver](https://labgrid.readthedocs.io/en/v26.0.1/modules/labgrid.driver.html) supplies capture/control; [Saleae](https://www.saleae.com/mcp) directly targets regression testing. | **Keep C, conditional**, only as a vendor-neutral evidence/report contribution. Gap is thin. |
| 14 | Generated MCU firmware becomes explicit checked state machines | [QP/C](https://www.state-machine.com/qpc/) already combines active objects, hierarchical state machines, and QM code generation. | Reject a new framework. Agents can write the application-specific rigor now. |
| 15 | A robot grows new motor skills behind a Simplex-style checker | [GR00T N1, 2025-03](https://research.nvidia.com/publication/2025-03_nvidia-isaac-gr00t-n1-open-foundation-model-humanoid-robots) and catalogue R7 / 06-sweep cover robot skill generation and runtime-assurance literature. | Reject broad robot self-improvement: simulator fidelity and physical acceptance remain hard; no concrete underserved check found. |
| 16 | Every generated OTA updater gets exhaustive power-cut/rollback tests | [MCUboot](https://github.com/mcu-tools/mcuboot) has simulator tests; its [release notes](https://github.com/mcu-tools/mcuboot/blob/main/docs/release-notes.md) discuss slow bad-powerdown-recovery tests explicitly. | Reject generic OTA fault testing: extend the incumbent's tests. |
| 17 | Agents generate TSX circuits, pin maps, and electrical checks | [tscircuit](https://tscircuit.com/) explicitly targets AI-generated electronics and presents physically demonstrated boards. | Reject a generic typed-electronics wrapper; placement checks alone do not establish electrical behavior. |
| 18 | Browser WebGPU code grows optimized hardware kernels | [WebGPU](https://gpuweb.github.io/gpuweb/) supplies the execution boundary; prior rounds found extensive kernel-agent competition. | Reject: repeats the kernel-agent kill, with no new beneficiary or acceptance oracle. |

## 5. Finalist A — Converter Witness

### One sentence and a 30-second demo

**I:** Turn a Zigbee2MQTT support issue into a versioned, replayable evidence pack that shows how a proposed converter changes normalized readings, exposed UI capabilities, and intended wire operations.

**E — Demo:** open a SONOFF power-monitoring device specimen, compare two converter versions, and click “refresh power.” The report highlights a changed read from `customClusterEwelink/acCurrentPowerValue` to `seMetering/instantaneousDemand`; the preserved device response rejects the latter. Open a generated fix and see the existing UI's power read work against the evidence again. No radio transmission occurs in the replay. A second panel labels an unobserved datapoint “unknown,” even if an agent confidently named it.

**F:** This command change is a real historical regression, not a hypothetical duplicate email translated into hardware. In [Zigbee2MQTT #29986, opened 2025-12-03](https://github.com/Koenkk/zigbee2mqtt/issues/29986), a user verified the old version worked, a collaborator identified the changed attribute, and the user confirmed a fix in 2.7.1. **E:** the demo would reconstruct this case; the issue does not itself supply a complete replay pack.

### Gap, closest competitors, and observed pain

**F:** Zigbee2MQTT already discovers features, generates definitions, and derives exposed controls. Its docs explain that nonstandard devices can defeat that discovery. The converter repository has helper machinery to check endpoint calls and expected payloads. **I:** “automatically generate a converter,” “generate its UI,” and “test converters” are all taken. The candidate gap is making real support evidence easy to capture, transfer, and reuse across converter updates.

**F:** [Issue #32609, 2026-07-20](https://github.com/Koenkk/zigbee2mqtt/issues/32609) contains a Gemini-written converter with current/energy scale adjustments and an explicit request to verify correctness. It later closed as stale. [Discussion #28245, 2025-08](https://github.com/Koenkk/zigbee2mqtt/discussions/28245) contains an AI-assisted converter whose author is unsure about a datapoint's battery meaning. This report takes no position on those mappings' correctness. **M:** GitHub's issue API returned **zero reactions and two comments** for #32609, and **zero reactions and five comments** for #29986. These are concrete instances of work, not evidence of broad demand or maintainer endorsement.

**F:** [ZigSight's capture replayer](https://mmornati.github.io/zigsight/testing/) operates on MQTT messages for its integration tests. **I:** downstream normalized MQTT cannot establish which upstream Zigbee attribute a candidate read or how it decoded raw data. An RF packet replayer, such as [EXPLIoT's Zigbee replay tool](https://expliot.readthedocs.io/en/latest/tests/zbauditor.html), operates at another boundary again. Reuse formats where useful; do not describe packet replay as missing.

### The check and how it can be gamed

**E:** A pack contains the converter/library hashes; model/manufacturer and firmware identifiers; endpoint/cluster metadata; raw and decoded incoming frames; options and cached converter state; ordered endpoint operations and responses; a controlled clock where needed; and expected normalized outputs. Export only selected device evidence, omit network/broker credentials, and preserve address correlations through explicit pseudonyms. Annotations distinguish a vendor-documented meaning, an independently observed meaning, and a guess. Missing firmware identity narrows the claim rather than silently matching every device with the same model string.

**E:** A fixed, model-free runner compares old/new `fromZigbee` output and captures `read`, `write`, `command`, `bind`, and `configureReporting` intentions. Every unexpected operation or unavailable response ends that replay branch as **unsupported**. Successful replay never authorizes sending a command to live hardware. The initial implementation exports ordinary, reviewable Vitest cases into the existing project; it does not automatically activate arbitrary submitted converters.

**I:** This checker establishes observed-case compatibility and visible effect changes. It does not prove a new datapoint's physical meaning. For that, a pack needs independent observations: for example, a separate meter with a stated tolerance across several loads, or a documented manufacturer mapping corroborated by captures. A self-consistent generated encoder/decoder round trip is insufficient. Vendor UI screenshots alone remain weaker evidence than a separate measurement.

**I:** The agent can game the system by changing expected outputs, hiding device-specific branches, omitting configure-time state, normalizing away a relevant field, or teaching a converter the visible examples. Keep the acceptance corpus outside the patch, preserve original captures, hold out events and firmware variants, and reject normalization rules that erase the disputed operation. A contributor can also fabricate a capture: hashes establish artifact identity, not truth about its origin. Maintainer review and additional device owners are still needed; no hardware attestation is claimed.

### Why it lasts, ownership, and scope

**I:** Better models write more converters and handle obscure formats more easily; they still cannot know an undocumented device revision's fresh behavior without observing it. Named beneficiaries are Zigbee2MQTT and ioBroker converter maintainers, plus device owners currently trading logs in issues. The code and UI run without inference after acceptance.

**I:** The project can survive as an adopted contribution, not a proprietary moat. Device observations are distributed among owners. Cloudflare/Vercel do not own those observations. Zigbee2MQTT maintainers could and should absorb the recorder and fixture format if useful. If they already have this workflow privately or find it burdensome, that kills a separate project.

**E — 2–3-week version:** week one builds a local Node/TypeScript recorder and pack schema for one metering device family, preserving input state and endpoint-call order. Week two adds dual-version replay, fixture export, and a browser evidence viewer. Week three validates two known regressions and one newly supported sensor with withheld observations. Use the existing `exposes` UI machinery. Optional Workers/R2 sharing comes after the local loop; no accounts or cloud deployment are necessary to prove value.

**I — Expert reply that kills it:** “Your pack is our existing `mockDevice` helper plus a JSON file. Recording full context takes longer than writing the regression test, and it still cannot validate units.”

**E — 1–2-day kill test:** take #29986 and two additional public converter regressions with sufficient input evidence; freeze expected behavior independently of the proposed patch. Compare handwritten tests using today's helper against pack creation/replay. Continue only if at least **two of three** cases reproduce without hardware, all deliberately changed endpoint targets/scales are flagged, and pack preparation takes **at most half** the baseline hands-on time. Report missing evidence as failure to qualify, not a generated fixture. For new device support, require one separately observed held-out value; without it, ship a regression recorder only and drop the claim of verified discovery.

## 6. Finalist B — USB-serial witness packs for browser adapters

### One sentence and a 30-second demo

**I:** Publish a small shared corpus and runner that distinguishes source-code parity, browser API conformance, and observed real-adapter behavior across WebUSB/Web Serial bridges.

**E — Demo:** the same FTDI receive transfer passes a naive single-packet test but corrupts a two-packet transfer because status bytes are removed once per transfer. Load its witness pack in a TypeScript driver harness and see the misplaced bytes. Switch to a corrected implementation. The result explicitly says “synthetic replay passed” until an independent real-device loopback capture is attached.

### Gap, competition, and pain

**F:** The [usb-serial-for-android test guide, edited 2025-01-30](https://github.com/mik3y/usb-serial-for-android/wiki/Device-Tests-&-Coverage-Report) explains why converter-chip mocks are inadequate and describes real-device tests using another serial endpoint over RFC-2217. [android-usb-serial 0.1.2, released 2026-10-14](https://docs.rs/crate/android-usb-serial/0.1.2) already documents **567 golden JSON fixtures**, including Java-derived control sequences and RX-filter fixtures. **I:** this is especially close prior art and a strong reason to contribute instead of duplicating it.

**F:** [SchoepsLabs/webserial-android](https://github.com/SchoepsLabs/webserial-android) distinguishes CDC-ACM hardware validation from other drivers that had not been tried on physical adapters, and describes FTDI packet-header and baud-divisor pitfalls. **I:** this is a specific beneficiary and evidence of validation work, not proof of a large market.

**F:** [umockdev](https://github.com/martinpitt/umockdev) already supports serial/device recording and USB replay, including control transfers through its pcap route. [WPT's WebUSB tests](https://github.com/web-platform-tests/wpt/blob/master/webusb/README.md) have simulated and manual hardware routes. Google's [Web Serial polyfill](https://github.com/google/web-serial-polyfill), archived **2025-01-23**, already implemented serial over WebUSB within its device/driver constraints. **I:** another mock framework, polyfill, or byte recorder is killed. The only remaining candidate is portable evidence bridging existing fixture suites and particular browser-facing implementations, with honest capability differences.

### Check, gaming, and survival

**E:** Preserve device descriptors, endpoint maximum packet size, transfer/control operations and statuses, payloads, driver/build versions, and observed API lifecycle events. Test packet filtering against an independently captured loopback stream; test baud and DTR/RTS behavior with an independent endpoint or instrument. A bridge that cannot implement reset or a modem signal declares that capability unsupported. Compare semantics only where both implementations claim support.

**I:** A serial byte stream erases information needed to check a USB driver's packet handling. Conversely, matching Java-generated fixtures establishes parity with that Java behavior, not physical truth for every clone chip. The runner must keep these evidence levels distinct. The agent could game it by rewriting fixtures, collapsing transfers, suppressing errors, or claiming unsupported hardware operations succeeded. A fixed corpus, preserved boundaries, and out-of-process device witnesses constrain those cheats; they do not eliminate all implementation mistakes.

**I:** Better models make transport ports cheap, increasing the number of implementations needing qualification. Fresh adapter/OS behavior remains external information. However, an implementation owner can add these tests easily. Chromium/Mozilla own browser API conformance; the Rust/Android projects own driver parity. The outsider's sensible role is contributing adapters and shared captures to those projects, not creating another standards organization.

**E — 2–3-week version:** adapt the existing golden format for one FTDI receive path and one CDC-ACM lifecycle path; build a TypeScript replay adapter; import existing conformance cases with attribution; attach genuine loopback observations for two devices. Add a static browser viewer; optional R2 hosting distributes approved packs. Native and browser runners handle their respective permission models. Do not promise universal iOS/Android connectivity or make a web page emulate a kernel USB device.

**I — Expert reply that kills it:** “The 567 fixtures and WPT already cover this; the missing piece is buying and plugging in adapters, not a format.”

**E — 1–2-day kill test:** map ten concrete packet/lifecycle failure cases onto existing Rust, Android, and WPT tests. Continue only if **at least three** important cases lack reusable cross-project evidence and two independent implementations can consume one unchanged pack. If an adapter to the existing golden fixtures covers all ten, submit that small contribution and end the standalone idea. Real-device qualification remains pending until the hardware run occurs.

## 7. Finalist C — BootDiff, a physical output diff for firmware changes

### One sentence and a 30-second demo

**I:** Attach independently captured boot/output behavior to firmware changes, so reviewers can see newly introduced pulses or altered reset behavior even when application logs report the same final state.

**E — Demo:** flash old/new builds onto the same low-voltage development board, apply the same reset stimulus, and overlay a GPIO/LED output. Both end “off”; the candidate has an extra startup pulse. Click the pulse to see the raw capture, reset trigger, build hash, pin mapping, and unchanged acceptance threshold. The demonstration uses an LED or disconnected test output.

### Gap, competition, and pain

**F:** [ESPHome issue #3094](https://github.com/esphome/issues/issues/3094), opened **2022-02-25**, contains reports through **2025-10-29** of GPIO/relay activation at boot and differing experiences across firmware/pin choices. **M:** its issue API returned **28 comments, zero reactions**, and open status during this research. **F:** [ESPHome's GPIO switch documentation](https://esphome.io/components/switch/gpio/) explicitly explains that software interlocks cannot prevent all reset-time pin behavior. **I:** some cases therefore require hardware changes; a waveform tool diagnoses a difference rather than promising a software repair.

**F:** labgrid already has [sigrok capture and power-control drivers](https://labgrid.readthedocs.io/en/v26.0.1/modules/labgrid.driver.html); [sigrok](https://sigrok.org/wiki/Supported_hardware) supports numerous acquisition devices. Saleae already advertises agent-maintained physical regression tests. **I:** general capture/flash/verify automation is decisively taken. The narrow candidate is a vendor-neutral, reviewable change artifact that preserves baseline variation, reset conditions, and acceptance criteria. No primary source found establishes unmet demand for this exact packaging, so its gap score is low.

### The check and gaming

**E:** An independent recorder captures reset and output channels, starting before reset release. Keep firmware image hash, board/revision, instrument/sample settings, probe mapping, supply condition, and cold-power-cycle versus software-reset identity. Repeat old/new captures in an interleaved order. Freeze an acceptance envelope such as “no active pulse longer than a reviewed duration in this startup window.” Use a deterministic evaluator; an agent can explain a failure but cannot revise the envelope while proposing the patch.

**I:** Baseline/candidate differences and violations of a reviewed hardware requirement are different results. A baseline may already be wrong. A waveform within finite observed runs is also weaker than a universal timing/safety proof. Digital samples do not establish analog voltage margins, current, or mechanical action. Mark unstable or inadequately sampled captures inconclusive.

**I:** A repair agent can game this by delaying the capture, renaming a channel, changing a glitch filter, selecting successful runs, changing the baseline binary, or logging a success instead of producing it. The recorder owns acquisition settings and build identities; report all attempted runs and minimum detectable pulse width. Independent triggering and raw-capture retention matter more than generated assertions.

### Longevity, ownership, and a small version

**I:** Beneficiaries are ESPHome/device-package maintainers and maintainers of small embedded products whose output sequencing changes with SDK updates. Better models cannot infer every board's physical reset behavior, but can generate the per-board harness. The accepted firmware runs without a model. Evidence is distributed among board owners, which offers room for an open format.

**I:** Saleae could cover its own instruments and already targets this workflow. labgrid could adopt a report/export plugin. That is an acceptable OSS outcome, but it weakens the case for a separate project. Cloudflare can host evidence review; a local TS viewer can make the artifact accessible. Neither is necessary for data acquisition.

**E — 2–3-week version:** use labgrid/sigrok for one board and two output channels; export CSV plus a small manifest; add reset-aligned comparisons, repeated-run summaries, a CLI exit status, and a TypeScript viewer. Week three checks a known change and a benign refactor across warm resets and cold boots. Use already available equipment; do not build a board farm or a generalized digital twin.

**I — Expert reply that kills it:** “A few pytest assertions against our existing Saleae/labgrid captures do this. Your alignment hides the very pulse we care about, and our dominant failures are analog.”

**E — 1–2-day kill test:** obtain ten existing captures from an already owned board: repeated baseline runs, a known changed sequence, and a benign control. Predeclare sampling/threshold rules. Continue only if it separates the known change from baseline variation with **no false alarms on the controls**, preserves every output transition, and materially shortens review compared with an ordinary trace overlay. If existing tooling already gives the same artifact or the target failure cannot be observed digitally, kill it. This hardware kill test was not run for this report.

## 8. What was actually checked locally

### Pinned converter-source audit

**M:** GitHub returned converter commit **`c18c32d94c77f683fa768618d1fd32b348fdd7b9`**, timestamp **2026-10-27T17:53:15Z**. Its complete recursive tree contained **59 files under `test/`, including 34 `*.test.ts` files**. No path matched the case-insensitive filename terms `capture`, `recorder`, `replay`, or `cassette`. This is a filename census, not proof that equivalent behavior is absent. Reproduce through the [pinned tree API](https://api.github.com/repos/Koenkk/zigbee-herdsman-converters/git/trees/c18c32d94c77f683fa768618d1fd32b348fdd7b9?recursive=1).

**M:** I downloaded and inspected six pinned test/helper files: `fromZigbee.test.ts`, `toZigbee.test.ts`, `tuya.test.ts`, `generateDefinition.test.ts`, `utils.ts`, and `zh-setup.ts`. The [helper](https://github.com/Koenkk/zigbee-herdsman-converters/blob/c18c32d94c77f683fa768618d1fd32b348fdd7b9/test/utils.ts) already mocks endpoint operations and asserts their arguments/counts. The [incoming tests](https://github.com/Koenkk/zigbee-herdsman-converters/blob/c18c32d94c77f683fa768618d1fd32b348fdd7b9/test/fromZigbee.test.ts) already include unit-conversion and cached-state cases. **I:** this materially narrows finalist A to capture/provenance/fixture ergonomics. It is not a claim that the project lacks serious testing. No converter suite was executed.

### Synthetic USB boundary experiment

**M:** A dependency-free Python experiment constructed two 64-byte packets, each with two status bytes and 62 data bytes. Stripping two bytes once per transfer passes the one-packet case (**62/62 payload bytes**) but returns **126 rather than 124 bytes** when the transfer contains both packets. This is a synthetic counterexample, not an FTDI hardware test or an evaluation of an existing library. It illustrates why preserving packet/transfer context matters; the known issue is already covered by relevant prior art.

```python
packets = [bytes([1, 96]) + bytes(range(62)),
           bytes([1, 96]) + bytes(range(62, 124))]
for ps in [packets[:1], packets]:
    reference = b"".join(p[2:] for p in ps)
    strip_once = b"".join(ps)[2:]
    print(len(reference), len(strip_once), reference == strip_once)
# 62 62 True
# 124 126 False
```

**F:** An additional useful warning about the oracle itself comes from [Embassy #6835, 2026-08-26](https://github.com/embassy-rs/embassy/issues/6835): its AI-assisted investigation describes abandoning a plausible claim after checking the primary datasheet rather than trusting generated register documentation. **I:** making code generation cheap increases the value of preserving where the expectation came from.

**I — Search limits:** searches covered GitHub code/docs/issues, npm, crates/docs.rs, arXiv, vendor changelogs/docs, and HN. The [npm converter package](https://www.npmjs.com/package/zigbee-herdsman-converters) confirms the existing typed ecosystem; the [USB crate](https://docs.rs/crate/android-usb-serial/latest) exposed a particularly close competitor. [HN's Firefox Web Serial thread](https://news.ycombinator.com/item?id=48227515) showed modest interest, **F: 26 points and seven comments on the retrieved page**; that does not establish demand for any finalist. Search absence is not a novelty proof. No physical devices were accessed, no model API was called, and no account, container, VM, deployment, or paid service was used. Scratch downloads were removed after writing the report.

## 9. Ranked top three, ONE pick, and rejection ledger

**I:** Scores are judgments, 1–5, with higher better. “Gap” measures the narrowed contribution described above. The final column tests independence from the excluded kernel project; all three are independent. Equal totals are ordered by practical fit and cost of the kill test.

| Rank | Finalist | Cool | TS / Cloudflare / Vercel adjacency | Real gap | Value | Survives better models | Not GrowOS | Total |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Converter Witness | 4 | 5 | 3 | 4 | 5 | 5 | **26/30** |
| 2 | USB-serial witness packs | 4 | 5 | 2 | 3 | 4 | 5 | **23/30** |
| 3 | BootDiff | 4 | 3 | 2 | 4 | 5 | 5 | **23/30** |

**I — ONE pick: Converter Witness.** It has a concrete failure case, documented AI-authored device extensions, a native TypeScript integration point, and a short test of whether evidence packaging saves work. Its best outcome is adoption by the existing converter ecosystem. If capture preparation does not beat today's handwritten tests, stop; do not expand into a generic firmware agent.

### Five-line TL;DR

1. **F:** Formal RTL, HLS agents, generated register APIs, and hardware-operating agents already exist; those broad pitches are taken.
2. **I:** Cheap code makes per-device specifications and evidence affordable to maintain; physical observations and authoritative expectations remain scarce.
3. **F/I:** Zigbee users already submit AI-written converters with uncertain meanings; reusable device evidence is the strongest narrowed opportunity found.
4. **I:** USB witness packs and boot-waveform diffs are plausible OSS contributions with substantial incumbent overlap, not demonstrated empty markets.
5. **E:** Spend two days testing Converter Witness against existing converter helpers before committing to a three-week build.

### Rejected ideas — one line each, with the killer

- **I:** Generic verified RTL generator — [FormalRTL](https://arxiv.org/abs/2603.08738) and [Veri-Sure](https://arxiv.org/abs/2601.19747).
- **I:** Agent writes all SVA — [ProofLoop](https://arxiv.org/abs/2604.23100); proof assumptions still require authority.
- **I:** New Chisel rigor framework — [Chisel's existing generators and verification integrations](https://github.com/chipsalliance/chisel).
- **I:** Agent tunes FPGA HLS — [LAAFD](https://arxiv.org/abs/2602.06085), reconfirming catalogue R6.
- **I:** Arbitrary datasheet-to-driver synthesis — [Termite-2](https://www.usenix.org/system/files/conference/osdi14/osdi14-paper-ryzhyk.pdf), [Pancake](https://arxiv.org/abs/2501.08249), and [BootLoop](https://www.ycombinator.com/companies/bootloop); device/specification access remains.
- **I:** Typed register maps as the product — [svd2rust](https://docs.rs/svd2rust/latest/svd2rust/), [PeakRDL](https://github.com/SystemRDL/PeakRDL), [stm32-data](https://github.com/embassy-rs/stm32-data).
- **I:** Register-reset test generation — [Keelhaul and existing CI packaging](https://github.com/Tabrez-dev/Spec-Driven-Register-Verification-Pipeline).
- **I:** Generic growing peripheral emulator — [Fuzzware](https://www.usenix.org/conference/usenixsecurity22/presentation/scharnowski), [Metalware](https://www.metalware.com/), and catalogue R6.
- **I:** A device invents its dashboard from descriptors — [WoT](https://www.w3.org/TR/wot-thing-description11/), [Jacdac](https://github.com/jacdac/jacdac-ts), [Zigbee2MQTT discovery](https://www.zigbee2mqtt.io/advanced/support-new-devices/01_support_new_devices.html).
- **I:** Generic USB record/replay, HID replay, or another browser bridge — [umockdev](https://github.com/martinpitt/umockdev), [hid-tools](https://github.com/bentiss/hid-tools), [Google's polyfill](https://github.com/google/web-serial-polyfill).
- **I:** Agent-written protocol analyzer/MCP wrapper — [Saleae's instrument API, extensions, and MCP](https://docs.saleae.com/).
- **I:** Generic firmware bench agent — [BootLoop](https://www.ycombinator.com/companies/bootloop) and [Saleae's regression workflow](https://www.saleae.com/mcp).
- **I:** New actor/state-machine MCU framework — [QP/C and QM](https://www.state-machine.com/qpc/).
- **I:** Robot grows arbitrary skills with simulator approval — [GR00T](https://research.nvidia.com/publication/2025-03_nvidia-isaac-gr00t-n1-open-foundation-model-humanoid-robots) and catalogue R7; no reliable new physical oracle identified.
- **I:** Generic OTA power-cut campaign — [MCUboot's existing recovery tests](https://github.com/mcu-tools/mcuboot/blob/main/docs/release-notes.md).
- **I:** Typed AI circuit generation — [tscircuit](https://tscircuit.com/).
- **I:** WebGPU kernel agent — the GPU-kernel kill list still applies; no distinct acceptance/data advantage found.

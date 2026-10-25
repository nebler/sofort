R7 diagnosis checkpoint (2026-10-25, M4 Pro/macOS 26.6.1/QEMU 11.1.2).

The original suite passes parking/smoke/tool_smoke then stalls during boot
iteration 56. The guest heartbeat and Python faulthandler stop too. Two Mac
samples separated by 14 seconds put every sampled CPU 0/HVF stack in
Hv::Vcpu::handle_exception_exit -> VcpuStateManager::set_pstate ->
Base::assertion_trap. The HMP info-registers command cannot synchronize that
vCPU. This is a hypervisor assertion spin, not 1,800 seconds of slow test work.

A 200-iteration sequential VM ready/run/close loop (no ThreadPoolExecutor,
parking, density or concurrent VMMs) stalls on iteration 59 in the private
Debian 6.12 QEMU. Changing only its outer kernel to Ubuntu 7.0 also stalls on
iteration 59 with the same sampled assertion. Two outer vCPUs keep the OS
heartbeat alive but still stall iteration 59 in the same HVF stack.

The identical VMM/kernel/helper and 200-iteration loop complete inside the
existing Ubuntu kvm-dev. Its VM was never stopped, restarted or reconfigured.
This isolates the failing execution path to the additional QEMU/HVF instance.
It does NOT prove that kvm-dev contention causes the Apple assertion: that
requires a comparison with kvm-dev stopped, which is explicitly forbidden.
Nor do these samples identify Apple's internal invalid-state predicate.

Raw: baseline.log, baseline-qemu-sample{,-2}.txt, minimal-debian.log,
minimal-debian-sample.txt, minimal-ubuntu.log, minimal-ubuntu-sample.txt,
minimal-smp2.log, minimal-smp2-sample.txt, minimal-ssh.log. Artifact hashes:
diagnostic-inputs.json. Minimal standalone reproducer: reproduce.py, importing
suite.py with JITK_BIN pointing at the hashed artifacts. Historical transcript:
r6-stall.log. Host-load.json/nested-command.json record the last diagnostic run;
each final certified run will have its own complete timing/load receipts.

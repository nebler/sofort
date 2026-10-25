06 R2 COMPLETE: ../R2.md (<=300 lines), raw data and reproduction retained here.

Final data: r2-integrated.json, 800 samples (n=100 x 8 interleaved paths),
02 READY image SHA 00040cfa...edf, final 01 VMM SHA f514554f...c3d.
Exact cold one-tool p50/p90/p99 36.906/92.397/122.950 ms;
C GO->result 13.460/53.794/90.538 ms;
A parked->result 2.704/31.868/47.618 ms.
Load 48.28/50.41/48.30 -> 45.91/49.51/48.08: NOT idle-host numbers.
Trace counterpart A wake+RX 0.168/4.650/10.332 ms, ±2.541us clock mapping.
Isolated timer B parked one-tool 6.244/34.532/58.306 ms.
Both A/B pass 1000 exchanges; idle A 0% (<0.10% bound), B 1.40% (<1.50%).

Process controls n=100 per launcher/case, including actual Node async spawn.
First unique re-sign -> main medians 282–331ms; immediate second 1.9–5.0ms.
Minimum observed: trivial C 1.602ms, static-minimal VMM 3.438ms;
final-source VMM twin 4.507ms (Python), 4.754ms (Node).
Static median benefit is mixed across highly loaded windows; not proven robust.
Sandbox application itself is 10.323ms median in the traced tool-cold window.
No unchanged 9.4ms dyld constant and no 0.6ms warm claim.

Still UNVERIFIED: idle host, isolated dyld/AMFI partition, full TS G3, same-harness
Hyperlight G5, KVM, instrumentation-only overhead. No architecture disagreement.
All benchmark children/VMs reaped. No other agent's files/processes modified.

#!/usr/bin/env python3
"""Run on candidate Linux host before installing a VMM; no provisioning."""
import fcntl, json, os, platform, time
try:
 fd=os.open('/dev/kvm', os.O_RDWR|os.O_CLOEXEC)
 t=time.perf_counter_ns()
 api=fcntl.ioctl(fd,0xAE00,0)
 vm=fcntl.ioctl(fd,0xAE01,0)
 print(json.dumps(dict(machine=platform.machine(),api=api,create_vm_us=(time.perf_counter_ns()-t)/1000,vm_fd=vm)))
 os.close(vm); os.close(fd)
except OSError as e:
 print(json.dumps(dict(machine=platform.machine(),error=str(e),errno=e.errno)))
 raise SystemExit(1)

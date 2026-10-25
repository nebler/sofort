from pathlib import Path
p=Path('/tmp/jitk-01/r2/libkrun/src/libkrun/src/vmm/builder.rs')
s=p.read_text()
a=s.index('            let gic = match HvfGicV3::new')
b=s.index('            Arc::new(Mutex::new(gic))',a)
s=s[:a]+'''            let gic = if std::env::var_os("JITK_USERSPACE_GIC").is_some() {
                eprintln!("JITK_GIC userspace (forced)");
                IrqChipDevice::new(Box::new(GicV3::new(vcpu_list.clone())))
            } else {
                match HvfGicV3::new(vm_resources.vm_config().vcpu_count.unwrap() as u64) {
                    Ok(hvfgic) => {
                        eprintln!("JITK_GIC hvf");
                        IrqChipDevice::new(Box::new(hvfgic))
                    }
                    Err(e) => {
                        eprintln!("JITK_GIC userspace fallback: {e:?}");
                        IrqChipDevice::new(Box::new(GicV3::new(vcpu_list.clone())))
                    }
                }
            };
'''+s[b:]
p.write_text(s)

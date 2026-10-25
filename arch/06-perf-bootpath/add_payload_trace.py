from pathlib import Path
p=Path('/tmp/jitk-06/libkrun/src/libkrun/src/vmm/builder.rs')
s=p.read_text()
s=s.replace('            let data: Vec<u8> = std::fs::read(external_kernel.path.clone())\n                .map_err(StartMicrovmError::RawOpenKernel)?;\n            guest_mem.write(&data, GuestAddress(0x8000_0000)).unwrap();', '''            unsafe { hvf::jitk_trace::mark(c"kernel_read_begin".as_ptr()); }
            let data: Vec<u8> = std::fs::read(external_kernel.path.clone())
                .map_err(StartMicrovmError::RawOpenKernel)?;
            unsafe { hvf::jitk_trace::mark(c"kernel_read_end".as_ptr()); hvf::jitk_trace::mark(c"kernel_write_begin".as_ptr()); }
            guest_mem.write(&data, GuestAddress(0x8000_0000)).unwrap();
            unsafe { hvf::jitk_trace::mark(c"kernel_write_end".as_ptr()); }''')
s=s.replace('        let data = std::fs::read(initramfs_path).map_err(StartMicrovmError::InitrdRead)?;','''        unsafe { hvf::jitk_trace::mark(c"initrd_read_begin".as_ptr()); }
        let data = std::fs::read(initramfs_path).map_err(StartMicrovmError::InitrdRead)?;
        unsafe { hvf::jitk_trace::mark(c"initrd_read_end".as_ptr()); hvf::jitk_trace::mark(c"initrd_write_begin".as_ptr()); }''')
s=s.replace('            .write(&data, GuestAddress(arch_mem_info.initrd_addr))\n            .unwrap();','            .write(&data, GuestAddress(arch_mem_info.initrd_addr))\n            .unwrap();\n        unsafe { hvf::jitk_trace::mark(c"initrd_write_end".as_ptr()); }',1)
s=s.replace('    let guest_mem = if use_vhost_user {','    unsafe { hvf::jitk_trace::mark(c"guest_mmap_begin".as_ptr()); }\n    let guest_mem = if use_vhost_user {',1)
s=s.replace('    let LoadedPayload {\n        guest_mem,','    unsafe { hvf::jitk_trace::mark(c"guest_mmap_end".as_ptr()); }\n    let LoadedPayload {\n        guest_mem,',1)
p.write_text(s)

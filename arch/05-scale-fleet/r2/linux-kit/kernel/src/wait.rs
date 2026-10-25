use core::arch::asm;
static mut TICK: u64 = 1000;
pub fn ticks() -> u64 {
    let n;
    unsafe {
        asm!("mrs {n},cntvct_el0",n=out(reg)n);
    }
    n
}
pub fn ticks_ns(n: u64) -> u64 {
    let hz: u64;
    unsafe {
        asm!("mrs {h},cntfrq_el0",h=out(reg)hz);
    }
    n / hz * 1_000_000_000 + (n % hz) * 1_000_000_000 / hz
}
pub fn now_ns() -> u64 {
    ticks_ns(ticks())
}
unsafe fn wr(a: usize, v: u32) {
    unsafe {
        asm!("str {v:w},[{a}]",v=in(reg)v,a=in(reg)a);
    }
}
unsafe fn rd(a: usize) -> u32 {
    let v;
    unsafe {
        asm!("ldr {v:w},[{a}]",v=out(reg)v,a=in(reg)a);
    }
    v
}
pub unsafe fn init(d: usize, r: usize, irq: u32, tick: u64) {
    unsafe {
        TICK = tick;
        if tick != 0 {return;} // Isolated CNTV fallback needs no GIC.
        // GICD: nonsecure affinity routing, group 1; GICR wake and PPI group.
        wr(d, 0);
        wr(r + 0x14, rd(r + 0x14) & !2);
        while rd(r + 0x14) & 4 != 0 {
            core::hint::spin_loop();
        }
        wr(r + 0x10080, u32::MAX);
        wr(
            d + 0x80 + (irq as usize / 32) * 4,
            rd(d + 0x80 + (irq as usize / 32) * 4) | (1 << (irq % 32)),
        );
        wr(d + 0x400 + (irq as usize & !3), 0x80808080);
        // IROUTER targets affinity 0. Edge-trigger avoids a permanently asserted SPI
        // in libkrun's hv_gic_set_spi(true)-only implementation.
        let route = d + 0x6000 + irq as usize * 8;
        asm!("str xzr,[{a}]",a=in(reg)route);
        let cfg = d + 0xc00 + irq as usize / 16 * 4;
        wr(cfg, rd(cfg) | (2 << ((irq % 16) * 2)));
        wr(d + 0x100 + irq as usize / 32 * 4, 1 << (irq % 32));
        wr(d, 0x12);
        asm!("msr icc_sre_el1,{one}","isb","msr icc_pmr_el1,{mask}","msr icc_bpr1_el1,xzr","msr icc_ctlr_el1,xzr","msr icc_igrpen1_el1,{one}","isb",one=in(reg)1u64,mask=in(reg)255u64);
    }
}
pub unsafe fn ack() {
    unsafe {
        if TICK != 0 {return;}
        // Bounded because a broken level-triggered device must not lock the kernel.
        for _ in 0..32 {
            let id: u64;
            asm!("mrs {id},icc_iar1_el1",id=out(reg)id);
            if id >= 1020 {
                break;
            }
            asm!("msr icc_eoir1_el1,{id}",id=in(reg)id);
        }
    }
}
pub unsafe fn park(deadline: u64) {
    unsafe {
        // DAIF stays masked: pending interrupts wake WFI but cannot enter vectors.
        ack();
        // Recheck DMA rings after consuming IRQs: an IRQ may have raced the caller.
        crate::console::service();
        if crate::console::available() || crate::console::eof() {
            return;
        }
        if TICK == 0 && deadline == u64::MAX {
            asm!("msr cntv_ctl_el0,xzr", "dsb sy", "wfi", "isb");
        } else {
            let span = deadline.saturating_sub(now_ns()).min(if TICK == 0 {
                1_000_000
            } else {
                TICK * 1000
            });
            if span == 0 {
                return;
            }
            let hz: u64;
            asm!("mrs {h},cntfrq_el0",h=out(reg)hz);
            let end = ticks() + (span * hz / 1_000_000_000).max(1);
            asm!("msr cntv_cval_el0,{end}","msr cntv_ctl_el0,{one}","isb","dsb sy","wfi","msr cntv_ctl_el0,xzr","isb",end=in(reg)end,one=in(reg)1u64);
        }
    }
}

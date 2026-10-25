#!/usr/bin/env python3
import os,shutil,subprocess
from pathlib import Path
root=Path(__file__).resolve().parent;work=Path(os.getenv('JITK_WORK',str(root/'.work'))).resolve();work.mkdir(parents=True,exist_ok=True)
fixtures=root.parent/'vmm/tests/fixtures'
for name in ['bad-sysreg','console_avail_oob','mmio-halfword','rtc_oob_read','unknown-hvc','unknown-smc']:
 source=fixtures/(name+'.S')
 obj=work/(source.stem+'.o');image=work/(source.stem+'.bin')
 subprocess.run(['clang','--target=aarch64-none-elf','-c',str(source),'-o',str(obj)],check=True)
 subprocess.run(['ld.lld','-T',str(root/'guest/link.ld'),'--oformat=binary',str(obj),'-o',str(image)],check=True)
shutil.copy2(root/'guest/kk.bin',work/'kk.bin')

from pathlib import Path
import subprocess,sys
p=Path(__file__).resolve().parent
for test in ('checks.py','clock-check.py','run-probes.py','grow_contract.py'):
    subprocess.run([sys.executable,str(p/test)],check=True)

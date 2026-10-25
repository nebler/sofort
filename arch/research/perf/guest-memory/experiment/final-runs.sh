#!/bin/sh
set -eu
python3 /tmp/sofort-a1/run.py --wait-audit --n 10 --image /tmp/sofort-a1/instrumented-final/kernel.bin --out /tmp/sofort-a1/raw/final-census
python3 /tmp/sofort-a1/run.py --wait-audit --n 10 --image /tmp/sofort-a1/nozero-final/kernel.bin --out /tmp/sofort-a1/raw/final-nozero
python3 /tmp/sofort-a1/run.py --n 10 --image /tmp/sofort-a1/baseline/kernel.bin --out /tmp/sofort-a1/raw/final-baseline

"""Mutable run evidence is separate from the historical out/ receipts."""
import os
from pathlib import Path
ROOT = Path(__file__).resolve().parent
OUT = Path(os.getenv('JITK_LINUX_OUT', str(ROOT / ('out' if os.getenv('JITK_RECORD') == '1' else '.work/out')))).resolve()

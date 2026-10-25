"""Verifier-owned negative tests; run after both transactions produce receipts."""
import copy, json, pathlib, unittest
from adapters import guest, linux, compare
R=pathlib.Path(__file__).resolve().parent/'results'
class AdapterTests(unittest.TestCase):
    def test_saved_receipts(self):
        for name in ('ioctl','ppoll'):
            d=R/(name+'-accepted')
            native=linux((d/'linux.strace').read_text(),(d/'linux.stdout').read_bytes(),(d/'linux.stderr').read_bytes(),0)
            actual=guest((d/'after.stdout').read_bytes())
            compare(native,actual)
    def test_missing_rejected(self):
        for name in ('ioctl','ppoll'):
            with self.assertRaises(AssertionError): guest((R/(name+'-accepted')/'before.stdout').read_bytes())
    def test_truncated_rejected(self):
        raw=(R/'ppoll-accepted/after.stdout').read_bytes()
        with self.assertRaises((AssertionError,ValueError)): guest(raw[:raw.index(b'"kind":"done"')-20])
    def test_memory_change_rejected(self):
        a=json.loads((R/'ppoll-accepted/linux.canonical.json').read_text());b=copy.deepcopy(a)
        b['events'][0]['output'][0][2]=0
        with self.assertRaises(AssertionError): compare(a,b)
    def test_unknown_syscall_rejected(self):
        raw=(R/'ppoll-accepted/after.stdout').read_bytes().replace(b'"nr":73',b'"nr":999',1)
        with self.assertRaises(AssertionError): guest(raw)
if __name__=='__main__': unittest.main()

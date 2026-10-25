import unittest
from normalize import normalize
class Tests(unittest.TestCase):
    def test_heap_size_not_hidden(self):
        a='1 brk(NULL) = 0x10000\n1 brk(0x12000) = 0x12000'
        b=a.replace('0x12000','0x13000')
        self.assertNotEqual(normalize(a),normalize(b))
        self.assertEqual(normalize(a),normalize(a.replace('0x10000','0x20000').replace('0x12000','0x22000')))
    def test_mapping_offset(self):
        e=normalize('1 mmap(NULL, 8192, 3, 34, -1, 0) = 0x10000\n1 munmap(0x11000, 4096) = 0')
        self.assertEqual(e[1]['args'][0],'M0+4096')
    def test_fail_closed(self):
        for a in ['1 read(3, "x"..., 200) = 100','1 clone(0) = 2','1 --- SIGSEGV ---','1 read(3, <unfinished ...>']:
            with self.assertRaises(ValueError): normalize(a)
        with self.assertRaises(ValueError): normalize('1 read(0, \"\", 1) = 0', require_exit=True)
    def test_errno_and_binary_bytes(self):
        a='1 writev(1, [{iov_base="\\x00\\xff", iov_len=2}], 1) = 2'
        self.assertIn('\\xff',normalize(a)[0]['args'][1])
        a='1 ioctl(1, 0x5413, 0x10000) = -1 ENOTTY (Not a tty)'
        self.assertNotEqual(normalize(a),normalize(a.replace('ENOTTY','ENOSYS')))
if __name__=='__main__': unittest.main()

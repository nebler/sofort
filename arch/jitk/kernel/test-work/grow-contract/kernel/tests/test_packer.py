import sys,struct,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from prepare import pack, archive
import os, tempfile

def elf(second=0x401000, flags=6):
    b=bytearray(8192); b[:7]=b'\x7fELF\x02\x01\x01'
    struct.pack_into('<HHIQQQIHHHHHH',b,16,2,183,1,0x400100,64,0,0,64,56,2,0,0,0)
    struct.pack_into('<IIQQQQQQ',b,64,1,5,0,0x400000,0,512,512,1)
    struct.pack_into('<IIQQQQQQ',b,120,1,flags,4096,second,0,32,64,1)
    b[4096:4128]=b'X'*32
    return b
class Packer(unittest.TestCase):
    def test_disjoint_bytes_shared_rx_rw_page(self):
        with self.assertRaisesRegex(ValueError,'share a page'): pack(elf(0x400800))
    def test_wx(self):
        with self.assertRaisesRegex(ValueError,'W\\+X'): pack(elf(flags=7))
    def test_separate_pages_and_zero_bss(self):
        flat,meta=pack(elf()); self.assertEqual(flat[4096:4128],b'X'*32)
        self.assertEqual(flat[4128:4160],b'\0'*32); self.assertEqual(meta['phdr'],0x400040)
    def test_no_loaded_phdr(self):
        b=elf();struct.pack_into('<Q',b,64+8,256)
        with self.assertRaisesRegex(ValueError,'header table'): pack(b)
    def test_real_qjs(self):
        flat,meta=pack((Path(__file__).resolve().parents[1]/'payload/qjs').read_bytes())
        self.assertGreater(len(flat),2_000_000); self.assertEqual(meta['physical_base'],'0x80080000')
class Archive(unittest.TestCase):
    def test_layout(self):
        with tempfile.TemporaryDirectory() as d:
            os.makedirs(d+'/b/c'); open(d+'/a.txt','wb').write(b'hi'); open(d+'/b/c/z','wb').write(b'')
            fs,count=archive(d); self.assertEqual((fs[:8],count),(b'JITKFS01',5))
            e=[struct.unpack_from('<6I',fs,16+24*i) for i in range(count)]
            name=lambda i: fs[e[i][0]:e[i][0]+e[i][1]]
            self.assertEqual((e[0][3:],[name(i) for i in (1,2)]),((1,1,2),[b'a.txt',b'b']))  # sorted, contiguous
            self.assertEqual(fs[e[1][4]:e[1][4]+e[1][5]],b'hi'); self.assertEqual((e[3][2],e[4][2]),(2,3))
    def test_empty_and_symlink(self):
        self.assertEqual(archive(None),(b'JITKFS01'+struct.pack('<II6I',1,0,40,0,0,1,1,0),1))
        with tempfile.TemporaryDirectory() as d:
            os.symlink('/etc/passwd',d+'/link')
            with self.assertRaisesRegex(ValueError,'symlink'): archive(d)
if __name__=='__main__': unittest.main()

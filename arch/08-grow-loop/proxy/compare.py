import json,pathlib,sys

def compare(a,b):
    a,b=pathlib.Path(a),pathlib.Path(b)
    for name in ['trace.jsonl','stdout.bin','stderr.bin']:
        if (a/name).read_bytes() != (b/name).read_bytes():
            raise AssertionError('mismatch: '+name)
    for k in ['exit','arch','binary_sha256']:
        assert json.loads((a/'meta.json').read_text())[k]==json.loads((b/'meta.json').read_text())[k], k
if __name__=='__main__':
    compare(*sys.argv[1:]); print('equivalent: syscall events, stdout, stderr, exit, binary, arch')

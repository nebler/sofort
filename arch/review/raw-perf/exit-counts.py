"""Decode this host's perf kvm_exit samples using saved exit-format.txt.

perf script emitted no rows for this capture, so inspect PERF_RECORD_SAMPLE RAW
directly. Deliberately rejects other sample layouts. Input may be gzip-compressed.
"""
import collections, gzip, hashlib, json, struct, sys
path = sys.argv[1]
b = (gzip.open(path, 'rb') if path.endswith('.gz') else open(path, 'rb')).read()
assert b[:8] == b'PERFILE2'
at, length = struct.unpack_from('<QQ', b, 40)
end = at + length
ec, returns, pcs = collections.Counter(), collections.Counter(), collections.Counter()
lost = 0
while at < end:
    kind, misc, size = struct.unpack_from('<IHH', b, at)
    assert size >= 8 and at + size <= end
    if kind == 9:
        # IP,TID,TIME,CPU,PERIOD,RAW: see the saved perf report -D first sample.
        assert size == 80
        raw_size, = struct.unpack_from('<I', b, at + 48)
        assert raw_size == 28
        event, = struct.unpack_from('<H', b, at + 52)
        assert event == 64  # ID in this host's saved tracefs format.
        ret, syndrome, pc = struct.unpack_from('<iIQ', b, at + 60)
        returns[str(ret)] += 1
        ec[hex(syndrome)] += 1
        pcs[hex(pc)] += 1
    elif kind == 2:
        lost += struct.unpack_from('<Q', b, at + 16)[0]
    at += size
assert at == end
print(json.dumps({'sha256':hashlib.sha256(b).hexdigest(),'samples':sum(ec.values()),'lost':lost,'ec':dict(ec),'return':dict(returns),'top_pcs':pcs.most_common(10)},indent=2))

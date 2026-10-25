#!/usr/bin/python3
"""Offline hostile shard stand-in. Never used on an execution path."""
import mmap
import os
import select
import struct
import sys

CAP, RECORD = 64, 16416
REGION = CAP * RECORD
memory = mmap.mmap(3, 4096 + 2 * REGION)
mode = sys.argv[2]
produced = 0

def notify():
    os.write(5, struct.pack('<Q', 1))

def send(kind, slot=0, generation=0, identity=0, payload=b'', length=None, reserved=0):
    global produced
    record = struct.pack('<IIQIIQ', kind, slot, generation, identity,
                         len(payload) if length is None else length, reserved) + payload
    at = 4096 + REGION + produced % CAP * RECORD
    memory[at:at + len(record)] = record
    produced += 1
    memory[192:200] = struct.pack('<Q', produced)
    notify()

send(20)
# Wait for Node's first admission, then attack that exact run/generation.
while struct.unpack_from('<Q', memory, 64)[0] == 0:
    select.select([4], [], [], 3)
    try:
        os.read(4, 8)
    except BlockingIOError:
        pass
_, slot, generation, _, _, _ = struct.unpack_from('<IIQIIQ', memory, 4096)
memory[128:136] = struct.pack('<Q', 1)
if mode == 'producer':
    memory[192:200] = struct.pack('<Q', 2**64 - 1)
    notify()
elif mode == 'consumer':
    memory[128:136] = struct.pack('<Q', 2**64 - 1)
    # A log makes Node return queue credit and attempt a reply.
    send(16, slot, generation, 1, b'["log","log","x"]')
elif mode == 'length':
    send(16, slot, generation, 1, length=2**32 - 1)
elif mode == 'reserved':
    send(16, slot, generation, 1, reserved=1)
elif mode == 'slot':
    send(16, 64, generation, 1, b'["call","tools","echo",[]]')
elif mode == 'generation':
    send(16, slot, generation+1, 1, b'["call","tools","echo",[]]')
elif mode == 'kind':
    send(1, slot, generation)
elif mode == 'identity':
    send(16, slot, generation, 2, b'["call","tools","echo",[]]')
elif mode == 'duplicate':
    send(16, slot, generation, 1, b'["call","tools","echo",[]]')
    send(16, slot, generation, 1, b'["call","tools","echo",[]]')
elif mode == 'json':
    send(16, slot, generation, 1, b'["call","tools","echo",[{"a":1,"a":2}]]')
elif mode == 'nonascii':
    send(16, slot, generation, 1, b'["call","tools","echo",["\xe1"]]')
elif mode == 'completion':
    send(17, slot, generation, 0, b'{"ok":1}')
elif mode == 'stats':
    send(22, slot, generation, 0, struct.pack('<QQQQ', 0, 0, 0, 2**64-1))
else:
    raise ValueError(mode)
# Parent should kill the stand-in; bounded timeout catches a broken test.
select.select([], [], [], 5)

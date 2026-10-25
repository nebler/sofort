#!/usr/bin/env python3
"""Docker/Linux process-page experiment, not KVM. Exact mapping PSS from smaps."""
import ctypes, fcntl, json, mmap, os, re, signal, tempfile
N, SIZE, DIRTY = 32, 8*1024*1024, 1024*1024

def run(mode):
    if mode == 'memfd':
        fd = os.memfd_create('jitk-image', os.MFD_ALLOW_SEALING)
        holder = None
    else:
        holder = tempfile.TemporaryFile(dir='/work')
        fd = holder.fileno()
    os.write(fd, bytes((i*17+3)%256 for i in range(SIZE)))
    if mode == 'memfd':
        fcntl.fcntl(fd, fcntl.F_ADD_SEALS, fcntl.F_SEAL_WRITE|fcntl.F_SEAL_GROW|fcntl.F_SEAL_SHRINK|fcntl.F_SEAL_SEAL)
    children = []
    try:
        for _ in range(N):
            rd, wr = os.pipe()
            pid = os.fork()
            if pid == 0:
                os.close(rd)
                flags = mmap.MAP_PRIVATE | (mmap.MAP_ANONYMOUS if mode=='anonymous-copy' else 0)
                m = mmap.mmap(-1 if mode=='anonymous-copy' else fd, SIZE, flags=flags,
                              prot=mmap.PROT_READ|mmap.PROT_WRITE)
                if mode=='anonymous-copy': m[:] = os.pread(fd, SIZE, 0)
                checksum = sum(m[i] for i in range(0,SIZE,4096))
                m[SIZE-DIRTY:] = b'x'*DIRTY
                addr = ctypes.addressof(ctypes.c_char.from_buffer(m))
                os.write(wr, str(addr).encode()); os.close(wr)
                signal.pause(); os._exit(checksum & 0)
            os.close(wr)
            addr = int(os.read(rd,100)); os.close(rd)
            children.append((pid,addr))
        totals = dict(Rss=0,Pss=0,Private_Dirty=0,Shared_Clean=0,Shared_Dirty=0)
        for pid, addr in children:
            selected = False
            for line in open(f'/proc/{pid}/smaps'):
                if re.match(r'^[0-9a-f]+-',line):
                    lo,hi = (int(x,16) for x in line.split()[0].split('-'))
                    selected = lo <= addr < hi
                elif selected and line.split(':')[0] in totals:
                    k,v = line.split(':'); totals[k] += int(v.split()[0])
        # A guest's private write must not modify the shared source.
        source_ok = os.pread(fd,1,SIZE-DIRTY) == bytes([((SIZE-DIRTY)*17+3)%256])
        print(json.dumps(dict(mode=mode,n=N,size_mib=SIZE//2**20,dirty_mib=DIRTY//2**20,
                              mapping_totals_kib=totals,source_unchanged=source_ok)),flush=True)
    finally:
        for pid,_ in children: os.kill(pid,signal.SIGKILL)
        for pid,_ in children: os.waitpid(pid,0)
        if holder: holder.close()
        else: os.close(fd)
for mode in ['anonymous-copy','file-private','memfd']: run(mode)

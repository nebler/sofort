#!/usr/bin/env python3
import collections,json,pathlib,re,sys
R=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '/home/dev/r6-census');RAW=R/'raw'
slots=json.loads((R/'kernel/slots.json').read_text());registered=set(slots.values())|{'exit_group'}
# arm64 strace spells the 79 slot newfstatat; a registered name does not imply full semantics.
partial={'rt_sigaction','rt_sigprocmask','mremap','mmap','ioctl','fcntl','ppoll','newfstatat','clock_gettime','munmap'}
rows=[]
for p in sorted(RAW.glob('*/native.json')):
 j=json.loads(p.read_text());n=j['workload']['name'];m=j['metadata'];text=(p.parent/'full.strace').read_text();calls=collections.Counter(re.findall(r'^\d+\s+([a-zA-Z_][a-zA-Z_0-9]*)\(',text,re.M));count_names={l.split()[-1] for l in (p.parent/'count.strace').read_text().splitlines() if l.split() and re.fullmatch(r'[0-9.]+',l.split()[0]) and re.fullmatch(r'[a-z][a-z0-9_]*',l.split()[-1]) and l.split()[-1]!='total'};used=(set(calls)|count_names)-{'execve','execveat'}
 
 if calls['execve']>1:used.add('execve')
 if calls['execveat']>0:used.add('execveat')
 missing=sorted(used-registered);sem=sorted(used&partial);kj=p.parent/'jitk.json';k=json.loads(kj.read_text()) if kj.exists() else {'status':'not-run'}
 mm=[l for l in text.splitlines() if 'mmap(' in l];filemap=[l for l in mm if 'MAP_ANONYMOUS' not in l]
 clones=[l for l in text.splitlines() if re.search(r'\b(clone|clone3|fork|vfork)\(',l)]
 procs=sorted(set(re.findall(r'"(/proc/[^"\n]*)"',text)));devs=sorted(set(re.findall(r'"(/dev/[^"\n]*)"',text)));syspaths=sorted(set(re.findall(r'"(/sys/[^"\n]*)"',text)))
 ioctls=[l for l in text.splitlines() if 'ioctl(' in l]
 writes=[l for l in text.splitlines() if re.search(r'\b(openat|open|mkdir|mkdirat|rename|renameat|unlink|unlinkat|pwrite64|ftruncate)\(',l) and re.search(r'O_WRONLY|O_RDWR|O_CREAT|O_TRUNC|\b(?:mkdir|mkdirat|rename|renameat|unlink|unlinkat|pwrite64|ftruncate)\(',l) and '"/dev/null"' not in l]
 successwrites=[l for l in writes if re.search(r'= [0-9]+',l)]
 r=dict(name=n,category=j['workload']['category'],sha256=m['sha256'],bytes=m['bytes'],elf_type=m['elf_type'],interpreter=m['interpreter'],dynamic=m['dynamic'],tls=m['tls'],load_ranges=[[hex(h['vaddr']),hex(h['vaddr']+h['memsz'])] for h in m['headers'] if h['type']==1],pack_error=m['pack_error'],native_ok=j['oracle_ok'],stdout_same=j['stdout_same'],syscalls=sorted(used),syscall_count=len(used),missing=missing,partial=sem,threads=any('CLONE_THREAD' in l for l in clones),clone_lines=clones,child_exec= max(0,calls['execve']+calls['execveat']-1),file_mmap=bool(filemap),file_mmap_lines=filemap,writable_fs=bool(successwrites),writable_fs_attempts=bool(writes),writable_fs_lines=writes,proc_paths=procs,dev_paths=devs,sys_paths=syspaths,ioctl_lines=ioctls,network=bool(used&{'socket','connect','sendto','recvfrom','sendmsg','recvmsg','bind','listen','accept','accept4'}),jitk=k)
 rows.append(r)
freq=collections.defaultdict(list);semfreq=collections.defaultdict(list)
# Count only successful static reference runs; one row per workload artifact; jq-musl is a deliberate second artifact.
for r in rows:
 if not r['native_ok'] or r['interpreter']:continue
 for s in r['missing']:freq[s].append(r['name'])
 for s in r['partial']:semfreq[s].append(r['name'])
out=dict(rows=rows,missing_frequency=sorted([dict(syscall=s,count=len(v),tools=v) for s,v in freq.items()],key=lambda x:(-x['count'],x['syscall'])),partial_frequency=sorted([dict(syscall=s,count=len(v),tools=v) for s,v in semfreq.items()],key=lambda x:(-x['count'],x['syscall'])))
(RAW/'summary.json').write_text(json.dumps(out,indent=2)+'\n')
for r in rows:print(r['name'],r['syscall_count'],','.join(r['missing']), 'threads',r['threads'],'filemap',r['file_mmap'],'writefs',r['writable_fs'],'runs',r['jitk'].get('runs_today'))
print('FREQUENCY',[(r['syscall'],r['count']) for r in out['missing_frequency']])

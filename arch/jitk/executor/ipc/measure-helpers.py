import pathlib,subprocess,json,time,os,signal,select
# Offline cgroup ledger: run as root under /home/dev/bench.lock.
root=pathlib.Path(os.environ.get('JITK_HELPERS_ROOT','/home/dev/r8-helpers'));phase=os.environ['PHASE'];out=root/'raw'/phase;out.mkdir(parents=True,exist_ok=True)
cgroot=pathlib.Path('/sys/fs/cgroup/r8-helpers');cgroot.mkdir(exist_ok=True)
(cgroot/'cgroup.subtree_control').write_text('+memory +cpu')
node=os.environ.get('JITK_NODE','/home/dev/r7-ipc/node/node-v24.13.0-linux-arm64/bin/node')
base=os.environ['JITK_SHARD_SNAPSHOT']
def read(p):return pathlib.Path(p).read_text()
for rep in range(2):
 for n in [1,16,32,64]:
  for ext in ['mem','regs','layout']:
   with open(base+'.'+ext,'rb') as f:
    while f.read(65536):pass
  cg=cgroot/f'{phase}-{rep}-{n}';cg.mkdir()
  # shell exec ensures Node + shard + watchdog are charged from launch.
  command=['sh','-c','echo $$ > "$1/cgroup.procs"; shift; exec "$@"','spawn',str(cg),node,str(root/'arch/jitk/executor/ipc/measure-helpers.mjs'),'hold',str(n)]
  err=open(out/f'{rep}-{n}.stderr','w');p=subprocess.Popen(command,stdout=subprocess.PIPE,stderr=err,env=os.environ,bufsize=0)
  events=[]
  try:
   while True:
    if not select.select([p.stdout],[],[],120)[0]:raise TimeoutError('no holder progress')
    line=p.stdout.readline()
    if not line:raise RuntimeError(f'holder failed {p.poll()}')
    e=json.loads(line);events.append(e)
    if e['event']=='held':break
   time.sleep(1)
   samples=[]
   for _ in range(3):
    pids=[int(x) for x in read(cg/'cgroup.procs').split()]
    smaps={str(pid):read(f'/proc/{pid}/smaps_rollup') for pid in pids}
    samples.append(dict(memory_current=int(read(cg/'memory.current')),memory_stat=read(cg/'memory.stat'),smaps=smaps,load=read('/proc/loadavg')));time.sleep(.2)
   result=dict(phase=phase,n=n,rep=rep,events=events,samples=samples,memory_peak=int(read(cg/'memory.peak')))
   (out/f'{rep}-{n}.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(dict(phase=phase,rep=rep,n=n,current=samples[1]['memory_current'])),flush=True)
  finally:
   p.send_signal(signal.SIGTERM);p.wait(timeout=15);err.close();cg.rmdir()
cgroot.rmdir()

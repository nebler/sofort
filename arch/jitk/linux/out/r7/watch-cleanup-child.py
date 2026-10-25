import json,os,pathlib,signal,subprocess,time
root=pathlib.Path('/sys/fs/cgroup')/f'jitk-05-{os.getpid()}'
root.mkdir();cg=root/'escaped';cg.mkdir()
wrapper=subprocess.Popen(['./spawn-cg',str(cg),'/bin/sleep','60'],start_new_session=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
for i in range(100):
 pids=(cg/'cgroup.procs').read_text().split()
 if pids:break
 time.sleep(.01)
pathlib.Path('victims.json').write_text(json.dumps({'group':str(root),'pids':[wrapper.pid,*map(int,pids)]}))
signal.signal(signal.SIGTERM,signal.SIG_IGN)
print('JITK_GATE {"gate":"injected_stall","event":"start"}',flush=True)
time.sleep(60)

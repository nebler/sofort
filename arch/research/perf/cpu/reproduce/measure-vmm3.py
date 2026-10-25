exec(open('/tmp/sofort-a2/measure_vmm.py').read().split("if __name__=='__main__':")[0])
data={'commit':(R/'COMMIT').read_text().strip(),'samples':[],'uptime_start':subprocess.check_output(['uptime'],text=True),'timebase':{'numer':125,'denom':3},'note':'final instrumentation: absolute monotonic main origin, exit snapshots at frames, one buffered guest dump; three warmups excluded'}
failures=[{'stage':'first attempt before any saved sample','error':(R/'raw/vmm3-run.log').read_text(),'note':'5 second startup controller deadline; no stdout/stderr observed'}]
for i in range(33):
 batch=[('images/base/kernel.bin','return2'),('images/base/kernel.bin','one_tool'),('images/trace/kernel.bin','return2')];random.Random(i+420).shuffle(batch)
 for k,c in batch:
  for attempt in range(3):
   try:x=one('vmm-trace3',k,c,True,True);break
   except Exception as e:
    failures.append({'iteration':i,'image':k,'case':c,'attempt':attempt,'error':repr(e),'uptime':subprocess.check_output(['uptime'],text=True)})
  else:raise RuntimeError('three attempts failed')
  x.update(iteration=i,warmup=i<3);data['samples'].append(x);data['failures']=failures
 (R/'raw/vmm3.json').write_text(json.dumps(data,indent=2))
 if i%10==0:print(i,flush=True)
data['uptime_end']=subprocess.check_output(['uptime'],text=True);(R/'raw/vmm3.json').write_text(json.dumps(data,indent=2))

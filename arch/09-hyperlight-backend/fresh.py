import subprocess, time, json, sys
for i in range(40):
    t=time.perf_counter_ns()
    p=subprocess.run([sys.argv[1], *(sys.argv[2:] or ['one'])],capture_output=True,text=True,check=True)
    elapsed=time.perf_counter_ns()-t
    print(json.dumps(dict(metric='process_to_result_exit',i=i,ns=elapsed)))
    for line in p.stdout.splitlines():
        r=json.loads(line)
        if 'ns' in r:r['i']=i
        else:r['iteration']=i
        print(json.dumps(r))

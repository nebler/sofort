#!/usr/bin/env python3
import contextlib,http.server,threading,pathlib,json,os,subprocess
import census
R=census.R
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*args,**kw):super().__init__(*args,directory=str(census.FIX),**kw)
 def log_message(self,*args):pass
s=http.server.ThreadingHTTPServer(('127.0.0.1',18086),Handler);threading.Thread(target=s.serve_forever,daemon=True).start()
ws=[dict(name='git',category='hard',binary=str(R/'artifacts/git-distro/git'),expected_returncode=1,argv=['--no-pager','diff','--no-index','--','data/input.txt','data/sub/notes.txt'],stdin_hex='',expected_hex=None),dict(name='curl',category='hard',binary=str(R/'artifacts/curl-distro/curl'),argv=['--silent','--show-error','--max-time','2','http://127.0.0.1:18086/data/input.json'],stdin_hex='',expected_hex=(census.FIX/'data/input.json').read_bytes().hex()),dict(name='duckdb-gnu',category='database',binary=str(R/'artifacts/duckdb-gnu/unpacked/duckdb'),argv=['-batch','-csv','-c',"SELECT sum(n) FROM read_csv('data/input.csv');"],stdin_hex='',expected_hex=b'sum(n)\n7\n'.hex())]
try:
 for w in ws:census.native(w);census.jitk(w)
 census.dump(R/'raw/contrast-workloads.json',ws)
 # Git shell aliases exercise the separate fork/exec workload, not a necessary dependency of diff.
 w=dict(ws[0],name='git-shell',expected_returncode=0,expected_hex=b'agent-shell\n'.hex(),argv=['-c','alias.scan=!echo agent-shell','scan']);census.native(w);census.jitk(w)
finally:s.shutdown();s.server_close()

const mode=process.argv[2];let acknowledged=false;
process.stdout.write('{"t":"ready","v":1}\n');
if(mode==='host-ack')setTimeout(()=>{acknowledged=true;process.stderr.write('{"sandbox":"ok"}\n');},25);
if(mode==='fragmented-ack'){process.stderr.write('{"sandbox":');setTimeout(()=>{acknowledged=true;process.stderr.write('"ok"}\n');},25);}
if(mode==='guest-ack')process.stdout.write('{"t":"log","level":"info","msg":"{\\"sandbox\\":\\"ok\\"}"}\n');
process.stdin.on('data',()=>process.stdout.write(JSON.stringify({t:'done',ok:acknowledged?2:'RUN before host ack'})+'\n'));

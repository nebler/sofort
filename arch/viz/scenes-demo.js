const SC=[
{t:'Cloudflare code mode, today',cap:'The model writes JavaScript, and it runs in a <b>Dynamic Worker</b>: a V8 isolate that starts in milliseconds and reaches the outside world only through <b>bindings</b> such as R2 buckets and databases. It\'s ideal for JavaScript glue. <i>This page explains a demo we plan to build; tags mark what exists today.</i>',d(){
 box(20,215,140,80,['model'],{c:C.pur,size:20});arrow([160,255,212,255]);
 code(215,165,330,180,['// code mode','const rows = await','  env.DB.query(sql);','return rows.length;'],{size:15});
 arrow([545,255,598,255]);
 box(600,165,180,180,['Dynamic Worker','V8 isolate','starts in ms'],{c:C.blue,size:16});
 [['env.LOGS · R2',140],['env.DB',230],['env.AI',320]].forEach(([n,y])=>{box(820,y-22,120,44,[n],{c:C.mut,size:13});arrow([780,255,818,y],{c:C.dim})});
 flow([160,255,212,255],{n:2,sp:60});flow([545,255,598,255],{n:2,sp:60});}},
{t:'Then the task needs real tools',cap:'Now the user asks: <b>“find the 10 slowest endpoints in these logs.”</b> The right tools are <b>rg</b> and <b>sqlite3</b>, native programs that can\'t run in an isolate. Today code mode falls back to <b>container.exec</b>: a whole Linux container with a cold start measured in seconds, and credentials copied inside it.',d(){
 box(160,40,640,56,['“Find the 10 slowest endpoints in these logs.”'],{c:C.yel,size:18,fo:0.08});
 box(40,170,220,150,['Dynamic Worker','JavaScript only'],{c:C.blue,size:17});
 lab(150,360,['✗ no rg','✗ no sqlite3'],{c:C.red,size:16,lh:24});
 arrow([260,245,560,245],{c:C.red,dash:'7 5',label:'container.exec(…)',lx:410,ly:232,lc:C.red});
 box(565,140,370,300,null,{c:C.red,fo:0.08});
 lab(750,175,'full Linux container',{size:19,w:600});
 lab(590,225,['• cold start: ~1–3 s (reported)','• a whole OS to boot and patch','• credentials copied inside','• one big box, reused across steps'],{anchor:'start',size:16,lh:34});
 tag(590,410,'reported','reported figure, not our measurement');
 flow([260,245,560,245],{n:2,sp:120,c:C.red});}},
{t:'Instead: ask for a computer',cap:'The model writes one more line: <b>env.SOFORT.computer(…)</b>. It names a <b>grant</b> (the logs bucket) and the binaries it needs. Sofort assembles a <b>purpose-built computer</b> for exactly that: a kernel profile plus rg plus sqlite3, then boots it in a hardware-isolated VM. The goal is about <b>1 ms</b> from a snapshot.',d(){
 code(40,40,880,110,['const box = env.SOFORT.computer({','  grant: { logs: env.LOGS },  bins: ["rg", "sqlite3"] });'],{size:16});
 const parts=[['kernel profile','just what rg + sqlite3 need',C.blue,170],['rg','static binary',C.grn,400],['sqlite3','static binary',C.grn,630]];
 parts.forEach(([a,b,c,x])=>{box(x-90,190,180,70,[a,b],{c,size:15});flow([x,260,x,300,480,370],{n:2,sp:90,c})});
 box(330,370,300,110,['computer 7f2c','hardware-isolated microVM'],{c:C.yel,size:17,fo:0.12,sw:3});
 tag(660,410,'target','boot from snapshot: ~1 ms (not built yet)');
 tag(660,445,'measured','today: 6 ms cold, 0.29 ms pre-booted');}},
{t:'Capabilities cross into the VM, as files',cap:'The Worker doesn\'t hand over a key. It passes the <b>env.LOGS binding as a Cap\'n Web stub</b>: a handle it can revoke. Inside the computer, that handle shows up as a folder, <b>/cap/logs/</b>. rg just reads files, and every read() becomes a call back through the stub to R2. <b>No secret ever enters the VM.</b>',d(){
 box(30,140,250,240,null,{c:C.blue,fo:0.08});lab(155,170,'Dynamic Worker',{size:17,w:600});
 box(55,200,200,56,['env.LOGS (R2)'],{c:C.mut,size:15});
 box(55,290,200,56,['stub: a revocable handle'],{c:C.yel,size:14});
 box(560,110,370,330,null,{c:C.grn,fo:0.06});lab(745,140,'computer 7f2c',{size:17,w:600});
 box(590,170,310,60,['/cap/logs/2026-10-23.log'],{c:C.yel,size:15,mono:true});
 box(590,260,310,60,['rg  "ms=\\d+"  /cap/logs/'],{c:C.grn,size:15,mono:true});
 box(590,350,310,60,['kernel: read() → stub call'],{c:C.blue,size:15});
 arrow([255,318,555,200],{c:C.yel,label:'passed in as a stub',lx:390,ly:215,lc:C.yel});
 arrow([590,380,285,330],{c:C.grn,label:'read() → call → R2 → bytes',lx:430,ly:385,lc:C.grn});
 lab(745,470,'no key inside the VM · revoke the stub and access is gone',{size:13,c:C.mut});
 flow([590,380,285,330],{n:3,sp:110,c:C.grn});
 tag(30,470,'target','planned: Cap\'n Web bridge + /cap files');}},
{t:'Unix pipes become promise pipelines',cap:'<b>rg</b> and <b>sqlite3</b> each run in their own throwaway computer. The Worker sends the <b>whole pipeline as one message</b>: exec rg, pipe its output into sqlite3, return the result. Promise pipelining wires stdout to stdin on the host side, so the chain costs <b>one round trip</b>, not one per step.',d(){
 code(40,40,880,70,['box.exec("rg", …).pipe(box.exec("sqlite3", [":memory:", ".import /dev/stdin t", QUERY]))'],{size:14});
 box(40,170,200,120,['Dynamic Worker'],{c:C.blue,size:17});
 box(360,170,190,120,['unikernel #1','rg'],{c:C.grn,size:17});
 box(680,170,220,120,['unikernel #2','sqlite3'],{c:C.grn,size:17});
 arrow([550,230,675,230],{c:C.yel,label:'stdout → stdin',lx:612,ly:215,lc:C.yel});
 flow([550,230,675,230],{n:4,sp:140});
 arrow([240,210,355,210],{c:C.ink,label:'1 message out',lx:298,ly:196,lc:C.ink});
 arrow([680,270,620,330,300,330,240,270],{c:C.grn,label:'1 message back: the answer',lx:460,ly:352,lc:C.grn});
 flow([240,210,355,210],{n:1,sp:80,c:C.ink});flow([680,270,620,330,300,330,240,270],{n:2,sp:150,c:C.grn});
 box(150,410,300,80,['without pipelining','2 round trips + data shipped twice'],{c:C.mut,size:14,fo:0.06});
 box(510,410,300,80,['with pipelining','1 round trip, data stays server-side'],{c:C.yel,size:14,fo:0.1});}},
{t:'A kernel written for this task',cap:'Then the model asks for a tool our kernel has <b>never run</b>. It hits a few missing syscalls. <b>An agent writes the handlers</b>, each one is checked against real Linux, and the tool runs. That takes minutes the first time, and is shown recorded and labelled. After that the new kernel profile is cached, and the next run boots in milliseconds.',d(){
 box(40,90,200,80,['new tool','never run before'],{c:C.mut,size:16});
 arrow([240,130,300,130]);
 box(305,90,200,80,['3 missing syscalls','ENOSYS + record'],{c:C.red,size:16});
 arrow([505,130,565,130]);
 box(570,90,170,80,['agent writes','3 handlers'],{c:C.pur,size:16});
 arrow([740,130,790,130]);
 box(795,90,140,80,['90/90','= Linux'],{c:C.grn,size:18});
 flow([240,130,300,130,505,130,565,130,740,130,790,130],{n:4,sp:200});
 box(80,260,360,140,['first time','minutes, recorded on screen','one-off, then cached'],{c:C.pur,size:16,fo:0.08});
 box(520,260,360,140,['every time after','boots in ms','profile pinned by hash'],{c:C.grn,size:16,fo:0.08});
 tag(80,460,'built','built: the grow loop, 90/90 Linux checks');tag(520,460,'target','planned: growing live, for any new tool');}},
{t:'How long until the code runs?',cap:'Start-up latency on a <b>log scale</b>, where each gridline is 10× the one before. The numbers for jitk and Hyperlight are from our quiet macOS benchmark. Both use QuickJS, but different builds: Bellard\'s for jitk, quickjs-ng for Hyperlight. The container figure is reported, not ours. The hollow marker is the snapshot target. Today\'s jitk is already <b>hundreds to thousands of times faster</b> than a cold container; snapshots aim to remove the cold start entirely. <i>Hover a point for details.</i>',d(){
 const x0=345,x1=915,lo=-1,hi=4,X=v=>x0+(Math.log10(v)-lo)/(hi-lo)*(x1-x0);
 const ax=item();[0.1,1,10,100,1000,10000].forEach(v=>{mk('line',{x1:X(v),x2:X(v),y1:90,y2:440,stroke:'#232836','stroke-width':1},ax);txt(X(v),468,v<1?v+' ms':v<1000?v+' ms':(v/1000)+' s',{size:13,c:C.mut},ax)});
 txt(535,500,'time from request to running code (log scale)',{size:13,c:C.mut},ax);
 const R=[['jitk · pre-booted VM, one tool call',0.285,C.blue,'measured, p50, n=30, quiet macOS'],['Hyperlight · pre-started, one tool call',0.647,C.mut,'measured, same harness, p50, n=30'],['jitk · snapshot restore (target)',1,C.org,'target: not built yet'],['jitk · cold start, one tool call',6.05,C.blue,'measured, p50, n=30'],['jitk · cold execute() via executor',9.2,C.blue,'measured, p50, n=30, after the native-watchdog fix'],['Cloudflare container · cold start',[1000,3000],C.mut,'reported range, ~1–3 s; not our measurement']];
 R.forEach(([n,v,c,why],i)=>{const y=110+i*58,g=item();txt(x0-12,y+5,n,{size:13,anchor:'end',c:C.ink},g);mk('line',{x1:x0,x2:x1,y1:y,y2:y,stroke:'#1b1f2a','stroke-width':1},g);
  const t=mk('title',{},g);t.textContent=n+': '+(Array.isArray(v)?v.map(a=>a/1000+' s').join('–'):v+' ms')+' ('+why+')';
  if(Array.isArray(v)){mk('rect',{x:X(v[0]),y:y-6,width:X(v[1])-X(v[0]),height:12,rx:6,fill:c,'fill-opacity':0.55},g);txt(X(v[1])+4,y-12,'1–3 s',{size:12,c:C.mut,anchor:'end'},g)}
  else{mk('circle',{cx:X(v),cy:y,r:7,fill:c===C.org?'none':c,stroke:c,'stroke-width':c===C.org?2.5:0},g);txt(X(v)+12,y+5,v+' ms',{size:12,c:C.mut,anchor:'start'},g)}
  mk('rect',{x:20,y:y-24,width:x1-20,height:48,fill:'transparent'},g)});}},
{t:'What didn\'t exist before',cap:'Each option today gives up something. <b>Isolates</b> are cheap but JavaScript-only. <b>Containers and VMs</b> run real programs behind a hardware wall, but they\'re heavy. <b>Hyperlight</b> is cheap and hardware-isolated, but can\'t run Linux binaries. Sofort aims for <b>all three at once</b>, and adds new primitives: capabilities as files, pipes as promise pipelines, and kernels grown per task. <i>The cost corner is a target until snapshots land.</i>',d(){
 const g=item();[[300,215,C.blue],[480,215,C.red],[390,365,C.grn]].forEach(([x,y,c])=>mk('circle',{cx:x,cy:y,r:140,fill:c,'fill-opacity':0.09,stroke:c,'stroke-width':2},g));
 lab(150,80,'hardware isolation',{size:15,c:C.blue,w:600});lab(640,80,'real Linux binaries',{size:15,c:C.red,w:600});lab(390,525,'isolate-like cost',{size:15,c:C.grn,w:600});
 lab(390,190,'containers · VMs',{size:13,c:C.ink});lab(285,330,['Hyperlight'],{size:13});lab(400,450,'V8 isolates',{size:13});
 box(330,252,120,58,['Sofort'],{c:C.yel,size:18,fo:0.25,sw:3,solid:1});
 lab(680,250,'new primitives',{size:15,c:C.yel,w:600,anchor:'start'});
 lab(680,282,['• capabilities as files','• pipes as promise pipelines','• kernels grown per task','• a computer per call, via MCP'],{size:14,anchor:'start',lh:26});
 lab(480,36,'“Unikernels just fell.”',{size:24,w:600,c:C.yel});}}
];

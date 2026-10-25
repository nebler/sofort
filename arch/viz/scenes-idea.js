const SC=[
{t:'Agents write code. Where does it run?',cap:'In <b>code mode</b> the model doesn\'t call tools one at a time. It writes a small program that calls them. That program is untrusted, so it needs somewhere to run that is <b>isolated, fast to start, and cheap enough to use for every single task</b>.',d(){
 box(30,205,170,90,['AI agent'],{c:C.pur,size:20});arrow([200,250,262,250]);
 code(265,140,355,220,['// written by the model','const issues =','  await github.listIssues();','const open = issues','  .filter(i => i.open);','return open.length;']);
 arrow([620,250,688,250]);box(692,180,230,140,['?'],{c:C.yel,size:60,fo:0.05,dash:'7 7'});lab(807,352,'isolated · fast · cheap',{c:C.mut,size:15});
 flow([200,250,262,250],{n:2,sp:60});flow([620,250,688,250],{n:2,sp:60});}},
{t:'Today: two choices, and a gap',cap:'A <b>V8 isolate</b> starts in milliseconds but runs only JavaScript, behind a software wall. A <b>Linux VM or container</b> runs anything behind a hardware wall, but costs 100 ms to seconds and lots of memory. The moment agent code needs a real tool, it jumps all the way to the heavy box.',d(){
 box(30,120,260,80,['V8 isolate'],{c:C.blue,size:21});
 lab(48,245,['✓ starts in ~ms','✓ tiny memory','✗ JavaScript only','✗ software wall'],{anchor:'start',size:16,lh:30});
 box(350,120,260,330,['the gap'],{c:C.yel,dash:'8 8',fo:0.04,size:24,tc:C.yel});
 lab(480,335,['real programs','+ hardware wall','+ isolate-like cost'],{c:C.yel,size:15,lh:22});
 box(670,120,260,80,['Linux VM / container'],{c:C.red,size:19});
 lab(688,245,['✓ any Linux program','✓ hardware wall','✗ 100 ms – seconds to start','✗ 100s of MB – GBs'],{anchor:'start',size:16,lh:30});
 arrow([160,112,160,72,800,72,800,112],{c:C.red,dash:'6 5',label:'today: needs a real tool → jump to the heavy box',lx:480,ly:60,lc:C.red});
 flow([160,112,160,72,800,72,800,112],{c:C.red,n:2,sp:220});}},
{t:'Why the Linux box is heavy',cap:'A Linux VM brings a whole general-purpose kernel: <b>hundreds of syscalls</b>, plus every driver, filesystem and network stack, tens of millions of lines in all. The programs agents run use a tiny slice of it. QuickJS and Lua together need <b>about two dozen</b> syscalls.',d(){
 const hi=new Set([3,17,30,44,58,61,79,95,102,117,130,141,158,166,183,190,207,215,229,240,256,263,279,288,301,318]);
 grid(40,95,24,14,20,6,hi);
 lab(700,150,'Linux kernel',{size:22,w:600,anchor:'start'});
 lab(700,190,['300+ syscalls','tens of millions of lines','every driver, filesystem,','network stack, scheduler…'],{anchor:'start',size:15,c:C.mut,lh:24});
 const g=item();mk('rect',{x:700,y:330,width:16,height:16,rx:3,fill:C.blue},g);txt(726,343,'used by QuickJS + Lua: ~26',{anchor:'start',size:15},g);
 const g2=item();mk('rect',{x:700,y:362,width:16,height:16,rx:3,fill:'#262b38'},g2);txt(726,375,'never touched',{anchor:'start',size:15,c:C.mut},g2);}},
{t:'Keep only what the program needs',cap:'So the kernel contains <b>only those syscalls</b>, about 1.6k lines of Rust. The program is an <b>unmodified Linux binary</b> and doesn\'t know it isn\'t on Linux. Anything not implemented returns ENOSYS. One program with a kernel made for it: a <b>binary-compatible unikernel</b>.',d(){
 const [g]=grid(40,170,14,10,13,4,new Set([3,17,30,44,58,61,79,95,102,117]));g.setAttribute('opacity','0.45');
 lab(158,155,'general kernel',{c:C.mut,size:14});
 arrow([290,265,395,265],{c:C.yel,sw:3});
 box(410,95,520,330,null,{c:C.blue,fo:0.08});
 lab(670,135,'jitk kernel',{size:24,w:600});
 lab(670,163,'~1.6k lines of Rust · no_std · aarch64',{size:14,c:C.mut});
 const g3=item();const names=['read','write','writev','openat','close','lseek','readv','mmap','munmap','mprotect','brk','exit','exit_group','clock_gettime','getrandom','ppoll','ioctl','set_tid_address','rt_sigaction','rt_sigprocmask','getdents64','newfstatat','fcntl','readlinkat','mremap','…'];
 names.forEach((n,i)=>{const c=i%5,r=Math.floor(i/5),x=432+c*98,y=188+r*38;mk('rect',{x,y,width:92,height:28,rx:6,fill:C.blue,'fill-opacity':0.22,stroke:C.blue,'stroke-width':1},g3);txt(x+46,y+18,n,{size:11,mono:true,c:'#cfeaf2'},g3)});
 tag(432,470,'built','built & tested: kernel + ~26 syscalls');}},
{t:'The layers of one jitk computer',cap:'There are two walls. A <b>hardware VM</b> surrounds everything. Inside it, the program runs in <b>user mode (EL0)</b> and can\'t touch our kernel in <b>kernel mode (EL1)</b>: page tables, write-xor-execute and checked copies keep it out. There\'s no network, no disk and no shell, and <b>exactly one door</b> leads out: the tool channel to the host.',d(){
 box(110,72,540,388,null,{c:C.mut,fo:0.03,dash:'6 6'});lab(380,96,'microVM · 32 MiB RAM · 1 vCPU · one console device',{size:13,c:C.mut});
 box(140,114,480,58,['/skills   /scripts   /types   — read-only files'],{c:C.yel,size:15,fo:0.1});
 box(140,190,480,82,['EL0 · unmodified static binary','QuickJS or Lua'],{c:C.grn,size:16});
 box(140,290,480,90,['EL1 · our kernel (Rust)','syscalls · page tables · W^X · checked user copies'],{c:C.blue,size:16});
 box(110,474,540,50,['hardware virtualization — KVM (Linux) · HVF (macOS)'],{c:C.mut,size:15,fo:0.08});
 box(730,250,190,110,['host executor','policy · tools'],{c:C.pur,size:17});
 arrow([620,335,725,300],{c:C.yel,label:'the only door',lx:668,ly:300,lc:C.yel});
 flow([620,335,725,300],{n:3,sp:70});flow([725,314,620,349],{n:2,sp:70,c:C.grn});}},
{t:'The kernel grows itself',cap:'When a program needs a syscall we don\'t have, the kernel logs it. Real Linux, run under strace, shows what should happen. <b>An agent writes that one handler</b>, 5–30 lines, and it only ships if the program behaves <b>identically on jitk and on Linux</b>. This all happens offline, never while a request waits.',d(){
 const cx=480,cy=285,R=180,N=[['missing syscall','→ ENOSYS + record',C.red],['Linux oracle','strace: what should happen?',C.mut],['agent writes handler','one file, 5–30 lines',C.pur],['differential test','jitk vs Linux must match',C.grn],['versioned manifest','hash-pinned · reviewable',C.blue]];
 const P=N.map((_,i)=>{const a=(-90+i*72)*Math.PI/180;return [cx+R*1.45*Math.cos(a),cy+R*Math.sin(a)]});
 const ring=[];for(let i=0;i<=72;i++){const a=(-90+i*5)*Math.PI/180;ring.push(cx+R*1.45*Math.cos(a),cy+R*Math.sin(a))}
 const g=item();mk('polyline',{points:ring.join(' '),fill:'none',stroke:'#2c3240','stroke-width':2},g);
 flow(ring,{n:5,sp:160,c:C.yel});
 N.forEach(([a,b,c],i)=>box(P[i][0]-110,P[i][1]-34,220,68,[a,b],{c,size:14,solid:1,fo:0.14}));
 lab(cx,cy-8,'offline',{size:22,w:600,c:C.yel});lab(cx,cy+18,'never while a request waits',{size:14,c:C.mut});
 tag(cx-145,cy+60,'built','built: the demo regrows a deleted syscall, 90/90');}},
{t:'Built just in time, for each task',cap:'A task arrives with a <b>grant</b>: the tools and files it may use. The grant becomes a <b>recipe</b> (kernel profile, binary, files), identified by a hash. If we\'ve built that recipe before, its image is cached; if not, we pack it. Then a fresh VM boots: 6 ms cold today, 0.29 ms from a pre-booted pool, and <b>snapshots should bring it to ≤ 1 ms</b>.',d(){
 const B=[['“summarise my','open issues”',C.mut],['grant','tools + files',C.yel],['recipe','kernel profile','+ binary + files',C.blue],['content hash','a3f9…',C.mut],['cached image','or pack it',C.pur],['boot','fresh VM',C.grn]];
 flow([88,197,940,197],{n:4,sp:170});
 B.forEach((a,i)=>{const c=a.pop(),x=18+i*155;box(x,150,138,95,a,{c,size:14,solid:1,fo:0.14});if(i<5)arrow([x+138,197,x+153,197])});
 lab(480,290,'the grant',{size:13,c:C.yel});
 code(130,302,700,62,['{ tools: { github: ["listIssues"] },  files: ["/skills/summarise.md"] }'],{size:14});
 tag(120,430,'measured','today: 6 ms cold · 0.29 ms pre-booted (quiet macOS)');
 tag(560,430,'target','with snapshots: ≤ 1 ms · ≤ 2 MiB per VM');}},
{t:'The only door: tool calls',cap:'Inside the VM, the program simply calls <b>github.listIssues()</b>. That becomes one small message on the channel. The host checks it against the grant, calls the real API <b>with credentials that never enter the VM</b>, and sends back the result. A call outside the grant is refused at the door.',d(){
 box(30,100,410,350,null,{c:C.grn,fo:0.05});lab(235,128,'inside the VM',{size:14,c:C.mut});
 code(55,150,360,100,['await github.listIssues()  ✓','await github.deleteRepo() ✗'],{size:14});
 code(55,280,360,130,['{"t":"call","id":1,','"ns":"github",','"fn":"listIssues","args":[]}'],{size:13,tc:C.yel});
 box(520,170,180,210,['policy','grant check','limits · audit'],{c:C.pur,size:15});
 box(780,200,150,90,['GitHub API'],{c:C.mut,size:16});lab(855,322,'credentials live here',{size:13,c:C.yel});
 arrow([440,190,515,235],{c:C.grn});arrow([700,250,775,245],{c:C.grn});
 arrow([440,240,515,330],{c:C.red,label:'denied: not in grant',lx:610,ly:408,lc:C.red});
 flow([440,190,515,235,700,250,775,245],{n:3,sp:150,c:C.grn});}},
{t:'Everything is a file',cap:'Skills, scripts and types are packed into the computer as plain files that any program can read. The next step is paths like <b>/mcp/github/issues/42</b>, where the kernel turns <b>open()</b> and <b>read()</b> into tool calls through the same policy. Unmodified tools like <b>cat</b> or <b>jq</b> can then read live data.',d(){
 box(30,95,480,380,null,{c:C.grn,fo:0.05});
 code(55,120,430,92,['open("/skills/summarise.md")','open("/mcp/github/issues/42")'],{size:14});
 box(55,240,430,70,['our kernel: which path?'],{c:C.blue,size:15});
 box(55,345,200,100,['packed file','served inside the VM'],{c:C.yel,size:14});
 box(285,345,200,100,['/mcp/… path','→ tool call'],{c:C.org,size:14});
 arrow([155,310,155,340]);arrow([385,310,385,340]);
 box(640,300,180,100,['policy','github.getIssue(42)'],{c:C.pur,size:14});
 arrow([485,395,635,360],{c:C.org});arrow([635,328,485,265],{c:C.grn,label:'bytes → read()',lx:560,ly:262,lc:C.grn});
 tag(600,150,'built','built: packed read-only files, same as Linux');tag(600,192,'target','next: files backed by tool calls');
 flow([485,395,635,360],{n:2,sp:90,c:C.org});flow([635,328,485,265],{n:2,sp:90,c:C.grn});}},
{t:'The missing middle tier',cap:'Isolates are cheap but JavaScript-only. Full VMs run anything but are heavy. jitk fills the middle: <b>hardware isolation and real Linux binaries at isolate-like cost</b>, in a computer assembled for each task. The cost cells for jitk are targets until snapshots land.',d(){
 const cols=[['V8 isolate',C.blue,400],['jitk computer',C.yel,610],['full Linux VM',C.red,820]];
 cols.forEach(([n,c,x])=>box(x-95,70,190,56,[n],{c,size:17,fo:c===C.yel?0.2:0.1,sw:c===C.yel?3:2}));
 const rows=[['hardware wall',['✗','✓','✓']],['real Linux binaries',['✗','✓','✓']],['starts in ~1 ms',['✓','target','✗']],['MBs, not GBs',['✓','target','✗']],['built per task',['✗','✓','✗']]];
 const gl=item();rows.forEach((_,i)=>mk('line',{x1:60,x2:915,y1:160+i*62+40,y2:160+i*62+40,stroke:'#232836','stroke-width':1},gl));
 rows.forEach(([r,v],i)=>{const y=168+i*62;lab(70,y+8,r,{size:16,c:C.ink,anchor:'start'});v.forEach((s,j)=>lab(cols[j][2],y+8,s,{size:s.length>1?15:22,c:s==='✓'?C.grn:s==='✗'?C.red:C.org,w:600}))});
 lab(480,505,'a fresh, purpose-built computer for every task',{size:21,w:600,c:C.yel});}}
];

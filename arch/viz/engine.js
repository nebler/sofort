// Shared scene engine for the jitk explainers. Scenes are SVG groups whose children fade in
// one after another; flow() dots travel along polylines to show data moving.
const NS='http://www.w3.org/2000/svg';
const C={ink:'#ece9e4',mut:'#8b90a0',dim:'#3a4050',blue:'#58c4dd',yel:'#f9d65c',grn:'#83c167',red:'#fc6255',pur:'#b189d6',org:'#f0a35e'};
const SANS='var(--font-sans, system-ui, -apple-system, sans-serif)',MONO='var(--font-mono, ui-monospace, Menlo, monospace)';
let G,FL;
function mk(t,a,p){const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);(p||G).appendChild(e);return e}
function item(){return mk('g',{class:'el'})}
function txt(x,y,s,o={},p){const L=Array.isArray(s)?s:[s],sz=o.size||16,lh=o.lh||sz*1.32;const t=mk('text',{x,y,fill:o.c||C.ink,'font-size':sz,'text-anchor':o.anchor||'middle','font-weight':o.w||400,style:'font-family:'+(o.mono?MONO:SANS)},p);L.forEach((l,i)=>{const ts=mk('tspan',{x,dy:i?lh:0},t);ts.textContent=l});return t}
function box(x,y,w,h,lines,o={}){const g=item(),c=o.c||C.blue;if(o.solid)mk('rect',{x,y,width:w,height:h,rx:o.rx??10,fill:'#0f1117'},g);mk('rect',{x,y,width:w,height:h,rx:o.rx??10,fill:c,'fill-opacity':o.fo??0.12,stroke:c,'stroke-width':o.sw||2,'stroke-dasharray':o.dash||''},g);if(lines){const L=Array.isArray(lines)?lines:[lines],sz=o.size||16,lh=sz*1.32;txt(x+w/2,y+h/2-(L.length-1)*lh/2+sz*0.35,L,{c:o.tc||C.ink,size:sz,w:o.w||500,mono:o.mono,lh},g)}return g}
function arrow(pts,o={}){const g=item(),c=o.c||C.mut,k=Object.keys(C).find(k=>C[k]===c)||'mut';mk('polyline',{points:pts.join(' '),fill:'none',stroke:c,'stroke-width':o.sw||2,'stroke-dasharray':o.dash||'','marker-end':'url(#ah-'+k+')','stroke-linejoin':'round'},g);if(o.label)txt(o.lx,o.ly,o.label,{c:o.lc||C.mut,size:o.ls||13},g);return g}
function lab(x,y,s,o={}){const g=item();txt(x,y,s,o,g);return g}
function tag(x,y,kind,s){const g=item(),c={measured:C.grn,built:C.blue,target:C.org,reported:C.mut}[kind];const w=s.length*6.4+22;mk('rect',{x,y:y-14,width:w,height:20,rx:10,fill:c,'fill-opacity':0.16,stroke:c,'stroke-width':1.2},g);txt(x+w/2,y,s,{c,size:12,w:600},g);return g}
function flow(pts,o={}){const p=mk('polyline',{points:pts.join(' '),fill:'none',stroke:'none'});const g=item(),n=o.n||3,d=[];for(let i=0;i<n;i++)d.push(mk('circle',{r:o.r||4.5,fill:o.c||C.yel},g));FL.push({p,d,sp:o.sp||120,len:0})}
function code(x,y,w,h,lines,o={}){const g=box(x,y,w,h,null,{c:o.c||C.dim,fo:0.35});txt(x+16,y+28,lines,{anchor:'start',mono:true,size:o.size||14,c:o.tc||'#d6e2ea',lh:(o.size||14)*1.55},g);return g}
function grid(x0,y0,cols,rows,cs,gap,hi){const g=item(),h=item();let k=0;for(let r=0;r<rows;r++)for(let c=0;c<cols;c++,k++){const on=hi.has(k);mk('rect',{x:x0+c*(cs+gap),y:y0+r*(cs+gap),width:cs,height:cs,rx:3,fill:on?C.blue:'#262b38'},on?h:g)}return [g,h]}
function markers(svg){const d=mk('defs',{},svg);for(const [k,v] of Object.entries(C)){const m=mk('marker',{id:'ah-'+k,viewBox:'0 0 10 10',refX:'9',refY:'5',markerWidth:'7',markerHeight:'7',orient:'auto-start-reverse'},d);mk('path',{d:'M0,0 L10,5 L0,10 z',fill:v},m)}}
function run(SC){
  const sv=document.getElementById('sv');markers(sv);
  if(document.body.dataset.debug){ // layout check: every scene drawn statically, stacked
    document.querySelector('.stage').style.display='none';const host=document.getElementById('dbg');
    const [lo,hi]=(location.hash.slice(1)||'0-99').split('-').map(Number);SC.forEach((s,i)=>{if(i<lo||i>hi)return;const d=document.createElement('div');d.className='stage';d.style.marginBottom='10px';d.innerHTML='<div class="hd"><b>'+(i+1)+'. '+s.t+'</b></div>';const v=document.createElementNS(NS,'svg');v.setAttribute('viewBox','0 0 960 540');d.appendChild(v);host.appendChild(d);markers(v);G=mk('g',{class:'scene on'},v);FL=[];s.d();G.querySelectorAll('.el').forEach(e=>e.style.transition='none')});return}
  const scenes=SC.map(s=>{G=mk('g',{class:'scene'},sv);FL=[];s.d();return {g:G,fl:FL,s}});
  let cur=-1,play=null;const dots=document.getElementById('dots');
  scenes.forEach((_,i)=>{const b=document.createElement('button');b.className='dot';b.setAttribute('aria-label','scene '+(i+1));b.onclick=()=>show(i);dots.appendChild(b)});
  function show(i){i=Math.max(0,Math.min(scenes.length-1,i));if(i===cur)return;if(cur>=0){const o=scenes[cur].g;o.classList.remove('on');o.querySelectorAll('.el').forEach(e=>e.style.transitionDelay='0s')}cur=i;const g=scenes[i].g;[...g.querySelectorAll(':scope > .el')].forEach((e,k)=>e.style.transitionDelay=(0.15+k*0.11)+'s');requestAnimationFrame(()=>requestAnimationFrame(()=>g.classList.add('on')));document.getElementById('ttl').textContent=scenes[i].s.t;document.getElementById('cnt').textContent=(i+1)+' / '+scenes.length;document.getElementById('cap').innerHTML=scenes[i].s.cap;[...dots.children].forEach((d,k)=>d.classList.toggle('on',k===i))}
  document.getElementById('nx').onclick=()=>show(cur+1);document.getElementById('pv').onclick=()=>show(cur-1);
  const pl=document.getElementById('pl');pl.onclick=()=>{if(play){clearInterval(play);play=null;pl.textContent='▶ Play'}else{play=setInterval(()=>{if(cur>=scenes.length-1){clearInterval(play);play=null;pl.textContent='▶ Play';return}show(cur+1)},8500);pl.textContent='❚❚ Pause'}};
  document.addEventListener('keydown',e=>{if(e.key==='ArrowRight')show(cur+1);if(e.key==='ArrowLeft')show(cur-1)});
  function tick(t){if(cur>=0)for(const f of scenes[cur].fl){if(!f.len)f.len=f.p.getTotalLength();f.d.forEach((c,i)=>{const d=((t*f.sp/1000)+i*f.len/f.d.length)%f.len,p=f.p.getPointAtLength(d);c.setAttribute('cx',p.x);c.setAttribute('cy',p.y)})}requestAnimationFrame(tick)}
  requestAnimationFrame(tick);show(0);
}

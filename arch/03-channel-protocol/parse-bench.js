import * as std from 'std';
import * as os from 'os';
for (const n of [1024,102400,1048400]) {
  const s=JSON.stringify({t:'call',id:1,ns:'api',fn:'echo',args:'x'.repeat(n)});
  const count=n<2000?10000:1000;
  let v;
  const t=os.now();
  for(let i=0;i<count;i++) v=JSON.parse(s);
  const ms=os.now()-t;
  std.out.puts(JSON.stringify({bytes:s.length,iterations:count,us_per_parse:ms*1000/count})+'\n');
}

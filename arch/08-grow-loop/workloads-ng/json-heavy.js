const items = Array.from({length:12000}, (_,i)=>({id:i,path:`repo/file-${i}`,tags:['fix','api'],n:i%71}));
const copy = JSON.parse(JSON.stringify(items));
const groups = new Map();
for (const v of copy) groups.set(v.n,(groups.get(v.n)||0)+1);
print(JSON.stringify({count:copy.length,groups:groups.size,sum:copy.reduce((s,v)=>s+v.id,0)}));

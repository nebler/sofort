let last=Date.now(), ok=true, sum=0;
for(let i=0;i<100000;i++) { const n=Date.now(), r=Math.random(); ok=ok&&n>=last&&r>=0&&r<1;last=n;sum+=r; }
print(JSON.stringify({ok,randomMeanInRange:sum/100000>0.45&&sum/100000<0.55,iso:new Date(0).toISOString()}));

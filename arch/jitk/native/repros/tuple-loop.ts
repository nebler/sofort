for(const [name,code,providers,expected] of [
 ['a','return null',[],null],
 ['b','return 1',[{name:'api',fns:{f:async()=>undefined}}],null],
 ['c','return []',[{name:'api',fns:{f:async(...a:unknown[])=>a}}],[1,'two',{three:3}]]
] as const)console.log(name,code,providers,expected);

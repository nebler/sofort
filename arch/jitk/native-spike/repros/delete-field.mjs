function normalize(params) { delete params.message; return params; }
console.log(JSON.stringify(normalize({offset:true})));

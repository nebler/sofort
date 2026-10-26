import jsonPatch from 'fast-json-patch';
console.log(JSON.stringify(jsonPatch.compare({n:1},{n:2})));

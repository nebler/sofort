// Narrow alternative for MCP execute's public argument shape, not a generic
// JSON Schema implementation and not a replacement for host policy validation.
function validateExecute(input:unknown):string {
  if(!input || typeof input!=='object' || Array.isArray(input))throw Error('object required');
  const record=input as Record<string,unknown>;
  if(Object.keys(record).length!==1 || typeof record.code!=='string')throw Error('only code:string accepted');
  return record.code;
}
console.log(validateExecute(JSON.parse('{"code":"return 2"}')));
let rejected=false;
try {validateExecute(JSON.parse('{"code":2}'));}catch{rejected=true;}
if(!rejected)throw Error('invalid input accepted');
console.log('PASS narrow handwritten validator');

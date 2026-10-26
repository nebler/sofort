type Json=null|boolean|number|string|Json[]|{[key:string]:Json};
type Frame={[key:string]:Json};
function object(v:unknown):v is Frame{return !!v&&typeof v==='object'&&!Array.isArray(v);}
function inspect(m:Frame):void {if(!object(m.ns))throw Error('object');console.log(Object.entries(m.ns));}
inspect(JSON.parse('{"ns":{"api":[]}}'));

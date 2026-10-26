import {Readable, Writable} from 'node:stream';
let text = '';
const sink = new Writable({write(chunk, encoding, callback) { text += chunk.toString(); callback(); }});
sink.on('finish',()=>{ if(text!=='ab') throw Error(text); console.log('PASS streams'); });
Readable.from(['a','b']).pipe(sink);

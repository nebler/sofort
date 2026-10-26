import {mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
// Emitted entrypoints live in executor/build. Historical receipts stay read-only
// unless an operator explicitly opts into recording.
export function receiptPath(name:string):string {
  const directory=new URL(process.env.JITK_RECORD==='1'?'../':'../.work/',import.meta.url);
  mkdirSync(directory,{recursive:true});
  return fileURLToPath(new URL(name,directory));
}

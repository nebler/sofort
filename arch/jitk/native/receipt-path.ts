import {resolve} from 'node:path';
export function receiptPath(name:string):string{return resolve(process.env.JITK_RECEIPT_DIR||'.work',name);}

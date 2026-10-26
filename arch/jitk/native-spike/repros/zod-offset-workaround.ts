import {z} from 'zod/v4';
const options:{offset:boolean;message?:string} = {offset:true};
console.log(z.iso.datetime(options).parse('2026-10-26T00:00:00Z'));

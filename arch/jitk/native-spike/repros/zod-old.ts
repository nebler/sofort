import {z} from 'zod-4-4';
console.log(JSON.stringify(z.object({code:z.string()}).parse({code:'return 2'})));

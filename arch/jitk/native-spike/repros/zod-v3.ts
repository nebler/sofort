import {z} from 'zod/v3';
console.log(JSON.stringify(z.object({code:z.string()}).parse({code:'return 2'})));

import {z} from 'zod';
console.log(JSON.stringify(z.toJSONSchema(z.object({code:z.string()}))));

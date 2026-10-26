import {z} from 'zod';
const schema = z.object({code:z.string()});
console.log(JSON.stringify(schema.parse({code:'return 2'})));
console.log(schema.safeParse({code:2}).success);

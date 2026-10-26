import * as z from 'zod/mini';
console.log(JSON.stringify(z.object({code:z.string()}).parse({code:'return 2'})));

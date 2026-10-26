import {z} from 'zod/v4';
console.log(z.string().catch('fallback').parse(2));

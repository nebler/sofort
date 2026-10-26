import {z} from 'zod/v4';
console.log(z.iso.datetime({offset:true}).parse('2026-10-26T00:00:00Z'));

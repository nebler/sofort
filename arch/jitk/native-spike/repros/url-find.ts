import {existsSync} from 'node:fs';
const found = ['./url-find.ts'].map(p=>new URL(p,import.meta.url)).find(u=>existsSync(u));
console.log(found?.pathname);

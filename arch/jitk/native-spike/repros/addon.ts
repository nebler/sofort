import {createRequire} from 'node:module';
console.log(createRequire(import.meta.url)('./bridge.node'));

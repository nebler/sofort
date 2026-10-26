import {transform} from 'sucrase';
console.log(transform('const n: number = 2;', {transforms:['typescript']}).code);

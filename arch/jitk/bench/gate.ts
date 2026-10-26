import { gate } from './controller.ts';
import { check } from './lib.ts';
const values = process.argv.slice(2).map(Number);
check(values.length <= 3 && values.every(Number.isFinite), 'usage: gate [threshold [budget [poll]]]');
console.log(JSON.stringify(gate(values[0] ?? 6, values[1] ?? 10, values[2] ?? 1)));

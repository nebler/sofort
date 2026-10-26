import { resolve } from 'node:path';
import { analyze } from './analysis.ts';
analyze(process.argv[2] || resolve(import.meta.dirname, 'results'));

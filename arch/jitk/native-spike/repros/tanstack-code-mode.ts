import {stripTypeScript} from '@tanstack/ai-code-mode';
console.log(await stripTypeScript('const n: number = 2; return n;'));

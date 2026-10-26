import { start, wait } from './native.ts';
const child = start(['/bin/sleep', '30']);
console.log(JSON.stringify({ pid: child.pid }));
wait(child.pid);

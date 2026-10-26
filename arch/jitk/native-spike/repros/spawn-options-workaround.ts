import {spawn} from 'node:child_process';
const cwd = process.cwd();
const child=spawn('/usr/bin/env',['-i','PATH=/usr/bin:/bin','/bin/echo','hello'],{stdio:['pipe','pipe','pipe'],cwd});
child.stdout!.on('data',chunk=>process.stdout.write(chunk.toString()));

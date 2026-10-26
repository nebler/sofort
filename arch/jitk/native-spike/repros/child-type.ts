import type {ChildProcessWithoutNullStreams} from 'node:child_process';
export const identity = (child:ChildProcessWithoutNullStreams) => child;

declare function nativeIgnoreHup(): number;
declare function nativeUsage(children: number, system: number): number;
declare function nativeClockTicks(): number;
declare function nativeKvmProbe(): number;
export function ignoreHup(): void {
  if (nativeIgnoreHup() !== 0) {
    throw new Error("could not ignore SIGHUP");
  }
}
export function usage(children: boolean): number {
  return nativeUsage(children ? 1 : 0, 0) + nativeUsage(children ? 1 : 0, 1);
}
export function clockTicks(): number {
  return nativeClockTicks();
}
export function kvmProbe(): number {
  return nativeKvmProbe();
}

declare function nativeStdoutWritable(): number;
export function stdoutWritable(): boolean {
  return nativeStdoutWritable() !== 0;
}

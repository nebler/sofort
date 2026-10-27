// Grow's probe observer intentionally discards blank lines. Corpus stdout must
// retain them, including the distinction between an empty line and an empty
// stream. Protocol validation/exit/fd2 decoding still uses the trusted observer.
export function guestStdout(raw: Buffer): Buffer {
  const lines = raw.toString('latin1').split('\n');
  const output: Buffer[] = [];
  let done = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const complete = i < lines.length - 1;
    if (i === 0 && /^hello jitk fdt=[0-9a-f]{16}$/.test(line)) continue;
    const marker = line.indexOf('\x1e');
    if (marker >= 0) {
      output.push(Buffer.from(line.slice(0, marker), 'latin1'));
      if (line.slice(marker + 1).includes('"kind":"done"')) done = true;
      continue;
    }
    if (done && /^exit=[0-9a-f]{16}$/.test(line)) continue;
    output.push(Buffer.from(line + (complete ? '\n' : ''), 'latin1'));
  }
  return Buffer.concat(output);
}

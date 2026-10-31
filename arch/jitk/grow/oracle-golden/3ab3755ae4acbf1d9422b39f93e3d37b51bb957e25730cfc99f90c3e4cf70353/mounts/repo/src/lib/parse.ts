export interface Row {
  name: string;
  value: number;
}

export function parse(line: string): Row | null {
  const [name, raw] = line.split(',');
  const value = Number(raw);
  if (!name || Number.isNaN(value)) return null;
  return { name: name.trim(), value };
}

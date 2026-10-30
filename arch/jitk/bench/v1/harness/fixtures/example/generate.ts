// Regenerates responses.jsonl and expected.json (seeded; committed outputs).
//   $JITK_NODE bench/v1/harness/fixtures/example/generate.ts
import { writeFileSync } from 'node:fs';
let seed = 7;
const rand = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 2 ** 32; };
const customers = ['acme', 'globex', 'initech', 'umbrella', 'hooli', 'stark'];
const statuses = ['shipped', 'pending', 'cancelled'];
const orders = Array.from({ length: 60 }, (_, i) => ({
  id: `o-${1000 + i}`, customer: customers[Math.floor(rand() * customers.length)]!, status: statuses[Math.floor(rand() * 2.4)]!,
  placed: new Date(Date.UTC(2026, 8, 1 + i)).toISOString(),
}));
const lines: string[] = [];
const record = (tool: string, arg: unknown, response: unknown, latencyMs: number) =>
  lines.push(JSON.stringify({ namespace: 'codemode', tool, args: [arg], response, latencyMs, bytes: Buffer.byteLength(JSON.stringify(response)) }));
const pageSize = 20;
for (let page = 1; page <= 3; page++)
  record('listOrders', { page }, { orders: orders.slice((page - 1) * pageSize, page * pageSize), next: page < 3 ? page + 1 : null }, Math.round((8 + rand() * 12) * 10) / 10);
const revenue: Record<string, number> = {};
for (const o of orders) {
  const items = Array.from({ length: 1 + Math.floor(rand() * 5) }, (_, j) => ({
    sku: `sku-${Math.floor(rand() * 500)}`, qty: 1 + Math.floor(rand() * 4), priceCents: 100 + Math.floor(rand() * 9900),
    note: 'x'.repeat(Math.floor(rand() * 200)), line: j,
  }));
  record('getOrder', { id: o.id }, { ...o, items }, Math.round((2 + rand() * 10) * 10) / 10);
  if (o.status === 'shipped') revenue[o.customer] = (revenue[o.customer] ?? 0) + items.reduce((s, it) => s + it.qty * it.priceCents, 0);
}
const top = Object.entries(revenue).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([customer, cents]) => ({ customer, cents }));
const dir = new URL('./', import.meta.url);
writeFileSync(new URL('responses.jsonl', dir), lines.join('\n') + '\n');
writeFileSync(new URL('expected.json', dir), JSON.stringify(top, null, 1) + '\n');
console.log(lines.length, 'recorded calls; top', JSON.stringify(top));

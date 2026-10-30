// Mock Google Drive and Salesforce REST over the T3 fixture. Reply shapes
// follow the real APIs: Drive v3 files.list ({files: [...]}) and a text export;
// Salesforce v62.0 query ({totalSize, done, records: [{attributes, ...}]}),
// sObject create/update ({id, success, errors}) and errors as
// [{message, errorCode}]. Queries go through a small SOQL subset: SELECT
// fields FROM object [WHERE a op b (AND|OR ...)] [ORDER BY f [ASC|DESC]]
// [LIMIT n], with =, !=, <, >, <=, >=, IN (...), LIKE, string/number/boolean/
// date literals and parentheses.
import { createHash } from 'node:crypto';
import type { Fixture, SfRecord } from './fixture.ts';
import { sfId } from './fixture.ts';

const API = '/services/data/v62.0/sobjects/';
type Args = Record<string, any>;

class SfError extends Error {
  constructor(code: string, message: string) {
    super(JSON.stringify([{ message, errorCode: code }]));
  }
}

// ---- SOQL subset ----
type Token = { kind: 'word' | 'string' | 'number' | 'op' | 'punct'; value: string };

function tokenize(q: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < q.length) {
    const c = q[i];
    if (/\s/.test(c)) {
      i++;
    } else if (c === "'") {
      let value = '';
      i++;
      while (i < q.length && q[i] !== "'") {
        if (q[i] === '\\') {
          const next = q[i + 1];
          value += next === 'n' ? '\n' : next === 't' ? '\t' : next;
          i += 2;
        } else {
          value += q[i++];
        }
      }
      if (q[i] !== "'") throw new SfError('MALFORMED_QUERY', 'unterminated string literal');
      i++;
      tokens.push({ kind: 'string', value });
    } else if (/[<>!=]/.test(c)) {
      const two = q.slice(i, i + 2);
      const op = ['<=', '>=', '!='].includes(two) ? two : c;
      tokens.push({ kind: 'op', value: op });
      i += op.length;
    } else if (/[(),]/.test(c)) {
      tokens.push({ kind: 'punct', value: c });
      i++;
    } else {
      const m = /^[A-Za-z0-9_.:\-+]+/.exec(q.slice(i));
      if (!m) throw new SfError('MALFORMED_QUERY', `unexpected character '${c}'`);
      const kind = /^-?\d+(\.\d+)?$/.test(m[0]) ? 'number' : 'word';
      tokens.push({ kind, value: m[0] });
      i += m[0].length;
    }
  }
  return tokens;
}

type Value = string | number | boolean | null;
type Cond = { op: 'and' | 'or'; left: Cond; right: Cond } | { field: string; cmp: string; value: Value | Value[] };

function literal(token: Token): Value {
  if (token.kind === 'string') return token.value;
  if (token.kind === 'number') return Number(token.value);
  const word = token.value.toLowerCase();
  if (word === 'true') return true;
  if (word === 'false') return false;
  if (word === 'null') return null;
  if (/^\d{4}-\d\d-\d\d$/.test(token.value)) return token.value; // date literal
  throw new SfError('MALFORMED_QUERY', `unexpected token '${token.value}'`);
}

function parse(q: string) {
  const t = tokenize(q);
  let p = 0;
  const peek = () => t[p];
  const word = (w: string) => peek()?.kind === 'word' && peek().value.toUpperCase() === w;
  const expect = (w: string) => {
    if (!word(w)) throw new SfError('MALFORMED_QUERY', `expected ${w} near '${peek()?.value ?? 'end'}'`);
    p++;
  };
  expect('SELECT');
  const fields: string[] = [];
  for (;;) {
    const f = t[p++];
    if (!f || f.kind !== 'word') throw new SfError('MALFORMED_QUERY', 'expected a field');
    fields.push(f.value);
    if (peek()?.value === ',') p++;
    else break;
  }
  expect('FROM');
  const object = t[p++]?.value;
  function primary(): Cond {
    if (peek()?.value === '(') {
      p++;
      const inner = or();
      if (t[p++]?.value !== ')') throw new SfError('MALFORMED_QUERY', 'expected )');
      return inner;
    }
    const field = t[p++].value;
    if (word('IN') || word('NOT')) {
      const negate = word('NOT');
      if (negate) p++;
      expect('IN');
      if (t[p++]?.value !== '(') throw new SfError('MALFORMED_QUERY', 'expected (');
      const values: Value[] = [];
      while (peek() && peek().value !== ')') {
        values.push(literal(t[p++]));
        if (peek()?.value === ',') p++;
      }
      p++;
      return { field, cmp: negate ? 'NOT IN' : 'IN', value: values };
    }
    if (word('LIKE')) {
      p++;
      return { field, cmp: 'LIKE', value: literal(t[p++]) };
    }
    const op = t[p++];
    if (!op || op.kind !== 'op') throw new SfError('MALFORMED_QUERY', `expected an operator after ${field}`);
    return { field, cmp: op.value, value: literal(t[p++]) };
  }
  function and(): Cond {
    let left = primary();
    while (word('AND')) {
      p++;
      left = { op: 'and', left, right: primary() };
    }
    return left;
  }
  function or(): Cond {
    let left = and();
    while (word('OR')) {
      p++;
      left = { op: 'or', left, right: and() };
    }
    return left;
  }
  let where: Cond | undefined;
  if (word('WHERE')) {
    p++;
    where = or();
  }
  let order: { field: string; desc: boolean } | undefined;
  if (word('ORDER')) {
    p++;
    expect('BY');
    const field = t[p++].value;
    let desc = false;
    if (word('ASC') || word('DESC')) desc = t[p++].value.toUpperCase() === 'DESC';
    order = { field, desc };
  }
  let limit: number | undefined;
  if (word('LIMIT')) {
    p++;
    limit = Number(t[p++].value);
  }
  if (p !== t.length) throw new SfError('MALFORMED_QUERY', `unexpected '${peek().value}'`);
  return { fields, object, where, order, limit };
}

function fieldOf(record: SfRecord, name: string): unknown {
  const key = Object.keys(record).find(k => k.toLowerCase() === name.toLowerCase());
  if (key === undefined) throw new SfError('INVALID_FIELD', `No such column '${name}'`);
  return record[key];
}

function matches(record: SfRecord, cond: Cond): boolean {
  if ('op' in cond) {
    return cond.op === 'and'
      ? matches(record, cond.left) && matches(record, cond.right)
      : matches(record, cond.left) || matches(record, cond.right);
  }
  const v = fieldOf(record, cond.field) as Value;
  const eq = (a: Value, b: Value) =>
    typeof a === 'string' && typeof b === 'string' ? a.toLowerCase() === b.toLowerCase() : a === b;
  switch (cond.cmp) {
    case '=':
      return eq(v, cond.value as Value);
    case '!=':
      return !eq(v, cond.value as Value);
    case 'IN':
      return (cond.value as Value[]).some(x => eq(v, x));
    case 'NOT IN':
      return !(cond.value as Value[]).some(x => eq(v, x));
    case 'LIKE': {
      const pattern = String(cond.value)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/%/g, '.*')
        .replace(/_/g, '.');
      return typeof v === 'string' && new RegExp('^' + pattern + '$', 'is').test(v);
    }
    default: {
      if (v === null) return false;
      const a = v as string | number;
      const b = cond.value as string | number;
      return cond.cmp === '<' ? a < b : cond.cmp === '>' ? a > b : cond.cmp === '<=' ? a <= b : a >= b;
    }
  }
}

// ---- tools ----
export function mockTools(fixture: Fixture) {
  const org = fixture.org as unknown as Record<string, SfRecord[]>;
  const prefixes: Record<string, string> = { Task: '00T', Meeting_Note__c: 'a0V', Event: '00U' };
  const shape = (object: string, record: SfRecord, fields: string[]) => {
    const out: Record<string, unknown> = { attributes: { type: object, url: API + object + '/' + record.Id } };
    for (const f of fields) {
      const key = Object.keys(record).find(k => k.toLowerCase() === f.toLowerCase())!;
      out[key] = record[key];
    }
    return out;
  };
  const table = (object: string) => {
    const rows = org[object];
    if (!rows) throw new SfError('INVALID_TYPE', `sObject type '${object}' is not supported.`);
    return rows;
  };
  return {
    drive: {
      async searchFiles(args: Args) {
        const terms = String(args.query ?? '')
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean);
        const files = fixture.files
          .filter(f => terms.every(term => f.name.toLowerCase().includes(term)))
          .sort((a, b) => (a.modifiedTime < b.modifiedTime ? 1 : -1))
          .slice(0, args.pageSize ?? 100)
          .map(({ content, ...meta }) => ({ ...meta, size: String(Buffer.byteLength(content)) }));
        return { kind: 'drive#fileList', incompleteSearch: false, files };
      },
      async getDocument(args: Args) {
        const file = fixture.files.find(f => f.id === args.fileId);
        if (!file)
          throw new Error(
            JSON.stringify({ error: { code: 404, message: `File not found: ${args.fileId}.`, status: 'NOT_FOUND' } }),
          );
        return {
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          modifiedTime: file.modifiedTime,
          content: file.content,
        };
      },
    },
    salesforce: {
      async query(args: Args) {
        const { fields, object, where, order, limit } = parse(String(args.q));
        let rows = table(object).filter(r => !where || matches(r, where));
        if (order) {
          rows = [...rows].sort((a, b) => {
            const x = fieldOf(a, order.field) as string;
            const y = fieldOf(b, order.field) as string;
            return (x < y ? -1 : x > y ? 1 : 0) * (order.desc ? -1 : 1);
          });
        }
        if (limit !== undefined) rows = rows.slice(0, limit);
        return { totalSize: rows.length, done: true, records: rows.map(r => shape(object, r, fields)) };
      },
      async getRecord(args: Args) {
        const record = table(args.sobject).find(r => r.Id === args.id);
        if (!record) throw new SfError('NOT_FOUND', 'The requested resource does not exist');
        const fields = args.fields ?? Object.keys(record);
        return shape(args.sobject, record, fields);
      },
      async createRecord(args: Args) {
        const object = String(args.sobject);
        if (!prefixes[object])
          throw new SfError('INVALID_TYPE', `Cannot create records of type '${object}' with this integration.`);
        const record = args.record ?? {};
        if (object === 'Meeting_Note__c' && String(record.Transcript__c ?? '').length > 131072) {
          throw new SfError('STRING_TOO_LONG', 'Transcript: data value too large (max length=131072)');
        }
        if (object === 'Task' && !record.Subject)
          throw new SfError('REQUIRED_FIELD_MISSING', 'Required fields are missing: [Subject]');
        for (const ref of ['WhatId', 'OwnerId']) {
          const id = record[ref];
          if (id && !Object.values(org).some(rows => rows.some(r => r.Id === id))) {
            throw new SfError('INVALID_CROSS_REFERENCE_KEY', `invalid cross reference id: ${ref}`);
          }
        }
        // The id is derived from the request, so identical requests replay identically.
        const hash = createHash('sha256').update(JSON.stringify(args)).digest();
        const id = sfId(prefixes[object], 'Hp', hash.readUInt32BE(0) % 3_500_000_000);
        return { id, success: true, errors: [] };
      },
      async updateRecord(args: Args) {
        const record = table(args.sobject).find(r => r.Id === args.id);
        if (!record) throw new SfError('ENTITY_IS_DELETED', 'entity is deleted or does not exist');
        for (const f of Object.keys(args.record ?? {})) fieldOf(record, f);
        return { id: args.id, success: true, errors: [] };
      },
    },
  };
}

import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import * as O from '@/lib/options';

const root = path.resolve(__dirname, '../..');
const fixture = path.join(root, 'fixtures', 'sostino.json');
const OPTION_VALUES = new Set(Object.values(O).flat().map((s) => s.toLowerCase()));

test.skipIf(!fs.existsSync(fixture))('no fixture value appears in committed template labels', () => {
  const values: string[] = [];
  (function walk(v: unknown) {
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (s.length >= 5 && !OPTION_VALUES.has(s)) values.push(s);
    } else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  })(JSON.parse(fs.readFileSync(fixture, 'utf8')));
  const dir = path.join(root, 'lib', 'sheets', 'templates');
  for (const f of fs.readdirSync(dir).filter((n) => /^page\d\.json$/.test(n))) {
    const texts: string[] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).texts.map((t: { t: string }) => t.t.toLowerCase());
    for (const v of values) for (const t of texts) expect(t.includes(v), `${f}: a label contains a fixture value`).toBe(false);
  }
});

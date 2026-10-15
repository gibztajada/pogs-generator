import fs from 'node:fs';
import path from 'node:path';
import { coerceForm } from '../lib/storage';
import { buildView } from '../lib/derive';

const root = path.resolve(__dirname, '..');
const { form, skipped } = coerceForm(JSON.parse(fs.readFileSync(path.join(root, 'fixtures', 'reference.json'), 'utf8')));
if (skipped.length) throw new Error(`fixture has invalid paths: ${skipped.join(', ')}`);

const flat: Record<string, string> = {};
(function walk(v: unknown, p: string) {
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === 'string')) { flat[p] = v.join(', '); return; }
    v.forEach((x, i) => walk(x, `${p}.${i}`));
  } else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) walk(x, p ? `${p}.${k}` : k);
  } else flat[p] = String(v);
})(buildView(form), '');
fs.writeFileSync(path.join(root, 'fixtures', 'reference.view.json'), JSON.stringify(flat, null, 1));
console.log(`wrote ${Object.keys(flat).length} view entries`);

import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import * as O from '@/lib/options';

const root = path.resolve(__dirname, '../..');
const fixture = path.join(root, 'fixtures', 'sostino.json');
const OPTION_VALUES = new Set(Object.values(O).flat().map((s) => s.toLowerCase()));

// Two classes of fixture values:
// (a) identifying / narrative values (paths below): fail when a label CONTAINS the value (or any of its lines),
//     unless the value is a whole '/'- or ','-separated part of that label (e.g. a printed option "Dependent/Unemployed").
// (b) every other value: fail only when a label EQUALS the value. Generic words ("Normal") may legitimately
//     occur inside printed form text such as "Abnormalities".
const IDENTIFYING = [
  'patient.', 'page1.admittingImpression', 'page1.finalDiagnosis', 'page1.chiefComplaint',
  'page2.hpi', 'page2.pastHistory', 'page2.familyHistory', 'page2.personalSocialHistory', 'page2.occupation',
  'page3.planOfCare', 'page3.referredFromTo', 'page3.examiner', 'page3.historyBy', 'page3.doneOn',
  'page5.attendedBy', 'page5.placentaBy', 'page6.attendingPhysicians',
];

const keep = (s: string) => s.length >= 5 && !OPTION_VALUES.has(s);

test.skipIf(!fs.existsSync(fixture))('no fixture value appears in committed template labels', () => {
  const narrative: string[] = [];
  const other: string[] = [];
  (function walk(v: unknown, p: string) {
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (IDENTIFYING.some((pre) => p.startsWith(pre))) {
        for (const x of [s, ...s.split('\n').map((l) => l.trim())]) if (keep(x)) narrative.push(x);
      } else if (keep(s)) other.push(s);
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, p ? `${p}.${i}` : String(i)));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, p ? `${p}.${k}` : k));
  })(JSON.parse(fs.readFileSync(fixture, 'utf8')), '');
  const dir = path.join(root, 'lib', 'sheets', 'templates');
  for (const f of fs.readdirSync(dir).filter((n) => /^page\d\.json$/.test(n))) {
    const texts: string[] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).texts.map((t: { t: string }) => t.t.trim().toLowerCase());
    for (const t of texts) {
      const parts = t.split(/[/,]/).map((x) => x.trim());
      for (const v of narrative) expect(t.includes(v) && !parts.includes(v), `${f}: a label contains an identifying fixture value`).toBe(false);
      for (const v of other) expect(t === v, `${f}: a label equals a fixture value`).toBe(false);
    }
  }
});

import { expect, test } from 'vitest';
import { PAGES } from '@/components/form/config';
import { emptyForm } from '@/lib/defaults';
import { getPath } from '@/lib/sheets/view';

test('every field path exists in the form with a matching type', () => {
  const f = emptyForm();
  for (const p of PAGES) for (const s of p.sections) for (const d of s.fields) {
    const v = getPath(f, d.path);
    if (d.kind === 'multi' || d.kind === 'table') expect(Array.isArray(v), d.path).toBe(true);
    else if (d.kind === 'bool') expect(typeof v, d.path).toBe('boolean');
    else expect(typeof v, d.path).toBe('string');
  }
});

test('six pages', () => expect(PAGES).toHaveLength(6));

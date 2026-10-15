import { describe, expect, test } from 'vitest';
import { coerceForm, loadDraft, parseFormFile, saveDraft, serializeForm } from '@/lib/storage';
import { emptyForm, sampleForm } from '@/lib/defaults';

function memStore(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null,
    get length() { return m.size; },
  } as Storage;
}

describe('coerceForm', () => {
  test('round-trips a valid form with nothing skipped', () => {
    const r = coerceForm(JSON.parse(serializeForm(sampleForm())));
    expect(r.skipped).toEqual([]);
    expect(r.form).toEqual(sampleForm());
  });
  test('numbers become strings, wrong types skipped, unknown keys skipped', () => {
    const r = coerceForm({ patient: { age: 44, lastName: { x: 1 } }, bogus: 1 });
    expect(r.form.patient.age).toBe('44');
    expect(r.form.patient.lastName).toBe('');
    expect(r.skipped).toEqual(expect.arrayContaining(['patient.lastName', 'bogus']));
  });
  test('tables: truncated to 13, labor padded to 11', () => {
    const rows = Array.from({ length: 15 }, () => ({ order: 'G' }));
    const r = coerceForm({ page1: { obHistory: rows }, page4: { laborTable: [{ dilatation: 2 }] } });
    expect(r.form.page1.obHistory).toHaveLength(13);
    expect(r.form.page4.laborTable).toHaveLength(11);
    expect(r.form.page4.laborTable[0].dilatation).toBe('2');
    expect(r.skipped).toContain('page1.obHistory.13');
  });
  test('string lists drop non-strings', () => {
    const r = coerceForm({ page1: { contraception: ['Pills', 3, null] } });
    expect(r.form.page1.contraception).toEqual(['Pills', '3']);
    expect(r.skipped).toContain('page1.contraception.2');
  });
  test('booleans', () => {
    const r = coerceForm({ page5: { primaryCs: { checked: true, tubalLigation: 'yes' } } });
    expect(r.form.page5.primaryCs.checked).toBe(true);
    expect(r.form.page5.primaryCs.tubalLigation).toBe(false);
    expect(r.skipped).toContain('page5.primaryCs.tubalLigation');
  });
  test('non-object input gives empty form', () => {
    expect(coerceForm(null).form).toEqual(emptyForm());
  });
});

describe('parseFormFile', () => {
  test('throws on non-JSON', () => expect(() => parseFormFile('nope')).toThrow('Not a valid JSON file'));
});

describe('draft', () => {
  test('save then load', () => {
    const st = memStore();
    expect(saveDraft(sampleForm(), st)).toBe(true);
    expect(loadDraft(st)).toEqual(sampleForm());
  });
  test('no store → false / null', () => {
    expect(saveDraft(sampleForm(), null)).toBe(false);
    expect(loadDraft(null)).toBeNull();
  });
  test('corrupt draft → null', () => {
    const st = memStore(); st.setItem('pogs:draft:v1', '{bad');
    expect(loadDraft(st)).toBeNull();
  });
});

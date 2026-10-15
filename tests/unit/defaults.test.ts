import { describe, expect, test } from 'vitest';
import { emptyForm, sampleForm, LABOR_ROWS } from '@/lib/defaults';
import { pogsFormSchema } from '@/lib/schema';

describe('defaults', () => {
  test('emptyForm satisfies schema', () => {
    expect(pogsFormSchema.safeParse(emptyForm()).success).toBe(true);
  });
  test('sampleForm satisfies schema and is fictitious', () => {
    const s = sampleForm();
    expect(pogsFormSchema.safeParse(s).success).toBe(true);
    expect(s.patient.lastName).toBe('DELA CRUZ');
  });
  test('labor table always has 11 rows', () => {
    expect(emptyForm().page4.laborTable).toHaveLength(LABOR_ROWS);
  });
  test('emptyForm returns fresh objects', () => {
    const a = emptyForm(); a.page1.contraception.push('Pills');
    expect(emptyForm().page1.contraception).toEqual([]);
  });
});

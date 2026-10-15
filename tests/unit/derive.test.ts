import { describe, expect, test } from 'vitest';
import { buildView, computeBmi, laborPoints, seedObHistory } from '@/lib/derive';
import { emptyForm, emptyLaborRow, emptyObRow } from '@/lib/defaults';

describe('computeBmi', () => {
  test('cm height', () => expect(computeBmi('81', '154')).toBe('34.2'));
  test('m height', () => expect(computeBmi('81', '1.54')).toBe('34.2'));
  test('blank or junk', () => {
    expect(computeBmi('', '154')).toBe('');
    expect(computeBmi('abc', '154')).toBe('');
    expect(computeBmi('81', '0')).toBe('');
  });
});

describe('buildView', () => {
  test('footer from patient, sex F', () => {
    const f = emptyForm();
    Object.assign(f.patient, { lastName: 'A', firstName: 'B', middleName: 'C', age: '30', hospNo: '9', room: 'R1' });
    expect(buildView(f).footer).toEqual({ surname: 'A', givenName: 'B', mi: 'C', age: '30', sex: 'F', hospNo: '9', ward: 'R1' });
  });
  test('bmi derived only when blank', () => {
    const f = emptyForm(); f.page3.wt = '81'; f.page3.ht = '154';
    expect(buildView(f).page3.bmi).toBe('34.2');
    f.page3.bmi = '30';
    expect(buildView(f).page3.bmi).toBe('30');
  });
  test('does not mutate input', () => {
    const f = emptyForm(); f.page3.wt = '81'; f.page3.ht = '154';
    buildView(f);
    expect(f.page3.bmi).toBe('');
  });
});

describe('seedObHistory', () => {
  test('adds G1..Gn keeping existing rows', () => {
    const rows = [{ ...emptyObRow(), order: 'G1', year: '2000' }];
    const out = seedObHistory(rows, '3');
    expect(out.map((r) => r.order)).toEqual(['G1', 'G2', 'G3']);
    expect(out[0].year).toBe('2000');
  });
  test('never shrinks, caps at 13', () => {
    const rows = Array.from({ length: 4 }, (_, i) => ({ ...emptyObRow(), order: `G${i + 1}` }));
    expect(seedObHistory(rows, '2')).toHaveLength(4);
    expect(seedObHistory([], '20')).toHaveLength(13);
    expect(seedObHistory([], 'x')).toHaveLength(0);
  });
});

describe('laborPoints', () => {
  test('numeric cells only, hour = index', () => {
    const t = Array.from({ length: 11 }, emptyLaborRow);
    t[0] = { dilatation: '2', station: '-3' };
    t[10] = { dilatation: '', station: '-5' };
    t[4] = { dilatation: 'n/a', station: '' };
    expect(laborPoints(t)).toEqual({ dil: [{ h: 0, v: 2 }], stn: [{ h: 0, v: -3 }, { h: 10, v: -5 }] });
  });
});

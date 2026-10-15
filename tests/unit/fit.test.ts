import { describe, expect, test } from 'vitest';
import { fitText, wrap } from '@/lib/sheets/fit';

describe('wrap', () => {
  test('keeps paragraphs and wraps words', () => {
    expect(wrap('aaa bbb ccc\nddd', 30, 8)).toEqual(['aaa bbb', 'ccc', 'ddd']); // 'aaa bbb' = 3614/1000 em × 8 = 28.9pt ≤ 30
  });
  test('empty paragraph preserved', () => expect(wrap('a\n\nb', 100, 8)).toEqual(['a', '', 'b']));
  test('narrow chars fit more per line than wide chars', () => {
    const narrow = wrap(Array(40).fill('iiii').join(' '), 100, 8)[0].length;
    const wide = wrap(Array(40).fill('WWWW').join(' '), 100, 8)[0].length;
    expect(narrow).toBeGreaterThan(wide);
  });
  test('single over-long word stays on its own line', () =>
    expect(wrap('a ' + 'W'.repeat(50) + ' b', 30, 8)).toEqual(['a', 'W'.repeat(50), 'b']));
});

describe('fitText', () => {
  test('keeps base size when it fits', () => expect(fitText('short', 200, 20, 8).size).toBe(8));
  test('shrinks long text to fit height', () => {
    const r = fitText('word '.repeat(200), 200, 40, 8);
    expect(r.size).toBeLessThan(8);
    expect(r.lines.length * r.size * 1.15).toBeLessThanOrEqual(40);
  });
  test('stops at min size', () => expect(fitText('word '.repeat(5000), 50, 10, 8).size).toBe(3));
});

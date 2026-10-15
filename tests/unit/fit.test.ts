import { describe, expect, test } from 'vitest';
import { fitText, wrap } from '@/lib/sheets/fit';

describe('wrap', () => {
  test('keeps paragraphs and wraps words', () => {
    expect(wrap('aaa bbb ccc\nddd', 30, 8)).toEqual(['aaa bbb', 'ccc', 'ddd']); // 30 / (8*0.52) → 7 chars/line
  });
  test('empty paragraph preserved', () => expect(wrap('a\n\nb', 100, 8)).toEqual(['a', '', 'b']));
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

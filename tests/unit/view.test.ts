import { expect, test } from 'vitest';
import { asText, getPath, isChecked } from '@/lib/sheets/view';

test('getPath', () => {
  expect(getPath({ a: { b: [{ c: 'x' }] } }, 'a.b.0.c')).toBe('x');
  expect(getPath({ a: 1 }, 'a.b.c')).toBeUndefined();
});
test('asText', () => {
  expect(asText('x')).toBe('x'); expect(asText(3)).toBe('3');
  expect(asText(true)).toBe(''); expect(asText(['a', 'b'])).toBe('a, b'); expect(asText(undefined)).toBe('');
});
test('isChecked', () => {
  expect(isChecked(['Pills', 'IUD'], 'IUD')).toBe(true);
  expect(isChecked('M', 'M')).toBe(true);
  expect(isChecked('S', 'M')).toBe(false);
  expect(isChecked(true)).toBe(true);
  expect(isChecked('', undefined)).toBe(false);
  expect(isChecked('text', undefined)).toBe(true);
});

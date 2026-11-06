import { describe, expect, test } from 'vitest';
import { gateDecision, gateToken, isValidGateCookie, safeEqual, safeNext } from '@/lib/gate';

describe('gateToken', () => {
  test('stable per code, differs between codes, base64url', async () => {
    const a = await gateToken('15');
    expect(await gateToken('15')).toBe(a);
    expect(await gateToken('16')).not.toBe(a);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('safeEqual', () => {
  test('equal only for identical strings', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'ab')).toBe(false);
  });
});

describe('isValidGateCookie', () => {
  test('accepts the token for the configured code only', async () => {
    const t = await gateToken('15');
    expect(await isValidGateCookie(t, '15')).toBe(true);
    expect(await isValidGateCookie(undefined, '15')).toBe(false);
    expect(await isValidGateCookie('x', '15')).toBe(false);
    expect(await isValidGateCookie(t, undefined)).toBe(false);
    expect(await isValidGateCookie('', '')).toBe(false);
  });
});

describe('safeNext', () => {
  test('keeps same-origin relative paths', () => {
    expect(safeNext('/')).toBe('/');
    expect(safeNext('/dev/sheet/1?x=1')).toBe('/dev/sheet/1?x=1');
  });
  test.each(['//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', '/\t/evil.com', '/\n/evil.com', '/\r/evil.com', '', null, undefined])(
    'falls back to / for %s',
    (v) => expect(safeNext(v)).toBe('/'),
  );
});

describe('gateDecision', () => {
  test('pages redirect, api denies, unlocked allows', () => {
    expect(gateDecision('/', false)).toBe('redirect');
    expect(gateDecision('/', true)).toBe('allow');
    expect(gateDecision('/dev/sheet/1', false)).toBe('redirect');
    expect(gateDecision('/api/pdf', false)).toBe('deny');
  });
  test.each(['/api/unlock', '/unlock', '/_next/static/chunks/a.js', '/fonts/arimo-400.woff2', '/sheet-assets/x.png', '/favicon.ico'])(
    'public path %s is allowed while locked',
    (p) => expect(gateDecision(p, false)).toBe('allow'),
  );
});

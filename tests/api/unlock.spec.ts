import { expect, test } from '@playwright/test';
import { sampleForm } from '../../lib/defaults';

// These run locked: no unlock cookie from the global setup.
test.use({ storageState: { cookies: [], origins: [] } });

const CODE = process.env.APP_PASSCODE!;
const WRONG = CODE === '00' ? '01' : '00';

test('PDF without the cookie → 401', async ({ request }) => {
  const res = await request.post('/api/pdf', { data: sampleForm() });
  expect(res.status()).toBe(401);
});

test('wrong code → 401, no cookie', async ({ request }) => {
  const res = await request.post('/api/unlock', { data: { passcode: WRONG } });
  expect(res.status()).toBe(401);
  expect(res.headers()['set-cookie']).toBeUndefined();
});

test('right code → 200 with the gate cookie', async ({ request }) => {
  const res = await request.post('/api/unlock', { data: { passcode: CODE } });
  expect(res.status()).toBe(200);
  const cookie = res.headers()['set-cookie'];
  expect(cookie).toContain('pogs_gate=');
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('Max-Age=86400');
  expect(cookie).toMatch(/SameSite=Lax/i);
});

test('locked page redirects to /unlock with next', async ({ request }) => {
  const res = await request.get('/', { maxRedirects: 0 });
  expect([307, 308]).toContain(res.status());
  expect(res.headers()['location']).toMatch(/\/unlock\?next=%2F$/);
});

test('public font is served while locked', async ({ request }) => {
  const res = await request.get('/fonts/arimo-400.woff2');
  expect(res.status()).toBe(200);
});

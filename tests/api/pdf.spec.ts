import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { emptyForm, sampleForm } from '../../lib/defaults';

test('sample form → 6 A4 pages', async ({ request }) => {
  const res = await request.post('/api/pdf', { data: sampleForm() });
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/pdf');
  expect(res.headers()['content-disposition']).toContain('DELA CRUZ POGS.pdf');
  const doc = await PDFDocument.load(await res.body());
  expect(doc.getPageCount()).toBe(6);
  for (const p of doc.getPages()) {
    expect(Math.abs(p.getWidth() - 595.28)).toBeLessThan(1.5);
    expect(Math.abs(p.getHeight() - 841.89)).toBeLessThan(1.5);
  }
});

test('missing last name → 400', async ({ request }) => {
  const res = await request.post('/api/pdf', { data: emptyForm() });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toMatch(/last name/i);
});

test('wrong shape → 400 with skipped paths', async ({ request }) => {
  const res = await request.post('/api/pdf', { data: { patient: { lastName: 'X', age: { bad: 1 } } } });
  expect(res.status()).toBe(400);
  expect((await res.json()).skipped).toContain('patient.age');
});

test('GET → 405', async ({ request }) => {
  expect((await request.get('/api/pdf')).status()).toBe(405);
});

import fs from 'node:fs';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('typing updates preview', async ({ page }) => {
  await page.getByLabel('Last name').fill('TESTNAME');
  await expect(page.getByTestId('preview')).toContainText('TESTNAME');
});

test('autosave survives reload', async ({ page }) => {
  await page.getByLabel('Last name').fill('PERSIST');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('pogs:draft:v1') ?? ''))
    .toContain('PERSIST');
  await page.reload();
  await expect(page.getByLabel('Last name')).toHaveValue('PERSIST');
});

test('save → new → load round-trip', async ({ page }) => {
  await page.getByLabel('Last name').fill('ROUNDTRIP');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save .json' }).click()]);
  const file = await dl.path();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'New patient' }).click();
  await expect(page.getByLabel('Last name')).toHaveValue('');
  await page.getByTestId('load-input').setInputFiles(file!);
  await expect(page.getByLabel('Last name')).toHaveValue('ROUNDTRIP');
  expect(JSON.parse(fs.readFileSync(file!, 'utf8')).patient.lastName).toBe('ROUNDTRIP');
});

test('invalid file shows error and keeps form', async ({ page }) => {
  await page.getByLabel('Last name').fill('KEEP');
  await page.getByTestId('load-input').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('nope') });
  await expect(page.getByRole('status')).toContainText('Not a valid JSON file');
  await expect(page.getByLabel('Last name')).toHaveValue('KEEP');
});

test('partially valid file loads valid fields and reports skipped', async ({ page }) => {
  await page.getByTestId('load-input').setInputFiles({
    name: 'p.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"patient":{"lastName":"OKAY"},"bogus":1}'),
  });
  await expect(page.getByRole('status')).toContainText('skipped field(s)');
  await expect(page.getByLabel('Last name')).toHaveValue('OKAY');
});

test('page tabs switch the editor', async ({ page }) => {
  await page.getByRole('button', { name: 'Page 2' }).click();
  await expect(page.getByLabel('History of present illness')).toBeVisible();
});

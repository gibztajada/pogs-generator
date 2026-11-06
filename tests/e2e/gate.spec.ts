import { expect, test, type Page } from '@playwright/test';

// Start locked: no unlock cookie from the global setup.
test.use({ storageState: { cookies: [], origins: [] } });

const CODE = process.env.APP_PASSCODE!;
const WRONG = CODE === '00' ? '01' : '00';
const key = (page: Page) => page.getByRole('button', { name: 'Unlock' });
const box = (page: Page) => page.getByLabel('Passcode');

test('locked root redirects to unlock', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/unlock/);
  await expect(page.getByText('Enter the team passcode to reveal your key')).toBeVisible();
  await expect(key(page)).toBeHidden();
});

test('wrong code shows error and no key', async ({ page }) => {
  await page.goto('/unlock');
  await box(page).pressSequentially(WRONG);
  await expect(page.getByText('Incorrect passcode')).toBeVisible();
  await expect(key(page)).toBeHidden();
});

test('right code reveals key; catching it opens the app', async ({ page }) => {
  await page.goto('/unlock');
  await box(page).pressSequentially(CODE);
  await expect(page.getByText('Use the key to unlock')).toBeVisible();
  await expect(key(page)).toBeVisible();
  await expect(key(page)).toBeFocused();
  await key(page).click();
  await expect(page).toHaveURL('/', { timeout: 8000 });
});

test('next is honoured', async ({ page }) => {
  await page.goto('/unlock?next=%2Fdev%2Fsheet%2F1');
  await box(page).pressSequentially(CODE);
  await key(page).click();
  await expect(page).toHaveURL('/dev/sheet/1', { timeout: 8000 });
});

test('pasted digits are cleaned', async ({ page }) => {
  await page.goto('/unlock');
  await box(page).fill(`a${CODE[0]} ${CODE[1]}`);
  await expect(box(page)).toHaveValue(CODE);
  await expect(key(page)).toBeVisible();
});

test('one request per attempt', async ({ page }) => {
  let n = 0;
  page.on('request', (r) => { if (r.url().endsWith('/api/unlock')) n++; });
  await page.goto('/unlock');
  await box(page).pressSequentially(CODE);
  await box(page).press('Enter').catch(() => {});
  await expect(key(page)).toBeVisible();
  expect(n).toBe(1);
});

test('network failure is recoverable', async ({ page }) => {
  await page.goto('/unlock');
  await page.route('**/api/unlock', (r) => r.abort());
  await box(page).pressSequentially(CODE);
  await expect(page.getByText("Couldn't check the passcode. Try again.")).toBeVisible();
  await page.unroute('**/api/unlock');
  await box(page).fill('');
  await box(page).pressSequentially(CODE);
  await expect(key(page)).toBeVisible();
});

test.describe('unlocked', () => {
  test.use({ storageState: 'tests/.auth/state.json' });

  test('log out locks the app again', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/unlock/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/unlock/);
  });
});

test('keyboard catch', async ({ page }) => {
  await page.goto('/unlock');
  await box(page).pressSequentially(CODE);
  await expect(key(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/', { timeout: 8000 });
});

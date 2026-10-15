import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const MAX_RATIO: Record<number, number> = { 1: 0.015, 2: 0.015, 3: 0.015, 4: 0.015, 5: 0.015, 6: 0.015 };
const MAX_INK_RATIO: Record<number, number> = { 1: 0.1, 2: 0.1, 3: 0.1, 4: 0.1, 5: 0.1, 6: 0.1 };
const ref = (n: number) => path.join('tests', 'fidelity', 'reference', `page${n}.png`);
const out = path.join('tests', 'fidelity', 'output');
const inkCount = (a: PNG, b: PNG) => {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const dark = (d: Buffer, j: number) => d[j] < 240 || d[j + 1] < 240 || d[j + 2] < 240;
    if (dark(a.data, i) || dark(b.data, i)) n++;
  }
  return n;
};

for (const n of [1, 2, 3, 4, 5, 6]) {
  test(`page ${n} matches reference`, async ({ page }) => {
    test.skip(!fs.existsSync(ref(n)), 'reference not rasterized');
    await page.goto(`/dev/sheet/${n}`);
    await page.evaluate(() => document.fonts.ready);
    const shot = PNG.sync.read(await page.locator('svg.sheet').screenshot());
    const want = PNG.sync.read(fs.readFileSync(ref(n)));
    expect(Math.abs(shot.width - want.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(shot.height - want.height)).toBeLessThanOrEqual(2);
    const w = Math.min(shot.width, want.width);
    const h = Math.min(shot.height, want.height);
    const crop = (img: PNG) => { const c = new PNG({ width: w, height: h }); PNG.bitblt(img, c, 0, 0, w, h, 0, 0); return c; };
    const a = crop(want);
    const b = crop(shot);
    const diff = new PNG({ width: w, height: h });
    const bad = pixelmatch(a.data, b.data, diff.data, w, h, { threshold: 0.2 });
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, `page${n}.actual.png`), PNG.sync.write(b));
    fs.writeFileSync(path.join(out, `page${n}.diff.png`), PNG.sync.write(diff));
    const ratio = bad / (w * h);
    const inkRatio = bad / Math.max(inkCount(a, b), 1);
    console.log(`page ${n}: mismatch ${(ratio * 100).toFixed(3)}% ink-mismatch ${(inkRatio * 100).toFixed(3)}%`);
    expect(ratio).toBeLessThan(MAX_RATIO[n]);
    expect(inkRatio).toBeLessThan(MAX_INK_RATIO[n]);
  });
}

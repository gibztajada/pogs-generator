import puppeteer, { type Browser } from 'puppeteer-core';

const LOCAL_CHROME = process.platform === 'win32'
  ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/google-chrome';

async function launch(): Promise<Browser> {
  if (process.env.VERCEL) {
    const chromium = (await import('@sparticuz/chromium')).default;
    return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  }
  return puppeteer.launch({ executablePath: process.env.CHROME_PATH || LOCAL_CHROME, headless: true });
}

export const PDF_DEADLINE_MS = 20_000;

export function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error('PDF generation timed out');
      err.name = 'TimeoutError';
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  let browser: Browser | undefined;
  const work = (async () => {
    browser = await launch();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  })();
  // If the deadline wins, the late result/rejection of `work` must not go unhandled.
  work.catch(() => undefined);
  try {
    return await withDeadline(work, PDF_DEADLINE_MS);
  } finally {
    // A launch still in flight when the deadline fires is closed once it settles.
    if (browser) await browser.close().catch(() => undefined);
    else void work.then(() => browser?.close()).catch(() => browser?.close().catch(() => undefined));
  }
}

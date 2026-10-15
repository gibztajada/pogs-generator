import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PogsForm } from '@/lib/schema';
import { AllSheets } from '@/lib/sheets/Sheet';

const pub = (...p: string[]) => path.join(process.cwd(), 'public', ...p);
const b64 = (file: string) => fs.readFileSync(file).toString('base64');

let cache: { css: string; assets: Record<string, string> } | null = null;

function embedded() {
  if (cache) return cache;
  const css = `
@font-face { font-family: 'Arimo'; src: url(data:font/woff2;base64,${b64(pub('fonts', 'arimo-400.woff2'))}) format('woff2'); font-weight: 400; }
@font-face { font-family: 'Arimo'; src: url(data:font/woff2;base64,${b64(pub('fonts', 'arimo-700.woff2'))}) format('woff2'); font-weight: 700; }
@page { size: A4; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
.sheet { display: block; break-after: page; }
.sheet:last-child { break-after: auto; }`;
  const assets = {
    'header.png': `data:image/png;base64,${b64(pub('sheet-assets', 'header.png'))}`,
    'seal.png': `data:image/png;base64,${b64(pub('sheet-assets', 'seal.png'))}`,
  };
  cache = { css, assets };
  return cache;
}

export function renderSheetsHtml(form: PogsForm): string {
  const { css, assets } = embedded();
  const body = renderToStaticMarkup(<AllSheets form={form} assets={assets} />);
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`;
}

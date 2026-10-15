import { expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TemplatePage } from '@/lib/sheets/TemplatePage';
import type { Template } from '@/lib/sheets/template';

const tpl: Template = {
  page: 1, width: 595, height: 842,
  paths: [{ d: 'M0 0L10 0', stroke: '#000000', sw: 0.66 }],
  texts: [{ t: 'NAME:', x: 10, y: 20, s: 9, b: true }],
  fields: [
    { k: 'patient.lastName', x: 50, y: 20, s: 9, b: false },
    { k: 'page2.hpi', x: 10, y: 100, w: 100, h: 20, s: 8, b: false, ml: true },
  ],
  checks: [
    { k: 'page1.contraception', v: 'Pills', x: 5, y: 5, w: 6.3, h: 6.3 },
    { k: 'page5.postpartumCondition', v: 'Good', x: 5, y: 15, w: 6.3, h: 6.3, ow: true },
  ],
  marks: [{ k: 'page3.position', v: 'Midposition', x: 300, y: 300, s: 9, b: true }],
  images: [{ src: 'seal.png', x: 1, y: 1, w: 2, h: 2 }],
};
const view = {
  patient: { lastName: 'DOE & <X>' }, page2: { hpi: 'word '.repeat(300) },
  page1: { contraception: ['Pills'] }, page3: { position: 'Midposition' }, page5: { postpartumCondition: '' },
};

test('renders labels, escaped values, checks, marks, images', () => {
  const html = renderToStaticMarkup(<TemplatePage template={tpl} view={view} assets={{ 'seal.png': '/s.png' }} />);
  expect(html).toContain('width="595pt"');
  expect(html).toContain('NAME:');
  expect(html).toContain('DOE &amp; &lt;X&gt;');
  expect(html).toContain('href="/s.png"');
  expect(html.match(/<path/g)?.length).toBe(2); // the rule + the Pills checkbox; synthetic unchecked "Good" hidden
  expect(html).toContain('>X</text>');
});

test('multiline field shrinks below its base size', () => {
  const html = renderToStaticMarkup(<TemplatePage template={tpl} view={view} assets={{}} />);
  const sizes = [...html.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
  expect(Math.min(...sizes)).toBeLessThan(8);
});

test('clip reference matches its clipPath id, and two sheets of one page have distinct ids', () => {
  const html = renderToStaticMarkup(<><TemplatePage template={tpl} view={view} assets={{}} /><TemplatePage template={tpl} view={view} assets={{}} /></>);
  const ids = [...html.matchAll(/<clipPath id="([^"]+)"/g)].map((m) => m[1]);
  const refs = [...html.matchAll(/clip-path="url\(#([^)]+)\)"/g)].map((m) => m[1]);
  expect(ids).toHaveLength(2);
  expect(new Set(ids).size).toBe(2);
  expect(refs).toEqual(ids);
  for (const id of ids) expect(id).toMatch(/^[a-zA-Z0-9_-]+$/);
});

test('single-line slot compresses with textLength only when the text is wider than w', () => {
  const t: Template = {
    ...tpl, texts: [], checks: [], marks: [], images: [], paths: [],
    fields: [
      { k: 'patient.address', x: 50, y: 20, s: 8, w: 60 },
      { k: 'patient.caseNo', x: 500, y: 40, s: 8, w: 60, al: 'r' },
      { k: 'patient.lastName', x: 50, y: 60, s: 8, w: 60 },
    ],
  };
  const v = { patient: { address: 'A VERY LONG STREET ADDRESS, BARANGAY, CITY', caseNo: 'CASE-0000000000000001', lastName: 'DOE' } };
  const html = renderToStaticMarkup(<TemplatePage template={t} view={v} assets={{}} />);
  const tag = (s: string) => html.match(new RegExp(`<text[^>]*>${s}</text>`))![0];
  expect(tag('A VERY LONG STREET ADDRESS, BARANGAY, CITY')).toMatch(/textLength="60"[^>]*lengthAdjust="spacingAndGlyphs"|lengthAdjust="spacingAndGlyphs"[^>]*textLength="60"/);
  expect(tag('CASE-0000000000000001')).toContain('textLength="60"');
  expect(tag('CASE-0000000000000001')).toContain('text-anchor="end"');
  expect(tag('DOE')).not.toContain('textLength');
  expect(tag('DOE')).not.toContain('lengthAdjust');
});

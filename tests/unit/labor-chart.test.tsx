import { expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LaborChart } from '@/lib/sheets/LaborChart';
import type { TplChart } from '@/lib/sheets/template';
import type { LaborRow } from '@/lib/schema';

const chart: TplChart = {
  dil: { hourX: [100, 200], vMin: 2, yMin: 180, vMax: 10, yMax: 100 },
  stn: { hourX: [50, 150], vTop: 0, yTop: 300, vBottom: -5, yBottom: 350 },
  color: '#4285f4', outline: '#000000', inner: 1.5, outer: 2.25,
};

const rows = (cells: Record<number, Partial<LaborRow>>): LaborRow[] =>
  Array.from({ length: 11 }, (_, h) => ({ dilatation: '', station: '', ...cells[h] }));

type R = { x: number; y: number; w: number; h: number; fill: string };
function rects(html: string): R[] {
  return [...html.matchAll(/<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" fill="([^"]+)"/g)]
    .map((m) => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4], fill: m[5] }));
}
const centre = (r: R) => [r.x + r.w / 2, r.y + r.h / 2];

test('each series uses its own hour axis; two rects per point; no polyline', () => {
  const html = renderToStaticMarkup(<svg><LaborChart chart={chart} table={rows({ 0: { dilatation: '2', station: '0' }, 10: { dilatation: '10', station: '-5' } })} /></svg>);
  expect(html).not.toContain('polyline');
  const r = rects(html);
  expect(r).toHaveLength(8);
  const [dil0o, dil0i, dil10o, dil10i, stn0o, stn0i, stn10o, stn10i] = r;
  expect(dil0o).toMatchObject({ w: 2.25, h: 2.25, fill: '#000000' });
  expect(dil0i).toMatchObject({ w: 1.5, h: 1.5, fill: '#4285f4' });
  expect(centre(dil0o)).toEqual([100, 180]);
  expect(centre(dil0i)).toEqual([100, 180]);
  expect(centre(dil10i)).toEqual([200, 100]);
  expect(centre(dil10o)).toEqual([200, 100]);
  expect(centre(stn0o)).toEqual([50, 300]);
  expect(centre(stn0i)).toEqual([50, 300]);
  expect(centre(stn10o)).toEqual([150, 350]);
  expect(centre(stn10i)).toEqual([150, 350]);
});

test('dilatation 2 plotted, 11 skipped; station -3 proportional; out-of-range station skipped', () => {
  const html = renderToStaticMarkup(<svg><LaborChart chart={chart} table={rows({
    1: { dilatation: '2', station: '-3' }, 2: { dilatation: '11', station: '1' }, 3: { station: '-6' },
  })} /></svg>);
  const r = rects(html);
  expect(r).toHaveLength(4);
  expect(centre(r[1])).toEqual([110, 180]);
  const [x, y] = centre(r[3]);
  expect(x).toBeCloseTo(60);
  expect(y).toBeCloseTo(330);
});

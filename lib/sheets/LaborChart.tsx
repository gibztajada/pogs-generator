import type { LaborRow } from '@/lib/schema';
import { laborPoints, type Pt } from '@/lib/derive';
import type { TplChart } from './template';

type Axis = { hourX: [number, number]; v0: number; y0: number; v1: number; y1: number; lo: number; hi: number };

/** Reference-style scatter: outline square under a colour square per point, no connecting line. */
export function LaborChart({ chart, table }: { chart: TplChart; table: LaborRow[] }) {
  const { dil, stn } = laborPoints(table);
  const { inner, outer } = chart;
  const series = (pts: Pt[], a: Axis) => {
    const hx = (h: number) => a.hourX[0] + ((a.hourX[1] - a.hourX[0]) * h) / 10;
    const vy = (v: number) => a.y0 + ((a.y1 - a.y0) * (v - a.v0)) / (a.v1 - a.v0);
    return pts
      .filter((p) => p.v >= a.lo && p.v <= a.hi)
      .map((p) => {
        const x = hx(p.h);
        const y = vy(p.v);
        return (
          <g key={p.h}>
            <rect x={x - outer / 2} y={y - outer / 2} width={outer} height={outer} fill={chart.outline} />
            <rect x={x - inner / 2} y={y - inner / 2} width={inner} height={inner} fill={chart.color} />
          </g>
        );
      });
  };
  const d = chart.dil;
  const s = chart.stn;
  return (
    <g>
      <g>{series(dil, { hourX: d.hourX, v0: d.vMin, y0: d.yMin, v1: d.vMax, y1: d.yMax, lo: d.vMin, hi: d.vMax })}</g>
      <g>{series(stn, { hourX: s.hourX, v0: s.vTop, y0: s.yTop, v1: s.vBottom, y1: s.yBottom,
        lo: Math.min(s.vTop, s.vBottom), hi: Math.max(s.vTop, s.vBottom) })}</g>
    </g>
  );
}

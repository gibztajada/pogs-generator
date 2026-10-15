import type { LaborRow } from '@/lib/schema';
import { laborPoints, type Pt } from '@/lib/derive';
import type { TplChart } from './template';

export function LaborChart({ chart, table }: { chart: TplChart; table: LaborRow[] }) {
  const { dil, stn } = laborPoints(table);
  const hx = (h: number) => chart.hourX[0] + ((chart.hourX[1] - chart.hourX[0]) * h) / 10;
  const dy = (v: number) => chart.dil.y3 + ((chart.dil.y10 - chart.dil.y3) * (v - 3)) / 7;
  const sy = (v: number) => chart.stn.y0 + ((chart.stn.yMinus5 - chart.stn.y0) * v) / -5;
  const series = (pts: Pt[], y: (v: number) => number, lo: number, hi: number) => {
    const ok = pts.filter((p) => p.v >= lo && p.v <= hi);
    return (
      <g>
        {ok.length > 1 && <polyline points={ok.map((p) => `${hx(p.h)},${y(p.v)}`).join(' ')} fill="none" stroke={chart.color} strokeWidth={0.75} />}
        {ok.map((p) => <rect key={p.h} x={hx(p.h) - 1.5} y={y(p.v) - 0.4} width={3} height={0.8} fill={chart.color} />)}
      </g>
    );
  };
  return <g>{series(dil, dy, 3, 10)}{series(stn, sy, -5, 0)}</g>;
}

import type { LaborRow, ObHistoryRow, PogsForm } from './schema';
import { emptyObRow, MAX_TABLE_ROWS } from './defaults';

export type Footer = { surname: string; givenName: string; mi: string; age: string; sex: 'F'; hospNo: string; ward: string };
export type SheetView = PogsForm & { footer: Footer };
export type Pt = { h: number; v: number };

export function footerOf(form: PogsForm): Footer {
  const p = form.patient;
  return { surname: p.lastName, givenName: p.firstName, mi: p.middleName, age: p.age, sex: 'F', hospNo: p.hospNo, ward: p.room };
}

export function computeBmi(wt: string, ht: string): string {
  const w = parseFloat(wt);
  const h = parseFloat(ht);
  if (!(w > 0) || !(h > 0)) return '';
  const m = h > 3 ? h / 100 : h;
  return (w / (m * m)).toFixed(1);
}

export function buildView(form: PogsForm): SheetView {
  return {
    ...form,
    page3: { ...form.page3, bmi: form.page3.bmi || computeBmi(form.page3.wt, form.page3.ht) },
    footer: footerOf(form),
  };
}

export function seedObHistory(rows: ObHistoryRow[], g: string): ObHistoryRow[] {
  const n = Math.min(MAX_TABLE_ROWS, parseInt(g, 10) || 0);
  const out = rows.slice(0, MAX_TABLE_ROWS);
  for (let i = out.length; i < n; i++) out.push({ ...emptyObRow(), order: `G${i + 1}` });
  return out;
}

export function laborPoints(table: LaborRow[]): { dil: Pt[]; stn: Pt[] } {
  const dil: Pt[] = [];
  const stn: Pt[] = [];
  table.forEach((r, h) => {
    const d = r.dilatation.trim();
    if (d !== '' && Number.isFinite(Number(d))) dil.push({ h, v: Number(d) });
    const s = r.station.trim();
    if (s !== '' && Number.isFinite(Number(s))) stn.push({ h, v: Number(s) });
  });
  return { dil, stn };
}

import { emptyForm, emptyLaborRow, emptyMonitoringRow, emptyObRow, LABOR_ROWS, MAX_TABLE_ROWS } from './defaults';
import { pogsFormSchema, type PogsForm } from './schema';

export const DRAFT_KEY = 'pogs:draft:v1';

type RowSpec = { make: () => Record<string, unknown>; max: number; fixed?: boolean };
const ROWS: Record<string, RowSpec> = {
  'page1.obHistory': { make: emptyObRow, max: MAX_TABLE_ROWS },
  'page4.laborTable': { make: emptyLaborRow, max: LABOR_ROWS, fixed: true },
  'page6.monitoring': { make: emptyMonitoringRow, max: MAX_TABLE_ROWS },
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function coerceValue(tpl: unknown, raw: unknown, path: string, skipped: string[]): unknown {
  if (raw === undefined) return tpl;
  if (typeof tpl === 'string') {
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'number') return String(raw);
    skipped.push(path); return tpl;
  }
  if (typeof tpl === 'boolean') {
    if (typeof raw === 'boolean') return raw;
    skipped.push(path); return tpl;
  }
  if (typeof tpl === 'number') return tpl; // schemaVersion: always ours
  if (Array.isArray(tpl)) {
    if (!Array.isArray(raw)) { skipped.push(path); return tpl; }
    const spec = ROWS[path];
    if (spec) {
      const rows = raw.slice(0, spec.max).map((r, i) => coerceObject(spec.make(), r, `${path}.${i}`, skipped));
      raw.slice(spec.max).forEach((_, i) => skipped.push(`${path}.${spec.max + i}`));
      if (spec.fixed) while (rows.length < spec.max) rows.push(spec.make());
      return rows;
    }
    const out: string[] = [];
    raw.forEach((v, i) => {
      if (typeof v === 'string') out.push(v);
      else if (typeof v === 'number') out.push(String(v));
      else skipped.push(`${path}.${i}`);
    });
    return out;
  }
  if (isObj(tpl)) return coerceObject(tpl, raw, path, skipped);
  return tpl;
}

function coerceObject(tpl: Record<string, unknown>, raw: unknown, path: string, skipped: string[]) {
  if (!isObj(raw)) { if (raw !== undefined) skipped.push(path || '(root)'); return tpl; }
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(tpl)) out[k] = coerceValue(tpl[k], raw[k], path ? `${path}.${k}` : k, skipped);
  for (const k of Object.keys(raw)) if (!(k in tpl)) skipped.push(path ? `${path}.${k}` : k);
  return out;
}

export function coerceForm(raw: unknown): { form: PogsForm; skipped: string[] } {
  const skipped: string[] = [];
  // Future schema migrations go here, keyed on (raw as any).schemaVersion.
  const candidate = isObj(raw) ? coerceObject(emptyForm() as unknown as Record<string, unknown>, raw, '', skipped) : emptyForm();
  return { form: pogsFormSchema.parse(candidate), skipped };
}

export function serializeForm(form: PogsForm): string {
  return JSON.stringify(form, null, 2);
}

export function parseFormFile(text: string): { form: PogsForm; skipped: string[] } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('Not a valid JSON file'); }
  if (!isObj(raw)) throw new Error('Not a POGS form file');
  return coerceForm(raw);
}

export function safeStorage(): Storage | null {
  try {
    const st = window.localStorage;
    st.setItem('pogs:probe', '1'); st.removeItem('pogs:probe');
    return st;
  } catch { return null; }
}

export function saveDraft(form: PogsForm, store: Storage | null = safeStorage()): boolean {
  if (!store) return false;
  try { store.setItem(DRAFT_KEY, JSON.stringify(form)); return true; } catch { return false; }
}

export function loadDraft(store: Storage | null = safeStorage()): PogsForm | null {
  if (!store) return null;
  try {
    const text = store.getItem(DRAFT_KEY);
    return text ? coerceForm(JSON.parse(text)).form : null;
  } catch { return null; }
}

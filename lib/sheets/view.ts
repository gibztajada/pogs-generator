export function getPath(obj: unknown, key: string): unknown {
  let cur: unknown = obj;
  for (const part of key.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function asText(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string').join(', ');
  return '';
}

export function isChecked(v: unknown, expected?: string): boolean {
  if (expected === undefined) return Array.isArray(v) ? v.length > 0 : Boolean(v);
  return Array.isArray(v) ? v.includes(expected) : v === expected;
}

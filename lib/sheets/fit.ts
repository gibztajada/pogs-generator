// Deterministic (server-safe) fitting using an average Arial glyph width.
const AVG = 0.52;
export const LINE = 1.15;
export const ASCENT = 0.905;

export const estimateWidth = (text: string, size: number) => text.length * size * AVG;

export function wrap(text: string, width: number, size: number): string[] {
  const maxChars = Math.max(1, Math.floor(width / (size * AVG)));
  const out: string[] = [];
  for (const para of text.replace(/\r/g, '').split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (next.length > maxChars && line) { out.push(line); line = w; } else line = next;
    }
    out.push(line);
  }
  return out;
}

export function fitText(text: string, width: number, height: number, base: number, min = 3): { size: number; lines: string[] } {
  let size = base;
  for (;;) {
    const lines = wrap(text, width, size);
    if (lines.length * size * LINE <= height || size <= min) return { size, lines };
    size = Math.max(min, Math.round(size * 0.92 * 100) / 100);
  }
}

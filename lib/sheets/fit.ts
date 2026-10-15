// Deterministic (server-safe) fitting using Helvetica/Arial glyph advance widths.
import { charWidth } from './metrics';

export const LINE = 1.15;
export const ASCENT = 0.905;

export function estimateWidth(text: string, size: number, bold = false): number {
  let units = 0;
  for (const ch of text) units += charWidth(ch, bold);
  return (units * size) / 1000;
}

export function wrap(text: string, width: number, size: number, bold = false): string[] {
  const out: string[] = [];
  for (const para of text.replace(/\r/g, '').split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (line && estimateWidth(next, size, bold) > width) { out.push(line); line = w; } else line = next;
    }
    out.push(line);
  }
  return out;
}

export function fitText(
  text: string, width: number, height: number, base: number, min = 3, bold = false,
): { size: number; lines: string[] } {
  let size = base;
  for (;;) {
    const lines = wrap(text, width, size, bold);
    if (lines.length * size * LINE <= height || size <= min) return { size, lines };
    size = Math.max(min, Math.round(size * 0.92 * 100) / 100);
  }
}

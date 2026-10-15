import { describe, expect, it } from 'vitest';
import { emptyForm } from '@/lib/defaults';
import { renderSheetsHtml } from '@/lib/pdf/renderHtml';

describe('renderSheetsHtml', () => {
  const html = renderSheetsHtml(emptyForm());
  it('embeds Arimo 400 and 700 as base64 woff2', () => {
    const faces = [...html.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
    for (const w of ['400', '700']) {
      const face = faces.find((f) => f.includes(`font-weight: ${w};`));
      expect(face, `weight ${w}`).toBeDefined();
      expect(face).toContain("font-family: 'Arimo'");
      expect(face).toMatch(/url\(data:font\/woff2;base64,[A-Za-z0-9+/=]{100,}\)/);
    }
  });
  it('resolves the sheet font-family to Arimo first', () => {
    const fams = [...html.matchAll(/font-family="([^"]+)"/g)].map((m) => m[1]);
    expect(fams.length).toBeGreaterThan(0);
    for (const f of fams) expect(f.split(',')[0].trim()).toBe('Arimo');
  });
});

import { useId, type ReactNode } from 'react';
import glyphs from './templates/glyphs.json';
import type { SheetAssets, Template, TplField } from './template';
import { asText, getPath, isChecked } from './view';
import { ASCENT, LINE, estimateWidth, fitText } from './fit';

const FONT = 'Arimo, Arial, Helvetica, sans-serif';

function Field({ f, view, clipId }: { f: TplField; view: unknown; clipId: string }) {
  const text = asText(getPath(view, f.k));
  if (!text.trim()) return null;
  const weight = f.b ? 700 : 400;
  if (f.ml && f.w && f.h) {
    const { size, lines } = fitText(text, f.w, f.h, f.s, 3, f.b);
    return (
      <g clipPath={`url(#${clipId})`}>
        <clipPath id={clipId}><rect x={f.x} y={f.y} width={f.w} height={f.h} /></clipPath>
        <text fontSize={size} fontWeight={weight} style={{ whiteSpace: 'pre' }}>
          {lines.map((ln, i) => <tspan key={i} x={f.x} y={f.y + size * ASCENT + i * size * LINE}>{ln}</tspan>)}
        </text>
      </g>
    );
  }
  const anchor = f.al === 'r' ? 'end' : f.al === 'c' ? 'middle' : undefined;
  const squeeze = f.w && estimateWidth(text, f.s, f.b) > f.w ? { textLength: f.w, lengthAdjust: 'spacingAndGlyphs' as const } : {};
  return (
    <text x={f.x} y={f.y} fontSize={f.s} fontWeight={weight} textAnchor={anchor} style={{ whiteSpace: 'pre' }} {...squeeze}>
      {text}
    </text>
  );
}

export function TemplatePage({ template: t, view, assets, fluid, children }: {
  template: Template; view: unknown; assets: SheetAssets; fluid?: boolean; children?: ReactNode;
}) {
  // Unique per rendered sheet: the same page is mounted twice (preview + print), and url(#id) must not collide.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const tr = t.transform
    ? `translate(${t.transform.ox} ${t.transform.oy}) scale(${t.transform.k}) translate(${-t.transform.ox} ${-t.transform.oy})`
    : undefined;
  return (
    <svg className="sheet" xmlns="http://www.w3.org/2000/svg"
      width={fluid ? '100%' : `${t.width}pt`} height={fluid ? undefined : `${t.height}pt`}
      viewBox={`0 0 ${t.width} ${t.height}`} fontFamily={FONT}>
      <rect width={t.width} height={t.height} fill="#ffffff" />
      <g transform={tr}>
        {t.paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.fill ?? 'none'} stroke={p.stroke ?? 'none'} strokeWidth={p.sw} fillRule={p.evenOdd ? 'evenodd' : 'nonzero'} />
        ))}
        {t.images.map((im, i) => (
          <image key={i} href={assets[im.src]} x={im.x} y={im.y} width={im.w} height={im.h} preserveAspectRatio="none" />
        ))}
        {t.texts.map((x, i) => (
          <text key={i} x={x.x} y={x.y} fontSize={x.s} fontWeight={x.b ? 700 : 400} fontStyle={x.i ? 'italic' : undefined}
            fill={x.c ?? '#000000'} style={{ whiteSpace: 'pre' }}>{x.t}</text>
        ))}
        {t.checks.map((c, i) => {
          const on = isChecked(getPath(view, c.k), c.v);
          if (c.ow && !on) return null;
          const g = on ? glyphs.checked : glyphs.unchecked;
          return <path key={i} d={g.d} transform={`translate(${c.x} ${c.y}) scale(${c.w} ${c.h})`} fill="#000000" fillRule={g.evenOdd ? 'evenodd' : 'nonzero'} />;
        })}
        {t.marks.map((m, i) => (getPath(view, m.k) === m.v
          ? <text key={i} x={m.x} y={m.y} fontSize={m.s} fontWeight={m.b ? 700 : 400}>X</text>
          : null))}
        {t.fields.map((f, i) => <Field key={i} f={f} view={view} clipId={`c${uid}p${t.page}f${i}`} />)}
        {children}
      </g>
    </svg>
  );
}

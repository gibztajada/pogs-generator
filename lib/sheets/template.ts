export type TplPath = { d: string; fill?: string; stroke?: string; sw?: number; evenOdd?: boolean };
export type TplText = { t: string; x: number; y: number; s: number; b?: boolean; i?: boolean; c?: string };
/** Single-line: (x, y) = baseline origin (x = right edge when al='r'). Multiline (ml): (x, y, w, h) = box. */
export type TplField = { k: string; x: number; y: number; s: number; b?: boolean; w?: number; h?: number; ml?: boolean; al?: 'l' | 'r' | 'c' };
export type TplCheck = { k: string; v?: string; x: number; y: number; w: number; h: number; ow?: boolean };
export type TplMark = { k: string; v: string; x: number; y: number; s: number; b?: boolean };
export type TplImage = { src: string; x: number; y: number; w: number; h: number };
/** Labor chart, all coordinates in reference (untransformed) space. dil plots v in [vMin, vMax]; stn plots v in [vBottom, vTop].
 *  Markers: an `outer`-pt square filled `outline` under an `inner`-pt square filled `color`, both centred on the point. */
export type TplChart = {
  dil: { hourX: [number, number]; vMin: number; yMin: number; vMax: number; yMax: number };
  stn: { hourX: [number, number]; vTop: number; yTop: number; vBottom: number; yBottom: number };
  color: string; outline: string; inner: number; outer: number;
};
export type Template = {
  page: number; width: number; height: number;
  transform?: { k: number; ox: number; oy: number };
  paths: TplPath[]; texts: TplText[]; fields: TplField[]; checks: TplCheck[]; marks: TplMark[]; images: TplImage[];
  chart?: TplChart;
};
export type SheetAssets = Record<string, string>;

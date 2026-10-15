export type TplPath = { d: string; fill?: string; stroke?: string; sw?: number; evenOdd?: boolean };
export type TplText = { t: string; x: number; y: number; s: number; b?: boolean; i?: boolean; c?: string };
/** Single-line: (x, y) = baseline origin (x = right edge when al='r'). Multiline (ml): (x, y, w, h) = box. */
export type TplField = { k: string; x: number; y: number; s: number; b?: boolean; w?: number; h?: number; ml?: boolean; al?: 'l' | 'r' | 'c' };
export type TplCheck = { k: string; v?: string; x: number; y: number; w: number; h: number; ow?: boolean };
export type TplMark = { k: string; v: string; x: number; y: number; s: number; b?: boolean };
export type TplImage = { src: string; x: number; y: number; w: number; h: number };
export type TplChart = { hourX: [number, number]; dil: { y3: number; y10: number }; stn: { y0: number; yMinus5: number }; color: string };
export type Template = {
  page: number; width: number; height: number;
  transform?: { k: number; ox: number; oy: number };
  paths: TplPath[]; texts: TplText[]; fields: TplField[]; checks: TplCheck[]; marks: TplMark[]; images: TplImage[];
  chart?: TplChart;
};
export type SheetAssets = Record<string, string>;

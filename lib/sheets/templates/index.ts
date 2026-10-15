import type { Template } from '../template';
import p1 from './page1.json';
import p2 from './page2.json';
import p3 from './page3.json';
import p4 from './page4.json';
import p5 from './page5.json';
import p6 from './page6.json';

export const TEMPLATES = { 1: p1, 2: p2, 3: p3, 4: p4, 5: p5, 6: p6 } as unknown as Record<number, Template>;
export const PAGE_NUMBERS = [1, 2, 3, 4, 5, 6] as const;

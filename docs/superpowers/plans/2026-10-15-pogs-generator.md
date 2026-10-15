# POGS Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Next.js app where a user fills a structured form and downloads the 6-page VSMMC POGS Obstetrical Sheet as an A4 PDF that matches the reference PDFs pixel-for-pixel.

**Architecture:** A dev-time Python builder (PyMuPDF) converts each reference PDF page into a JSON template (vector paths, static labels, images, checkbox slots, field slots), using a git-ignored fixture of the reference patient to locate value positions and a committed per-page mapping to name them. A generic React `<TemplatePage>` renders template + form values as SVG; the same component powers the live preview, browser print, and the server PDF (Puppeteer).

**Tech Stack:** Next.js (latest, App Router + one Pages API route), TypeScript, Tailwind, React Hook Form, Zod 3, puppeteer-core + @sparticuz/chromium, Vitest, Playwright (local Chrome), pixelmatch 5 + pngjs, pdf-lib (tests), Python 3.13 + PyMuPDF + pytest.

**Spec:** `docs/superpowers/specs/2026-10-15-pogs-generator-design.md`

## Global Constraints

- Paper: A4, 595 × 842 pt portrait; SVG viewBox `0 0 595 842`, rendered at `595pt × 842pt`.
- Font: Arimo 400/700 (bundled woff2) — never rely on system Arial.
- Sizes/weights: labels keep extracted size/weight exactly; field slots take the size/weight of the reference value they replace.
- Page 4: scaled about the frame's top-left so its right edge lands at 578.3 pt; nothing outside the frame is printed.
- Real patient data (`*.pdf`, `fixtures/`, `tests/fidelity/reference/`, `tests/fidelity/output/`) is never committed. Committed sample data is fictitious.
- No request body or patient field is ever logged server-side.
- Fidelity acceptance: per-page pixel mismatch ratio < 0.015 at device scale 2 vs references rasterized at 192 dpi.
- Node 22, npm. Python is run from the scratchpad dir with absolute script paths (`python "<abs path>"`), never `python -I` (PyMuPDF lives in user site-packages).
- `$ROOT` = `C:/Users/Asus/OneDrive/Desktop/Personal Projects/POGS Generator` (always quoted). `$SCRATCH` = the session scratchpad directory.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Before every commit run `git status --short` and confirm no `*.pdf`, `fixtures/`, or `tests/fidelity/{reference,output}` paths are staged.

## Review Focus

1. **PHI leaking into committed templates** — a reference value span not claimed by a mapping stays as a static label. Expect: builder fails on unclaimed fixture values ≥ 4 chars (Task 6 test); PHI guard fails if any fixture value ≥ 5 chars appears in any template label (Task 7 test).
2. **Long free text** (HPI, final diagnosis, past history) never spills out of its box or moves layout. Expect: shrink-to-fit to 3 pt, then clip. Tests in Task 7 (`fit.test.ts`, TemplatePage multiline test).
3. **Malformed or old `.json` loaded** (wrong types, extra rows, unknown keys, not JSON). Expect: valid fields load, others reported skipped; non-JSON shows an error and leaves the form untouched. Tests in Task 4 and Task 17.
4. **Table overflow** — > 13 OB-history/monitoring rows; labor table ≠ 11 rows. Expect: truncate to 13 with skipped report; labor table padded/truncated to 11. Tests in Task 4.
5. **Server PDF unavailable or bad input** (Chromium missing, timeout, wrong shapes, blank last name). Expect: 400/500 JSON errors, UI toast with one-click Print, nothing logged. Tests in Task 16.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/schema.ts` | Zod schema, `PogsForm` + row types |
| `lib/options.ts` | Checkbox option lists |
| `lib/defaults.ts` | `emptyForm()`, `sampleForm()`, row factories |
| `lib/derive.ts` | `buildView`, `footerOf`, `computeBmi`, `seedObHistory`, `laborPoints` |
| `lib/storage.ts` | `coerceForm`, `serializeForm`, `parseFormFile`, draft load/save |
| `lib/sheets/template.ts` | Template JSON types |
| `lib/sheets/view.ts` | `getPath`, `asText`, `isChecked` |
| `lib/sheets/fit.ts` | `wrap`, `fitText`, `estimateWidth` |
| `lib/sheets/TemplatePage.tsx` | Template + view → SVG |
| `lib/sheets/LaborChart.tsx` | Page 4 data series |
| `lib/sheets/Sheet.tsx` | `Sheet`, `AllSheets` |
| `lib/sheets/templates/*.json`, `index.ts` | Generated templates, glyphs |
| `lib/sheets/assets.ts` | App asset URLs |
| `lib/pdf/renderHtml.tsx`, `lib/pdf/browser.ts` | Self-contained HTML, Chromium PDF |
| `pages/api/pdf.ts` | PDF endpoint |
| `app/page.tsx`, `app/dev/sheet/[page]/page.tsx` | App, dev-only sheet route |
| `components/PogsApp.tsx`, `components/Toast.tsx`, `components/form/*` | App shell, config-driven form, preview, toolbar |
| `scripts/pdfref/*.py`, `scripts/pdfref/mappings/*.json` | Reference tooling, per-page mappings |
| `scripts/dump-view.ts` | Fixture → flat view JSON for the builder |

---

### Task 1: Scaffold Next.js app and tooling

**Files:**
- Create: Next.js scaffold at `$ROOT` (`package.json`, `app/`, `tsconfig.json`, `next.config.ts`, …), `vitest.config.ts`, `playwright.config.ts`, `vercel.json`, `public/fonts/arimo-400.woff2`, `public/fonts/arimo-700.woff2`, `tests/unit/smoke.test.ts`
- Modify: `.gitignore` (merge scaffold entries)

**Interfaces:**
- Produces: `npm run dev|build|test|test:e2e|test:fidelity`, alias `@/*` → project root, fonts served at `/fonts/arimo-{400,700}.woff2`.

- [ ] **Step 1: Scaffold in the scratch dir** (the project folder name has spaces/caps — invalid npm name)

```bash
cd "$SCRATCH" && npx create-next-app@latest pogs-generator --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes
```

- [ ] **Step 2: Copy scaffold into the project** (skip `.git`, `node_modules`, `.gitignore`)

```bash
cd "$SCRATCH/pogs-generator" && tar --exclude=node_modules --exclude=.git --exclude=.gitignore -cf - . | (cd "$ROOT" && tar -xf -)
```
Append scaffold `.gitignore` lines missing from `$ROOT/.gitignore`, keeping the existing PHI block at the top. Change `"name"` in `package.json` to `"pogs-generator"` if different.

- [ ] **Step 3: Install dependencies**

```bash
cd "$ROOT" && npm install && npm install zod@3.23.8 react-hook-form puppeteer-core @sparticuz/chromium && npm install -D vitest @vitejs/plugin-react @playwright/test pixelmatch@5.3.0 pngjs@7.0.0 @types/pngjs pdf-lib tsx @fontsource/arimo
```

- [ ] **Step 4: Copy fonts**

```bash
cd "$ROOT" && mkdir -p public/fonts && cp node_modules/@fontsource/arimo/files/arimo-latin-400-normal.woff2 public/fonts/arimo-400.woff2 && cp node_modules/@fontsource/arimo/files/arimo-latin-700-normal.woff2 public/fonts/arimo-700.woff2
```
If the names differ: `ls node_modules/@fontsource/arimo/files | grep latin-` and use the `latin-400-normal` / `latin-700-normal` woff2 files.

- [ ] **Step 5: Config files**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname) } },
  test: { include: ['tests/unit/**/*.test.{ts,tsx}'], environment: 'node' },
});
```

`playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 120_000,
  use: { baseURL: 'http://localhost:3000', channel: 'chrome' },
  projects: [
    { name: 'fidelity', testMatch: 'fidelity/**/*.spec.ts', use: { deviceScaleFactor: 2, viewport: { width: 900, height: 1200 } } },
    { name: 'api', testMatch: 'api/**/*.spec.ts' },
    { name: 'e2e', testMatch: 'e2e/**/*.spec.ts', use: { viewport: { width: 1400, height: 900 } } },
  ],
  webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 120_000 },
});
```

`vercel.json`:
```json
{ "functions": { "pages/api/pdf.ts": { "maxDuration": 60, "memory": 1769 } } }
```

`next.config.ts` (replace scaffold content):
```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: { '/api/pdf': ['./public/fonts/**', './public/sheet-assets/**'] },
};
export default nextConfig;
```

Add to `package.json` scripts: `"test": "vitest run"`, `"test:e2e": "playwright test"`, `"test:fidelity": "playwright test --project=fidelity"`, `"dump-view": "tsx scripts/dump-view.ts"`.

- [ ] **Step 6: Smoke test** — `tests/unit/smoke.test.ts`:
```ts
import { expect, test } from 'vitest';
test('vitest runs', () => expect(1 + 1).toBe(2));
```
Run: `npm test` → PASS. Run: `npm run build` → succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A && git status --short   # verify: no *.pdf, no fixtures/
git commit -m "chore: scaffold Next.js app with test tooling and Arimo fonts"
```

---

### Task 2: Schema, options, defaults

**Files:**
- Create: `lib/schema.ts`, `lib/options.ts`, `lib/defaults.ts`
- Test: `tests/unit/defaults.test.ts`

**Interfaces:**
- Produces: `pogsFormSchema`; types `PogsForm`, `ObHistoryRow`, `LaborRow`, `MonitoringRow`, `CsBlock`; `emptyForm()`, `sampleForm()`, `emptyObRow()`, `emptyLaborRow()`, `emptyMonitoringRow()`; `MAX_TABLE_ROWS = 13`, `LABOR_ROWS = 11`; option arrays (all `string[]`) in `lib/options.ts`.

- [ ] **Step 1: Write the failing test** — `tests/unit/defaults.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { emptyForm, sampleForm, LABOR_ROWS } from '@/lib/defaults';
import { pogsFormSchema } from '@/lib/schema';

describe('defaults', () => {
  test('emptyForm satisfies schema', () => {
    expect(pogsFormSchema.safeParse(emptyForm()).success).toBe(true);
  });
  test('sampleForm satisfies schema and is fictitious', () => {
    const s = sampleForm();
    expect(pogsFormSchema.safeParse(s).success).toBe(true);
    expect(s.patient.lastName).toBe('DELA CRUZ');
  });
  test('labor table always has 11 rows', () => {
    expect(emptyForm().page4.laborTable).toHaveLength(LABOR_ROWS);
  });
  test('emptyForm returns fresh objects', () => {
    const a = emptyForm(); a.page1.contraception.push('Pills');
    expect(emptyForm().page1.contraception).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test -- defaults` → FAIL (module not found).

- [ ] **Step 3: Implement `lib/options.ts`**
```ts
export const CIVIL_STATUS = ['M', 'S', 'W', 'Sep'];
export const FAMILY_SIZE = ['1', '2', '3', '4', 'more'];
export const CONTRACEPTION = ['None', 'Pills', 'IUD', 'Rhythm', 'Condom'];
export const EDUCATION = ['None', 'Primary', 'Secondary', 'College'];
export const SOCIO = ['Dependent/Unemployed', 'Employed', 'Self-Employed'];
export const INCOME = ['Below minimum wage', 'Minimum wage', 'Above minimum'];
export const ANTENATAL_VISITS = ['None', '1', '2', '3', '4', '5', '>5'];
export const PROVIDER = ['MD', 'MW', 'Others'];
export const IMMUNIZATIONS = ['TT', 'Td', 'Tdap', 'Hep B', 'Others'];
export const SUPPLEMENTS = ['Vitamins', 'Fe', 'Ca', 'Others'];
export const ANTENATAL_RISKS = [
  'Anemia', 'HTN/Preclampsia/CHVD', 'Fetal Wastage', 'Previous CS/Surgery', 'Cardiac', 'Premature labor',
  'UTI', 'Renal', 'IUGR', 'Infections LC Tracts', 'Diabetes Mellitus', 'Infertility',
  'Nutritional (1/2-21 lbs/wk)', 'Respiratory', 'Others',
];
export const GENERAL_STATUS = ['Conscious', 'Coherent', 'Unconscious', 'Distressed', 'Anxious', 'Cooperative', 'Pale/Flushed', 'Others'];
export const CERVIX_POSITION = ['Anterior', 'Midposition', 'Posterior'];
export const MEMBRANES = ['Intact', 'Ruptured'];
export const AMNIOTIC_FLUID = ['Meconium Stained', 'Clear'];
export const PELVIMETRY = ['Contracted', 'Border Line', 'Adequate'];
export const PELVIC_PLANES = ['Inlet', 'Midplane', 'Outlet'];
export const MEMBRANE_STATUS = ['Ruptured', 'Intact'];
export const RUPTURE_TYPE = ['PROM', 'EROM', 'Cord Prolapse', 'Amnionitis', 'Amniotomy', 'Spontaneous'];
export const FLUID = ['Clear', 'Meconium Stained'];
export const MECONIUM = ['Thick', 'Thin'];
export const PROGRESS = ['Normal', 'Abnormal'];
export const ABNORMAL_TYPE = ['Precipitate', 'Prolonged', 'Protracted'];
export const FETAL = ['Normal', 'Distress'];
export const VAGINAL_METHOD = [
  'Spontaneous', 'Assisted vaginal delivery', 'Vacuum', 'Forceps', 'Breech delivery',
  'Breech Spontaneous', 'Breech Partial', 'Breech Total', 'Vaginal birth after CS',
  'Anesthesia', 'Anesthesia Local', 'Anesthesia TIVA', 'Anesthesia Regional', 'Anesthesia Inhalational/GA',
];
export const EPISIOTOMY = ['Median', 'Mediolateral'];
export const CS_INCISION = ['Low Transverse', 'Low Vertical', 'Classical'];
export const HYSTERECTOMY = ['Total', 'Sub-Total'];
export const PLACENTA_METHOD = ['Spontaneous', 'Controlled Cord Traction', 'Manual Extraction'];
export const PERINEAL = ['1st Degree', '2nd Degree', '3rd Degree', '4th Degree'];
export const ANESTHESIA = ['Local Infiltration', 'Regional', 'General'];
export const CONDITION = ['Good', 'Fair', 'Poor'];
```

- [ ] **Step 4: Implement `lib/schema.ts`**
```ts
import { z } from 'zod';

const s = z.string();
const list = z.array(z.string());

export const obHistoryRowSchema = z.object({
  order: s, outcome: s, year: s, gestation: s, sex: s, birthWeight: s, status: s, complications: s,
});
export const laborRowSchema = z.object({ dilatation: s, station: s });
export const monitoringRowSchema = z.object({
  dateTime: s, bp: s, hr: s, rr: s, temp: s, uo: s, fht: s, intv: s, dur: s, int: s,
  dil: s, eff: s, pres: s, stn: s, mem: s, nstCtg: s, remarks: s,
});
export const csSchema = z.object({ checked: z.boolean(), incision: s, tubalLigation: z.boolean(), indication: s });

export const pogsFormSchema = z.object({
  schemaVersion: z.literal(1),
  patient: z.object({
    lastName: s, firstName: s, middleName: s, age: s, civilStatus: s, hospNo: s, caseNo: s, room: s,
    address: s, admissionDateTime: s,
  }),
  page1: z.object({
    admittingImpression: s, finalDiagnosis: s, bloodType: s, rh: s, vdrl: s, hbsag: s, antibodies: s,
    chiefComplaint: s,
    obScore: z.object({ g: s, p: s, ft: s, pr: s, ab: s, l: s }),
    obHistory: z.array(obHistoryRowSchema),
    desiredFamilySize: s, contraception: list, education: s, socioEconomic: s, income: s,
    lmp: s, edc: s, pmp: s, aog: s, ultrasoundDate: s, quickeningDate: s, adjustedEdc: s, aogByUltrasound: s,
    menarche: s, interval: s, duration: s, amount: s, dysmenorrhea: s,
    coitarche: s, sexualPartners: s, stis: s, papsmear: s,
    antenatalVisits: s, provider: list, immunizations: list,
    totalWeightGain: s, usualBp: s, hb: s, hct: s, urineChon: s, fbs: s, ogtt: s,
    supplements: list, supplementsOther: s,
  }),
  page2: z.object({
    antenatalRisks: list, antenatalRisksOther: s, hpi: s, pastHistory: s, familyHistory: s,
    personalSocialHistory: s, occupation: s, alcohol: s, tobacco: s, drugAllergies: s, drugTherapy: s,
    otherAllergies: s,
  }),
  page3: z.object({
    examDate: s, examTime: s, examiner: s, bp: s, hr: s, rr: s, temp: s, wt: s, ht: s, bmi: s, ps: s, gcs: s,
    generalStatus: list, heent: s, breast: s, chestLungs: s, cardiovascular: s, abdomen: s,
    fh: s, efw: s, fht: s, l1: s, l2: s, l3: s, l4: s,
    genitourinary: s, musculoskeletal: s, extremities: s, cns: s,
    externalGenitals: s, uterus: s, vagina: s, dilatation: s, effacement: s, position: s, membranes: s,
    amnioticFluid: s, station: s, pelvimetry: s, pelvimetryPlanes: list,
    planOfCare: s, referredFromTo: s, historyBy: s, doneOn: s,
  }),
  page4: z.object({
    onsetDate: s, onsetTime: s, fullDilatation: s, delivery: s, placenta: s,
    totalDuration: s, firstStage: s, secondStage: s, thirdStage: s,
    laborTable: z.array(laborRowSchema),
    membranesStatus: s, ruptureType: list, promHours: s, fluid: s, meconium: s,
    progress: s, abnormalType: s, fetal: s,
  }),
  page5: z.object({
    fetusDate: s, fetusTime: s, attendedBy: s, vaginalMethod: list, episiotomy: s,
    primaryCs: csSchema, repeatCs: csSchema,
    csHysterectomy: z.object({ checked: z.boolean(), type: s }),
    placentaDate: s, placentaTime: s, placentaBy: s, placentaMethod: s,
    postpartumBp: s, bloodLoss: s, perinealRepair: s, anesthesia: s, complications: s,
    postpartumCondition: s, babySex: s, babyWeight: s, babyLength: s, apgar1: s, apgar5: s,
    pediatricAging: s, resuscitations: s, sga: s, aga: s, lga: s, abnormalities: s,
  }),
  page6: z.object({ attendingPhysicians: s, monitoring: z.array(monitoringRowSchema) }),
});

export type PogsForm = z.infer<typeof pogsFormSchema>;
export type ObHistoryRow = z.infer<typeof obHistoryRowSchema>;
export type LaborRow = z.infer<typeof laborRowSchema>;
export type MonitoringRow = z.infer<typeof monitoringRowSchema>;
export type CsBlock = z.infer<typeof csSchema>;
```

- [ ] **Step 5: Implement `lib/defaults.ts`**
```ts
import type { CsBlock, LaborRow, MonitoringRow, ObHistoryRow, PogsForm } from './schema';

export const MAX_TABLE_ROWS = 13;
export const LABOR_ROWS = 11;

export const emptyObRow = (): ObHistoryRow => ({
  order: '', outcome: '', year: '', gestation: '', sex: '', birthWeight: '', status: '', complications: '',
});
export const emptyLaborRow = (): LaborRow => ({ dilatation: '', station: '' });
export const emptyMonitoringRow = (): MonitoringRow => ({
  dateTime: '', bp: '', hr: '', rr: '', temp: '', uo: '', fht: '', intv: '', dur: '', int: '',
  dil: '', eff: '', pres: '', stn: '', mem: '', nstCtg: '', remarks: '',
});
const emptyCs = (): CsBlock => ({ checked: false, incision: '', tubalLigation: false, indication: '' });

export function emptyForm(): PogsForm {
  return {
    schemaVersion: 1,
    patient: { lastName: '', firstName: '', middleName: '', age: '', civilStatus: '', hospNo: '', caseNo: '', room: '', address: '', admissionDateTime: '' },
    page1: {
      admittingImpression: '', finalDiagnosis: '', bloodType: '', rh: '', vdrl: '', hbsag: '', antibodies: '', chiefComplaint: '',
      obScore: { g: '', p: '', ft: '', pr: '', ab: '', l: '' },
      obHistory: [],
      desiredFamilySize: '', contraception: [], education: '', socioEconomic: '', income: '',
      lmp: '', edc: '', pmp: '', aog: '', ultrasoundDate: '', quickeningDate: '', adjustedEdc: '', aogByUltrasound: '',
      menarche: '', interval: '', duration: '', amount: '', dysmenorrhea: '',
      coitarche: '', sexualPartners: '', stis: '', papsmear: '',
      antenatalVisits: '', provider: [], immunizations: [],
      totalWeightGain: '', usualBp: '', hb: '', hct: '', urineChon: '', fbs: '', ogtt: '',
      supplements: [], supplementsOther: '',
    },
    page2: {
      antenatalRisks: [], antenatalRisksOther: '', hpi: '', pastHistory: '', familyHistory: '', personalSocialHistory: '',
      occupation: '', alcohol: '', tobacco: '', drugAllergies: '', drugTherapy: '', otherAllergies: '',
    },
    page3: {
      examDate: '', examTime: '', examiner: '', bp: '', hr: '', rr: '', temp: '', wt: '', ht: '', bmi: '', ps: '', gcs: '',
      generalStatus: [], heent: '', breast: '', chestLungs: '', cardiovascular: '', abdomen: '',
      fh: '', efw: '', fht: '', l1: '', l2: '', l3: '', l4: '',
      genitourinary: '', musculoskeletal: '', extremities: '', cns: '',
      externalGenitals: '', uterus: '', vagina: '', dilatation: '', effacement: '', position: '', membranes: '',
      amnioticFluid: '', station: '', pelvimetry: '', pelvimetryPlanes: [],
      planOfCare: '', referredFromTo: '', historyBy: '', doneOn: '',
    },
    page4: {
      onsetDate: '', onsetTime: '', fullDilatation: '', delivery: '', placenta: '',
      totalDuration: '', firstStage: '', secondStage: '', thirdStage: '',
      laborTable: Array.from({ length: LABOR_ROWS }, emptyLaborRow),
      membranesStatus: '', ruptureType: [], promHours: '', fluid: '', meconium: '',
      progress: '', abnormalType: '', fetal: '',
    },
    page5: {
      fetusDate: '', fetusTime: '', attendedBy: '', vaginalMethod: [], episiotomy: '',
      primaryCs: emptyCs(), repeatCs: emptyCs(), csHysterectomy: { checked: false, type: '' },
      placentaDate: '', placentaTime: '', placentaBy: '', placentaMethod: '',
      postpartumBp: '', bloodLoss: '', perinealRepair: '', anesthesia: '', complications: '',
      postpartumCondition: '', babySex: '', babyWeight: '', babyLength: '', apgar1: '', apgar5: '',
      pediatricAging: '', resuscitations: '', sga: '', aga: '', lga: '', abnormalities: '',
    },
    page6: { attendingPhysicians: '', monitoring: [] },
  };
}

/** Fictitious patient for demos. Never replace with real data. */
export function sampleForm(): PogsForm {
  const f = emptyForm();
  f.patient = {
    lastName: 'DELA CRUZ', firstName: 'MARIA', middleName: 'SANTOS', age: '29', civilStatus: 'M',
    hospNo: '1000000001', caseNo: '10001', room: 'PS100', address: 'Sample St., Barangay Uno, Cebu City',
    admissionDateTime: 'January 5, 2026 at 8:00 AM',
  };
  Object.assign(f.page1, {
    admittingImpression: 'G2P1 (1001) pregnancy uterine 39 weeks AOG, cephalic, in active labor',
    finalDiagnosis: 'G2P2 (2002) pregnancy uterine delivered by normal spontaneous delivery to a live term female neonate',
    bloodType: 'A', rh: 'POSITIVE', hbsag: 'NR', chiefComplaint: 'labor pains',
    obScore: { g: '2', p: '1', ft: '1', pr: '0', ab: '0', l: '1' },
    obHistory: [
      { order: 'G1', outcome: 'NSD', year: '2022', gestation: 'Term', sex: 'male', birthWeight: '3.1 kg', status: 'Living', complications: 'none' },
      { order: 'G2', outcome: 'current', year: '', gestation: '', sex: '', birthWeight: '', status: '', complications: '' },
    ],
    desiredFamilySize: '2', contraception: ['Pills'], education: 'College', socioEconomic: 'Employed', income: 'Minimum wage',
    lmp: '4/10/2025', edc: '1/15/2026', aog: '39 weeks', menarche: '12', interval: 'regular', duration: '3-5 days',
    amount: '2 pads', dysmenorrhea: 'No', coitarche: '20', sexualPartners: '1', stis: 'None', papsmear: 'None',
    antenatalVisits: '>5', provider: ['MD'], supplements: ['Fe', 'Ca'],
  });
  Object.assign(f.page2, {
    hpi: 'Onset of regular uterine contractions 6 hours prior to admission.',
    pastHistory: 'Non hypertensive\nNon diabetic', familyHistory: 'None', personalSocialHistory: 'Non smoker',
    occupation: 'Teacher', alcohol: 'None', tobacco: 'None', drugAllergies: 'None', drugTherapy: 'None', otherAllergies: 'None',
  });
  Object.assign(f.page3, {
    examDate: '01/05/2026', examTime: '8:00 AM', examiner: 'Dr. Sample', bp: '110/70', hr: '80', rr: '18', temp: '36.7',
    wt: '62', ht: '158', generalStatus: ['Conscious', 'Coherent'], abdomen: 'Gravid', fh: '33 cm', fht: '140s',
    dilatation: '5', effacement: '80%', station: '0', planOfCare: 'Admit to labor room', historyBy: 'Dr. Sample',
  });
  f.page4.laborTable[0] = { dilatation: '5', station: '0' };
  f.page4.laborTable[2] = { dilatation: '8', station: '+1' };
  f.page4.progress = 'Normal';
  f.page5.postpartumCondition = 'Good';
  f.page6.attendingPhysicians = 'DR. SAMPLE';
  return f;
}
```

- [ ] **Step 6: Run tests** — `npm test -- defaults` → PASS.

- [ ] **Step 7: Commit** — `git add lib tests/unit/defaults.test.ts && git commit -m "feat: add form schema, options, and defaults"`

---

### Task 3: Derived view

**Files:**
- Create: `lib/derive.ts`
- Test: `tests/unit/derive.test.ts`

**Interfaces:**
- Consumes: `PogsForm`, `ObHistoryRow`, `LaborRow`, `emptyObRow`, `MAX_TABLE_ROWS`.
- Produces: `type Footer`, `type SheetView = PogsForm & { footer: Footer }`, `type Pt = { h: number; v: number }`; `buildView(form): SheetView`; `footerOf(form): Footer`; `computeBmi(wt: string, ht: string): string`; `seedObHistory(rows, g: string): ObHistoryRow[]`; `laborPoints(table: LaborRow[]): { dil: Pt[]; stn: Pt[] }`.

- [ ] **Step 1: Write the failing test** — `tests/unit/derive.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { buildView, computeBmi, laborPoints, seedObHistory } from '@/lib/derive';
import { emptyForm, emptyLaborRow, emptyObRow } from '@/lib/defaults';

describe('computeBmi', () => {
  test('cm height', () => expect(computeBmi('81', '154')).toBe('34.2'));
  test('m height', () => expect(computeBmi('81', '1.54')).toBe('34.2'));
  test('blank or junk', () => {
    expect(computeBmi('', '154')).toBe('');
    expect(computeBmi('abc', '154')).toBe('');
    expect(computeBmi('81', '0')).toBe('');
  });
});

describe('buildView', () => {
  test('footer from patient, sex F', () => {
    const f = emptyForm();
    Object.assign(f.patient, { lastName: 'A', firstName: 'B', middleName: 'C', age: '30', hospNo: '9', room: 'R1' });
    expect(buildView(f).footer).toEqual({ surname: 'A', givenName: 'B', mi: 'C', age: '30', sex: 'F', hospNo: '9', ward: 'R1' });
  });
  test('bmi derived only when blank', () => {
    const f = emptyForm(); f.page3.wt = '81'; f.page3.ht = '154';
    expect(buildView(f).page3.bmi).toBe('34.2');
    f.page3.bmi = '30';
    expect(buildView(f).page3.bmi).toBe('30');
  });
  test('does not mutate input', () => {
    const f = emptyForm(); f.page3.wt = '81'; f.page3.ht = '154';
    buildView(f);
    expect(f.page3.bmi).toBe('');
  });
});

describe('seedObHistory', () => {
  test('adds G1..Gn keeping existing rows', () => {
    const rows = [{ ...emptyObRow(), order: 'G1', year: '2000' }];
    const out = seedObHistory(rows, '3');
    expect(out.map((r) => r.order)).toEqual(['G1', 'G2', 'G3']);
    expect(out[0].year).toBe('2000');
  });
  test('never shrinks, caps at 13', () => {
    const rows = Array.from({ length: 4 }, (_, i) => ({ ...emptyObRow(), order: `G${i + 1}` }));
    expect(seedObHistory(rows, '2')).toHaveLength(4);
    expect(seedObHistory([], '20')).toHaveLength(13);
    expect(seedObHistory([], 'x')).toHaveLength(0);
  });
});

describe('laborPoints', () => {
  test('numeric cells only, hour = index', () => {
    const t = Array.from({ length: 11 }, emptyLaborRow);
    t[0] = { dilatation: '2', station: '-3' };
    t[10] = { dilatation: '', station: '-5' };
    t[4] = { dilatation: 'n/a', station: '' };
    expect(laborPoints(t)).toEqual({ dil: [{ h: 0, v: 2 }], stn: [{ h: 0, v: -3 }, { h: 10, v: -5 }] });
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test -- derive` → FAIL.

- [ ] **Step 3: Implement `lib/derive.ts`**
```ts
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
```

- [ ] **Step 4: Run tests** — `npm test -- derive` → PASS.

- [ ] **Step 5: Commit** — `git add lib/derive.ts tests/unit/derive.test.ts && git commit -m "feat: add derived sheet view"`

---

### Task 4: Storage and coercion

**Files:**
- Create: `lib/storage.ts`
- Test: `tests/unit/storage.test.ts`

**Interfaces:**
- Consumes: `emptyForm`, row factories, `MAX_TABLE_ROWS`, `LABOR_ROWS`, `pogsFormSchema`.
- Produces: `coerceForm(raw: unknown): { form: PogsForm; skipped: string[] }`; `serializeForm(form): string`; `parseFormFile(text): { form; skipped }` (throws `Error('Not a valid JSON file')`); `DRAFT_KEY = 'pogs:draft:v1'`; `safeStorage(): Storage | null`; `saveDraft(form, store?): boolean`; `loadDraft(store?): PogsForm | null`.

- [ ] **Step 1: Write the failing test** — `tests/unit/storage.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { coerceForm, loadDraft, parseFormFile, saveDraft, serializeForm } from '@/lib/storage';
import { emptyForm, sampleForm } from '@/lib/defaults';

function memStore(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null,
    get length() { return m.size; },
  } as Storage;
}

describe('coerceForm', () => {
  test('round-trips a valid form with nothing skipped', () => {
    const r = coerceForm(JSON.parse(serializeForm(sampleForm())));
    expect(r.skipped).toEqual([]);
    expect(r.form).toEqual(sampleForm());
  });
  test('numbers become strings, wrong types skipped, unknown keys skipped', () => {
    const r = coerceForm({ patient: { age: 44, lastName: { x: 1 } }, bogus: 1 });
    expect(r.form.patient.age).toBe('44');
    expect(r.form.patient.lastName).toBe('');
    expect(r.skipped).toEqual(expect.arrayContaining(['patient.lastName', 'bogus']));
  });
  test('tables: truncated to 13, labor padded to 11', () => {
    const rows = Array.from({ length: 15 }, () => ({ order: 'G' }));
    const r = coerceForm({ page1: { obHistory: rows }, page4: { laborTable: [{ dilatation: 2 }] } });
    expect(r.form.page1.obHistory).toHaveLength(13);
    expect(r.form.page4.laborTable).toHaveLength(11);
    expect(r.form.page4.laborTable[0].dilatation).toBe('2');
    expect(r.skipped).toContain('page1.obHistory.13');
  });
  test('string lists drop non-strings', () => {
    const r = coerceForm({ page1: { contraception: ['Pills', 3, null] } });
    expect(r.form.page1.contraception).toEqual(['Pills', '3']);
    expect(r.skipped).toContain('page1.contraception.2');
  });
  test('booleans', () => {
    const r = coerceForm({ page5: { primaryCs: { checked: true, tubalLigation: 'yes' } } });
    expect(r.form.page5.primaryCs.checked).toBe(true);
    expect(r.form.page5.primaryCs.tubalLigation).toBe(false);
    expect(r.skipped).toContain('page5.primaryCs.tubalLigation');
  });
  test('non-object input gives empty form', () => {
    expect(coerceForm(null).form).toEqual(emptyForm());
  });
});

describe('parseFormFile', () => {
  test('throws on non-JSON', () => expect(() => parseFormFile('nope')).toThrow('Not a valid JSON file'));
});

describe('draft', () => {
  test('save then load', () => {
    const st = memStore();
    expect(saveDraft(sampleForm(), st)).toBe(true);
    expect(loadDraft(st)).toEqual(sampleForm());
  });
  test('no store → false / null', () => {
    expect(saveDraft(sampleForm(), null)).toBe(false);
    expect(loadDraft(null)).toBeNull();
  });
  test('corrupt draft → null', () => {
    const st = memStore(); st.setItem('pogs:draft:v1', '{bad');
    expect(loadDraft(st)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test -- storage` → FAIL.

- [ ] **Step 3: Implement `lib/storage.ts`**
```ts
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
```

- [ ] **Step 4: Run tests** — `npm test -- storage` → PASS.

- [ ] **Step 5: Commit** — `git add lib/storage.ts tests/unit/storage.test.ts && git commit -m "feat: add form coercion, JSON export/import, draft autosave"`

---

### Task 5: Reference tooling (assets, glyphs, dump, rasterize)

**Files:**
- Create: `scripts/pdfref/common.py`, `extract_assets.py`, `extract_glyphs.py`, `dump.py`, `rasterize.py`, `requirements.txt`, `scripts/pdfref/tests/test_common.py`
- Output (committed): `public/sheet-assets/header.png`, `public/sheet-assets/seal.png`, `lib/sheets/templates/glyphs.json`
- Output (git-ignored): `fixtures/ref/pageN.{spans,drawings}.tsv`, `tests/fidelity/reference/pageN.png`

**Interfaces:**
- Produces (`common.py`): `ROOT`, `REFS: dict[int, str]`, `ZOOM = 192/72`, `ref_page(n)`, `norm(s)`, `hexcolor(c)`, `path_d(items, ox=0, oy=0, sx=1, sy=1, prec=2) -> str`, `load_spans(page) -> list[dict]` (keys `text, chars, bbox, size, font, color, used, id`), `span_origin(span) -> (x, y)`, `span_bold(span) -> bool`, `is_checkbox(drawing) -> bool`.
- Produces `glyphs.json`: `{ "unchecked": {"d": str, "evenOdd": bool}, "checked": {...} }` in a unit box.

- [ ] **Step 1: Requirements** — `scripts/pdfref/requirements.txt`:
```
pymupdf>=1.24
pytest>=8
```
Run: `python -m pytest --version || pip install pytest`

- [ ] **Step 2: Write the failing test** — `scripts/pdfref/tests/test_common.py`:
```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import fitz
from common import norm, hexcolor, path_d, load_spans, span_origin, is_checkbox

_DOCS = []  # keep documents alive while pages are used


def make_pdf():
    doc = fitz.open()
    _DOCS.append(doc)
    page = doc.new_page(width=595, height=842)
    page.insert_text((50, 100), "LABEL:", fontname="hebo", fontsize=8)
    page.insert_text((90, 100), "Value", fontname="helv", fontsize=8)
    shp = page.new_shape()
    shp.draw_rect(fitz.Rect(30, 92, 36.3, 98.3), radius=0.2)
    shp.draw_rect(fitz.Rect(31, 93, 35.3, 97.3))
    shp.finish(fill=(0, 0, 0), color=None, even_odd=True)
    shp.draw_line((20, 120), (500, 120))
    shp.finish(color=(0, 0, 0), width=0.66)
    shp.commit()
    return page


def test_norm_and_color():
    assert norm("  A   b\n") == "a b"
    assert hexcolor((1, 0, 0)) == "#ff0000"
    assert hexcolor(0x00ff00) == "#00ff00"
    assert hexcolor(None) is None


def test_spans_and_origin():
    spans = load_spans(make_pdf())
    assert {"LABEL:", "Value"} <= {s["text"].strip() for s in spans}
    v = next(s for s in spans if s["text"].strip() == "Value")
    x, y = span_origin(v)
    assert abs(x - 90) < 0.5 and abs(y - 100) < 0.5


def test_checkbox_detection_and_path():
    drs = make_pdf().get_drawings()
    assert len([d for d in drs if is_checkbox(d)]) == 1
    line = next(d for d in drs if not is_checkbox(d))
    assert path_d(line["items"]).startswith("M20.0 120.0L500.0 120.0")
```
Run: `cd "$SCRATCH" && python -m pytest "$ROOT/scripts/pdfref/tests" -q` → FAIL (no module `common`).

- [ ] **Step 3: Implement `scripts/pdfref/common.py`**
```python
"""Shared helpers for reading the reference POGS PDFs with PyMuPDF."""
import re
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[2]
REFS = {
    1: "<reference patient> POGS 2 - Page 1.pdf",
    2: "<reference patient> POGS 2 - page 2.pdf",
    3: "<reference patient> POGS 2 - Sheet3.pdf",
    4: "<reference patient> POGS 2 - Sheet4.pdf",
    5: "<reference patient> POGS 2 - Sheet5.pdf",
    6: "<reference patient> POGS 2 - Sheet6.pdf",
}
ZOOM = 192 / 72  # same pixel grid as a Playwright screenshot of a 595pt sheet at deviceScaleFactor 2

_open = []


def ref_page(n):
    doc = fitz.open(str(ROOT / REFS[n]))
    _open.append(doc)
    return doc[0]


def norm(s):
    return re.sub(r"\s+", " ", str(s)).strip().lower()


def hexcolor(c):
    if c is None:
        return None
    if isinstance(c, int):
        r, g, b = (c >> 16) & 255, (c >> 8) & 255, c & 255
    else:
        r, g, b = (round(v * 255) for v in c[:3])
    return f"#{r:02x}{g:02x}{b:02x}"


def _same(a, b):
    return a is not None and abs(a.x - b.x) < 1e-3 and abs(a.y - b.y) < 1e-3


def path_d(items, ox=0.0, oy=0.0, sx=1.0, sy=1.0, prec=2):
    def P(p):
        return f"{round((p.x - ox) * sx, prec)} {round((p.y - oy) * sy, prec)}"

    out, cur = [], None
    for it in items:
        op = it[0]
        if op == "l":
            a, b = it[1], it[2]
            if not _same(cur, a):
                out.append("M" + P(a))
            out.append("L" + P(b))
            cur = b
        elif op == "c":
            a, c1, c2, b = it[1], it[2], it[3], it[4]
            if not _same(cur, a):
                out.append("M" + P(a))
            out.append(f"C{P(c1)} {P(c2)} {P(b)}")
            cur = b
        elif op == "re":
            r = it[1]
            out.append(f"M{P(r.tl)}L{P(r.tr)}L{P(r.br)}L{P(r.bl)}Z")
            cur = None
        elif op == "qu":
            q = it[1]
            out.append(f"M{P(q.ul)}L{P(q.ur)}L{P(q.lr)}L{P(q.ll)}Z")
            cur = None
    return "".join(out)


def load_spans(page):
    spans = []
    for b in page.get_text("rawdict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                text = "".join(c["c"] for c in s["chars"])
                if not text.strip():
                    continue
                spans.append({"text": text, "chars": s["chars"], "bbox": s["bbox"], "size": s["size"],
                              "font": s["font"], "color": s["color"], "used": False})
    for i, s in enumerate(spans):
        s["id"] = i
    return spans


def span_origin(span):
    for c in span["chars"]:
        if c["c"].strip():
            return c["origin"][0], c["origin"][1]
    return span["chars"][0]["origin"]


def span_bold(span):
    return "Bold" in span["font"]


def is_checkbox(d):
    r = d["rect"]
    fill = d.get("fill")
    if d.get("type") not in ("f", "fs") or fill is None or sum(fill[:3]) > 0.3:
        return False
    if not (3 <= r.width <= 10 and abs(r.width - r.height) < 0.6):
        return False
    return any(it[0] == "c" for it in d["items"])
```
Run tests → PASS.

- [ ] **Step 4: Implement `extract_assets.py`**
```python
"""Extract the page-1 header images into public/sheet-assets."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import fitz
from common import ROOT, REFS

doc = fitz.open(str(ROOT / REFS[1]))
page = doc[0]
imgs = sorted(page.get_images(full=True), key=lambda im: -im[2])  # widest first: text block, then seal
out = ROOT / "public" / "sheet-assets"
out.mkdir(parents=True, exist_ok=True)
for name, im in zip(["header.png", "seal.png"], imgs[:2]):
    pix = fitz.Pixmap(doc, im[0])
    if pix.alpha or pix.n > 3:
        pix = fitz.Pixmap(fitz.csRGB, pix, 0)
    pix.save(str(out / name))
    print(name, "xref", im[0], pix.width, "x", pix.height, page.get_image_rects(im[0])[0])
```
Run: `cd "$SCRATCH" && python "$ROOT/scripts/pdfref/extract_assets.py"`
Expected: `header.png xref 13 568 x 152 Rect(109.5, 60.4, …)` and `seal.png xref 14 201 x 168 Rect(35.9, 60.4, …)`. Open both PNGs with the Read tool and confirm they show the hospital text block and the seal. Note the xrefs — Task 8's mapping uses them.

- [ ] **Step 5: Implement `extract_glyphs.py`**
```python
"""Extract unchecked/checked checkbox glyph paths (unit box) from reference page 2."""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, ref_page, is_checkbox, path_d

page = ref_page(2)
boxes = [d for d in page.get_drawings() if is_checkbox(d)]


def nlines(d):
    return sum(1 for it in d["items"] if it[0] == "l")


unchecked, checked = min(boxes, key=nlines), max(boxes, key=nlines)
assert nlines(checked) > nlines(unchecked), "page 2 must contain both checkbox states"


def glyph(d):
    r = d["rect"]
    return {"d": path_d(d["items"], r.x0, r.y0, 1 / r.width, 1 / r.height, prec=4), "evenOdd": bool(d.get("even_odd"))}


out = ROOT / "lib" / "sheets" / "templates" / "glyphs.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps({"unchecked": glyph(unchecked), "checked": glyph(checked)}, indent=1), encoding="utf-8")
print("wrote", out)
```
Run it; expect `wrote …glyphs.json`.

- [ ] **Step 6: Implement `dump.py`** (measurement aid; output git-ignored)
```python
"""Dump spans and drawings of every reference page to fixtures/ref/*.tsv for measuring."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, REFS, ref_page, load_spans, span_origin, is_checkbox, hexcolor

out = ROOT / "fixtures" / "ref"
out.mkdir(parents=True, exist_ok=True)
for n in REFS:
    page = ref_page(n)
    with open(out / f"page{n}.spans.tsv", "w", encoding="utf-8") as f:
        f.write("id\tx\ty\tx0\ty0\tx1\ty1\tsize\tfont\ttext\n")
        for s in load_spans(page):
            x, y = span_origin(s)
            b = s["bbox"]
            f.write(f"{s['id']}\t{x:.2f}\t{y:.2f}\t{b[0]:.2f}\t{b[1]:.2f}\t{b[2]:.2f}\t{b[3]:.2f}\t{s['size']:.2f}\t{s['font']}\t{s['text']}\n")
    with open(out / f"page{n}.drawings.tsv", "w", encoding="utf-8") as f:
        f.write("i\ttype\tcheckbox\tx0\ty0\tx1\ty1\tfill\tstroke\twidth\titems\n")
        for i, d in enumerate(page.get_drawings()):
            r = d["rect"]
            f.write(f"{i}\t{d['type']}\t{is_checkbox(d)}\t{r.x0:.2f}\t{r.y0:.2f}\t{r.x1:.2f}\t{r.y1:.2f}\t"
                    f"{hexcolor(d.get('fill'))}\t{hexcolor(d.get('color'))}\t{d.get('width')}\t{len(d['items'])}\n")
print("dumped to", out)
```
Run it. Note: a drawing whose rect spans a whole table may hold many line items; for exact rule positions of such a drawing, print its items with a one-off `python -c` in `$SCRATCH`.

- [ ] **Step 7: Implement `rasterize.py`**
```python
"""Rasterize reference pages to tests/fidelity/reference/pageN.png at ZOOM.

A page whose mapping has "fitWidth" (page 4) is rendered with the same scale-about-frame-origin
transform the template uses, cropped to its frame, on a white A4 canvas.
"""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import fitz
from common import ROOT, REFS, ZOOM, ref_page

out = ROOT / "tests" / "fidelity" / "reference"
out.mkdir(parents=True, exist_ok=True)
W, H = round(595 * ZOOM), round(842 * ZOOM)

for n in REFS:
    page = ref_page(n)
    mp = ROOT / "scripts" / "pdfref" / "mappings" / f"page{n}.json"
    fit = json.loads(mp.read_text(encoding="utf-8")).get("fitWidth") if mp.exists() else None
    if not fit:
        page.get_pixmap(matrix=fitz.Matrix(ZOOM, ZOOM), alpha=False).save(str(out / f"page{n}.png"))
        continue
    x0, y0, x1, y1 = fit["frame"]
    k = (fit["targetRight"] - x0) / (x1 - x0)
    pad = 2
    clip = fitz.Rect(x0 - pad, y0 - pad, x1 + pad, y1 + pad)
    pix = page.get_pixmap(matrix=fitz.Matrix(ZOOM * k, ZOOM * k), clip=clip, alpha=False)
    canvas = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, W, H), False)
    canvas.clear_with(255)
    # Under the transform x' = x0 + (x - x0) * k, the clip corner (x0 - pad) lands at x0 - pad * k.
    pix.set_origin(round((x0 - pad * k) * ZOOM), round((y0 - pad * k) * ZOOM))
    canvas.copy(pix, pix.irect)
    canvas.save(str(out / f"page{n}.png"))
print("rasterized to", out)
```
Run it (page 4 stays 1:1 until Task 11 adds its mapping). Expected: six PNGs, each about 1587 × 2245.

- [ ] **Step 8: Commit**
```bash
git add scripts/pdfref public/sheet-assets lib/sheets/templates/glyphs.json
git status --short   # must not list fixtures/, tests/fidelity/reference, *.pdf
git commit -m "feat: add reference PDF tooling, header assets, checkbox glyphs"
```

---

### Task 6: Template builder

**Files:**
- Create: `scripts/pdfref/build_template.py`, `scripts/pdfref/tests/test_build_template.py`, `scripts/dump-view.ts`

**Interfaces:**
- Consumes: `common.py`; mapping files; `fixtures/reference.view.json` (flat `{ "patient.lastName": "…", "page1.contraception": "Pills, Condom", "page5.primaryCs.checked": "true", … }` — string arrays appear only joined).
- Produces: `build(page, mapping: dict, view: dict, exclude_keys: set[str] = frozenset()) -> dict`; `BuildError`; CLI `python build_template.py N` → `lib/sheets/templates/pageN.json` + `fixtures/review/pageN.labels.tsv`. Output shape = `Template` TS type (Task 7).

**Mapping format** (`scripts/pdfref/mappings/pageN.json`, committed, no patient data):

| Entry | Meaning |
|---|---|
| `images: { "<xref>": "header.png" }` | Emit an image at that xref's rect |
| `fields[] {key}` | Auto: claim every unclaimed span whose text equals the fixture value for `key` |
| `fields[] {key, near}` | Claim the one matching span nearest the anchor label `near` |
| `fields[] {key, align: "r"}` | Slot x = span's right edge, rendered right-aligned |
| `fields[] {key, at: [x, y], size, bold?, align?}` | Explicit baseline slot (fixture value empty); consumes an equal span within 3 pt |
| `fields[] {key, box: [x, y, w, h], size, bold?}` | Multiline box; consumes all spans whose centre is inside |
| `splits[] {label, key}` | One span "Label value" → label text + field slot at the value's first char |
| `checks[] {key, value?, label, side?, near?, synthetic?}` | Checkbox nearest to `label` on `side` (default `left`); no `value` = truthy check; `synthetic` = no box in reference, draw only when checked |
| `marks[] {key, value, near}` or `{key, value, at, size, bold?}` | Prints "X" when `view[key] === value`; consumes the reference "X" |
| `tables[] {key, region, columns: {col: x}, firstBaseline, pitch, rows, size, bold?}` | Consumes spans in region; emits `key.row.col` slots |
| `drop {fills: [hex], regions: [[x,y,w,h]]}` | Remove drawings with these colours / anything in regions |
| `fitWidth {frame: [x0,y0,x1,y1], targetRight}` | Scale about (x0, y0); drop everything right of the frame |
| `chart {hourX, dil: {y3, y10}, stn: {y0, yMinus5}, color}` | Copied into template for `LaborChart` |
| `labelTexts: [..]` | Fixture-equal texts that really are printed labels on this page |

- [ ] **Step 1: Write `scripts/dump-view.ts`**
```ts
import fs from 'node:fs';
import path from 'node:path';
import { coerceForm } from '../lib/storage';
import { buildView } from '../lib/derive';

const root = path.resolve(__dirname, '..');
const { form, skipped } = coerceForm(JSON.parse(fs.readFileSync(path.join(root, 'fixtures', 'reference.json'), 'utf8')));
if (skipped.length) throw new Error(`fixture has invalid paths: ${skipped.join(', ')}`);

const flat: Record<string, string> = {};
(function walk(v: unknown, p: string) {
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === 'string')) { flat[p] = v.join(', '); return; }
    v.forEach((x, i) => walk(x, `${p}.${i}`));
  } else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) walk(x, p ? `${p}.${k}` : k);
  } else flat[p] = String(v);
})(buildView(form), '');
fs.writeFileSync(path.join(root, 'fixtures', 'reference.view.json'), JSON.stringify(flat, null, 1));
console.log(`wrote ${Object.keys(flat).length} view entries`);
```

- [ ] **Step 2: Write the failing tests** — `scripts/pdfref/tests/test_build_template.py`:
```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import fitz
import pytest
from build_template import build, BuildError

_DOCS = []


def page_with(texts, boxes=()):
    doc = fitz.open()
    _DOCS.append(doc)
    page = doc.new_page(width=595, height=842)
    for (x, y, t, bold) in texts:
        page.insert_text((x, y), t, fontname="hebo" if bold else "helv", fontsize=8)
    shp = page.new_shape()
    for (x, y) in boxes:
        shp.draw_rect(fitz.Rect(x, y, x + 6.3, y + 6.3), radius=0.2)
        shp.draw_rect(fitz.Rect(x + 1, y + 1, x + 5.3, y + 5.3))
        shp.finish(fill=(0, 0, 0), color=None, even_odd=True)
    shp.draw_line((20, 300), (500, 300))
    shp.finish(color=(0, 0, 0), width=0.66)
    shp.commit()
    return page


def test_auto_field_replaces_value_and_keeps_label():
    p = page_with([(50, 100, "NAME:", True), (90, 100, "SECRETNAME", False)])
    t = build(p, {"page": 1, "fields": [{"key": "patient.lastName"}]}, {"patient.lastName": "SECRETNAME"})
    assert [x["t"] for x in t["texts"]] == ["NAME:"]
    f = t["fields"][0]
    assert f["k"] == "patient.lastName" and abs(f["x"] - 90) < 0.5 and abs(f["y"] - 100) < 0.5 and f["s"] == 8
    assert len(t["paths"]) == 1


def test_unclaimed_fixture_value_is_an_error():
    p = page_with([(50, 100, "NAME:", True), (90, 100, "SECRETNAME", False)])
    with pytest.raises(BuildError, match="unclaimed"):
        build(p, {"page": 1, "fields": []}, {"patient.lastName": "SECRETNAME"})


def test_excluded_keys_do_not_trigger_unclaimed():
    p = page_with([(40, 98, "Pills", False)], boxes=[(30, 92)])
    m = {"page": 1, "checks": [{"key": "p.c", "value": "Pills", "label": "Pills"}]}
    t = build(p, m, {"p.c": "Pills"}, exclude_keys={"p.c"})
    assert [x["t"] for x in t["texts"]] == ["Pills"]


def test_near_disambiguates():
    p = page_with([(50, 100, "STIs:", True), (80, 100, "None", False), (50, 200, "Alcohol:", True), (90, 200, "None", False)])
    m = {"page": 1, "fields": [{"key": "a.stis", "near": "STIs:"}, {"key": "a.alcohol", "near": "Alcohol:"}]}
    t = build(p, m, {"a.stis": "None", "a.alcohol": "None"})
    assert {f["k"]: round(f["y"]) for f in t["fields"]} == {"a.stis": 100, "a.alcohol": 200}


def test_check_left_of_label_and_unmapped_box_error():
    p = page_with([(40, 98, "Pills", False), (140, 98, "IUD", False)], boxes=[(30, 92), (130, 92)])
    m = {"page": 1, "checks": [{"key": "p.c", "value": "Pills", "label": "Pills"}, {"key": "p.c", "value": "IUD", "label": "IUD"}]}
    t = build(p, m, {})
    assert [(c["v"], round(c["x"])) for c in t["checks"]] == [("Pills", 30), ("IUD", 130)]
    with pytest.raises(BuildError, match="unmapped checkbox"):
        build(page_with([(40, 98, "Pills", False), (140, 98, "IUD", False)], boxes=[(30, 92), (130, 92)]),
              {"page": 1, "checks": [m["checks"][0]]}, {})


def test_box_consumes_spans_and_table_emits_cells():
    p = page_with([(50, 400, "line one", False), (50, 410, "line two", False), (60, 500, "G1", False)])
    m = {"page": 1,
         "fields": [{"key": "p.hpi", "box": [45, 390, 300, 30], "size": 8}],
         "tables": [{"key": "p.ob", "region": [40, 490, 300, 40], "columns": {"order": 60, "year": 120},
                     "firstBaseline": 500, "pitch": 10, "rows": 2, "size": 8}]}
    t = build(p, m, {})
    assert t["texts"] == []
    keys = [f["k"] for f in t["fields"]]
    assert "p.hpi" in keys and "p.ob.1.year" in keys and len(keys) == 5
    hpi = next(f for f in t["fields"] if f["k"] == "p.hpi")
    assert hpi["ml"] is True and hpi["w"] == 300


def test_split_label_value():
    p = page_with([(40, 100, "Others: placenta previa", False)])
    t = build(p, {"page": 1, "splits": [{"label": "Others:", "key": "p.other"}]}, {"p.other": "placenta previa"})
    assert [x["t"] for x in t["texts"]] == ["Others:"]
    assert t["fields"][0]["k"] == "p.other" and t["fields"][0]["x"] > 60


def test_mark_consumes_x():
    p = page_with([(50, 100, "Midposition:", False), (110, 100, "X", True)])
    t = build(p, {"page": 1, "marks": [{"key": "p.pos", "value": "Midposition", "near": "Midposition:"}]}, {})
    assert [x["t"] for x in t["texts"]] == ["Midposition:"]
    assert t["marks"][0]["v"] == "Midposition" and t["marks"][0]["b"] is True


def test_fit_width_sets_transform_and_drops_outside():
    p = page_with([(50, 100, "IN", False), (560, 100, "OUT", False)])
    t = build(p, {"page": 4, "fitWidth": {"frame": [18, 54, 318, 500], "targetRight": 578.3}}, {})
    assert [x["t"] for x in t["texts"]] == ["IN"]
    assert abs(t["transform"]["k"] - (578.3 - 18) / 300) < 1e-3
```
Run: `cd "$SCRATCH" && python -m pytest "$ROOT/scripts/pdfref/tests" -q` → FAIL (no `build_template`).

- [ ] **Step 3: Implement `scripts/pdfref/build_template.py`**
```python
"""Build lib/sheets/templates/pageN.json from a reference page, its mapping and the fixture view."""
import json, math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, ref_page, norm, hexcolor, path_d, load_spans, span_origin, span_bold, is_checkbox

MAPPINGS = ROOT / "scripts" / "pdfref" / "mappings"


class BuildError(Exception):
    pass


def r2(v):
    return round(float(v), 2)


def center(b):
    return ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)


def inside(pt, box):
    x, y, w, h = box
    return x <= pt[0] <= x + w and y <= pt[1] <= y + h


def find_label(spans, label, near=None, what="label"):
    cands = [s for s in spans if not s["used"] and norm(s["text"]) == norm(label)]
    if not cands:
        raise BuildError(f"{what} '{label}' not found")
    if near:
        a = find_label(spans, near, what="anchor")
        ax, ay = span_origin(a)
        return min(cands, key=lambda s: math.dist((ax, ay), span_origin(s)))
    if len(cands) > 1:
        raise BuildError(f"{what} '{label}' is ambiguous ({len(cands)} matches); add 'near'")
    return cands[0]


def field_from_span(key, s, align=None, size=None, bold=None):
    x, y = span_origin(s)
    f = {"k": key, "x": r2(x), "y": r2(y), "s": r2(size or s["size"]), "b": span_bold(s) if bold is None else bool(bold)}
    if align == "r":
        f["x"] = r2(max(c["bbox"][2] for c in s["chars"] if c["c"].strip()))
        f["al"] = "r"
    return f


def build(page, mapping, view, exclude_keys=frozenset()):
    spans = load_spans(page)
    drawings = page.get_drawings()
    tpl = {"page": mapping["page"], "width": r2(page.rect.width), "height": r2(page.rect.height),
           "paths": [], "texts": [], "fields": [], "checks": [], "marks": [], "images": []}
    drop = mapping.get("drop", {})
    drop_fills = {c.lower() for c in drop.get("fills", [])}
    drop_regions = list(drop.get("regions", []))

    fit = mapping.get("fitWidth")
    if fit:
        x0, y0, x1, y1 = fit["frame"]
        tpl["transform"] = {"k": round((fit["targetRight"] - x0) / (x1 - x0), 5), "ox": x0, "oy": y0}
        drop_regions.append([x1 + 1, 0, 10000, 10000])
    if "chart" in mapping:
        tpl["chart"] = mapping["chart"]

    for s in spans:
        if any(inside(center(s["bbox"]), r) for r in drop_regions):
            s["used"] = True

    for sp in mapping.get("splits", []):
        lab = norm(sp["label"])
        hit = next((s for s in spans if not s["used"] and norm(s["text"]).startswith(lab) and norm(s["text"]) != lab), None)
        if not hit:
            raise BuildError(f"split '{sp['label']}' not found")
        chars = hit["chars"]
        start = next(i for i, c in enumerate(chars) if c["c"].strip())
        n = start + len(sp["label"])
        k = n
        while k < len(chars) and not chars[k]["c"].strip():
            k += 1
        if k >= len(chars):
            raise BuildError(f"split '{sp['label']}' has no value part; use a field with 'at'")
        spans.append(dict(hit, text="".join(c["c"] for c in chars[:n]), chars=chars[:n], used=False))
        hit["used"] = True
        c = chars[k]
        tpl["fields"].append({"k": sp["key"], "x": r2(c["origin"][0]), "y": r2(c["origin"][1]), "s": r2(hit["size"]), "b": span_bold(hit)})

    fields = mapping.get("fields", [])
    for f in sorted(fields, key=lambda f: 0 if ("box" in f or "at" in f or "near" in f) else 1):
        key = f["key"]
        val = view.get(key, "")
        if "box" in f:
            bx = f["box"]
            got = [s for s in spans if not s["used"] and inside(center(s["bbox"]), bx)]
            for s in got:
                s["used"] = True
            size = f.get("size") or (max(s["size"] for s in got) if got else None)
            if not size:
                raise BuildError(f"box field '{key}' needs 'size'")
            tpl["fields"].append({"k": key, "x": r2(bx[0]), "y": r2(bx[1]), "w": r2(bx[2]), "h": r2(bx[3]),
                                  "s": r2(size), "b": bool(f.get("bold", False)), "ml": True})
        elif "at" in f:
            x, y = f["at"]
            if val.strip():
                for s in spans:
                    if not s["used"] and norm(s["text"]) == norm(val) and math.dist((x, y), span_origin(s)) < 3:
                        s["used"] = True
            slot = {"k": key, "x": r2(x), "y": r2(y), "s": r2(f["size"]), "b": bool(f.get("bold", False))}
            if f.get("align") == "r":
                slot["al"] = "r"
            tpl["fields"].append(slot)
        else:
            if not val.strip():
                raise BuildError(f"field '{key}' is empty in fixture; give 'at' + 'size'")
            cands = [s for s in spans if not s["used"] and norm(s["text"]) == norm(val)]
            if not cands:
                raise BuildError(f"field '{key}': value span not found (claimed by an earlier key? add 'near')")
            if "near" in f:
                a = find_label(spans, f["near"], what="anchor")
                ax, ay = span_origin(a)
                cands = [min(cands, key=lambda s: math.dist((ax, ay), span_origin(s)))]
            for s in cands:
                s["used"] = True
                tpl["fields"].append(field_from_span(key, s, f.get("align"), f.get("size"), f.get("bold")))

    for t in mapping.get("tables", []):
        for s in spans:
            if not s["used"] and inside(center(s["bbox"]), t["region"]):
                s["used"] = True
        for r in range(t["rows"]):
            y = t["firstBaseline"] + r * t["pitch"]
            for col, x in t["columns"].items():
                tpl["fields"].append({"k": f"{t['key']}.{r}.{col}", "x": r2(x), "y": r2(y), "s": r2(t["size"]), "b": bool(t.get("bold", False))})

    for m in mapping.get("marks", []):
        if "at" in m:
            x, y = m["at"]
            for s in spans:
                if not s["used"] and norm(s["text"]) == "x" and math.dist((x, y), span_origin(s)) < 3:
                    s["used"] = True
            tpl["marks"].append({"k": m["key"], "v": m["value"], "x": r2(x), "y": r2(y), "s": r2(m["size"]), "b": bool(m.get("bold", True))})
            continue
        a = find_label(spans, m["near"], what="anchor")
        ax, ay = span_origin(a)
        xs = [s for s in spans if not s["used"] and norm(s["text"]) == "x" and abs(span_origin(s)[1] - ay) < 4 and span_origin(s)[0] > ax]
        if not xs:
            raise BuildError(f"mark '{m['key']}={m['value']}': no X right of '{m['near']}'; give 'at' + 'size'")
        s = min(xs, key=lambda s: span_origin(s)[0])
        s["used"] = True
        x, y = span_origin(s)
        tpl["marks"].append({"k": m["key"], "v": m["value"], "x": r2(x), "y": r2(y), "s": r2(s["size"]), "b": span_bold(s)})

    boxes = [d for d in drawings if is_checkbox(d)]
    for d in boxes:
        d["used"] = any(inside(center(tuple(d["rect"])), r) for r in drop_regions)
    typical = sorted(d["rect"].width for d in boxes)[len(boxes) // 2] if boxes else 6.3
    for c in mapping.get("checks", []):
        lab = find_label(spans, c["label"], c.get("near"))
        lb = lab["bbox"]
        lcy = (lb[1] + lb[3]) / 2
        entry = {"k": c["key"]}
        if "value" in c:
            entry["v"] = c["value"]
        if c.get("synthetic"):
            entry.update({"x": r2(lb[0] - typical - 3), "y": r2(lcy - typical / 2), "w": r2(typical), "h": r2(typical), "ow": True})
            tpl["checks"].append(entry)
            continue
        side = c.get("side", "left")
        row = [d for d in boxes if not d["used"] and abs((d["rect"].y0 + d["rect"].y1) / 2 - lcy) <= max(d["rect"].height, 4)]
        if side == "left":
            row = [d for d in row if d["rect"].x1 <= lb[0] + 1]
            pick = max(row, key=lambda d: d["rect"].x1) if row else None
        else:
            row = [d for d in row if d["rect"].x0 >= lb[2] - 1]
            pick = min(row, key=lambda d: d["rect"].x0) if row else None
        if not pick:
            raise BuildError(f"no checkbox {side} of label '{c['label']}'")
        pick["used"] = True
        r = pick["rect"]
        entry.update({"x": r2(r.x0), "y": r2(r.y0), "w": r2(r.width), "h": r2(r.height)})
        tpl["checks"].append(entry)
    left = [d for d in boxes if not d["used"]]
    if left:
        raise BuildError("unmapped checkbox(es) at " + ", ".join(f"({d['rect'].x0:.1f},{d['rect'].y0:.1f})" for d in left))

    for d in drawings:
        if is_checkbox(d):
            continue
        if hexcolor(d.get("fill")) in drop_fills or hexcolor(d.get("color")) in drop_fills:
            continue
        if any(inside(center(tuple(d["rect"])), r) for r in drop_regions):
            continue
        p = {"d": path_d(d["items"])}
        if d.get("fill") is not None and d["type"] in ("f", "fs"):
            p["fill"] = hexcolor(d["fill"])
        if d.get("color") is not None and d["type"] in ("s", "fs"):
            p["stroke"] = hexcolor(d["color"])
            p["sw"] = r2(d.get("width") or 1)
        if d.get("even_odd"):
            p["evenOdd"] = True
        tpl["paths"].append(p)

    for xref, name in mapping.get("images", {}).items():
        r = page.get_image_rects(int(xref))[0]
        tpl["images"].append({"src": name, "x": r2(r.x0), "y": r2(r.y0), "w": r2(r.width), "h": r2(r.height)})

    values = {norm(v) for k, v in view.items() if k not in exclude_keys and v and len(norm(v)) >= 4}
    allowed = {norm(t) for t in mapping.get("labelTexts", [])}
    for s in spans:
        if s["used"]:
            continue
        text = s["text"].strip()
        x, y = span_origin(s)
        if norm(text) in values and norm(text) not in allowed:
            raise BuildError(f"unclaimed fixture value at ({x:.1f},{y:.1f}): map it, or add to labelTexts if it is a printed label")
        t = {"t": text, "x": r2(x), "y": r2(y), "s": r2(s["size"]), "b": span_bold(s)}
        if "Italic" in s["font"] or "Oblique" in s["font"]:
            t["i"] = True
        col = hexcolor(s["color"])
        if col != "#000000":
            t["c"] = col
        tpl["texts"].append(t)
    return tpl


def selection_keys():
    """Keys of every check/mark in all mappings: their values are option names, not patient data."""
    keys = set()
    for mp in MAPPINGS.glob("page*.json"):
        m = json.loads(mp.read_text(encoding="utf-8"))
        keys |= {c["key"] for c in m.get("checks", [])} | {c["key"] for c in m.get("marks", [])}
    return keys


def main(n):
    mapping = json.loads((MAPPINGS / f"page{n}.json").read_text(encoding="utf-8"))
    view = json.loads((ROOT / "fixtures" / "reference.view.json").read_text(encoding="utf-8"))
    tpl = build(ref_page(n), mapping, view, selection_keys())
    out = ROOT / "lib" / "sheets" / "templates" / f"page{n}.json"
    out.write_text(json.dumps(tpl, indent=1), encoding="utf-8")
    review = ROOT / "fixtures" / "review"
    review.mkdir(parents=True, exist_ok=True)
    with open(review / f"page{n}.labels.tsv", "w", encoding="utf-8") as f:
        for t in tpl["texts"]:
            f.write(f"{t['x']}\t{t['y']}\t{t['s']}\t{'B' if t['b'] else ''}\t{t['t']}\n")
    print(f"page {n}: {len(tpl['paths'])} paths, {len(tpl['texts'])} labels, {len(tpl['fields'])} fields, "
          f"{len(tpl['checks'])} checks, {len(tpl['marks'])} marks")


if __name__ == "__main__":
    try:
        main(int(sys.argv[1]))
    except BuildError as e:
        print("BUILD ERROR:", e)
        sys.exit(1)
```

- [ ] **Step 4: Run tests** — `python -m pytest "$ROOT/scripts/pdfref/tests" -q` → PASS. Fix the builder (not the tests) until green.

- [ ] **Step 5: Commit** — `git add scripts && git commit -m "feat: add template builder with PHI-safe value slot extraction"`

---

### Task 7: Renderer, dev route, fidelity harness, PHI guard

**Files:**
- Create: `lib/sheets/template.ts`, `view.ts`, `fit.ts`, `TemplatePage.tsx`, `LaborChart.tsx`, `Sheet.tsx`, `assets.ts`, `lib/sheets/templates/index.ts`, `lib/sheets/templates/page{1..6}.json` (stubs), `app/dev/sheet/[page]/page.tsx`, `fixtures/reference.json` (git-ignored)
- Modify: `app/globals.css`
- Test: `tests/unit/fit.test.ts`, `tests/unit/view.test.ts`, `tests/unit/template-page.test.tsx`, `tests/unit/templates-phi.test.ts`, `tests/fidelity/fidelity.spec.ts`

**Interfaces:**
- Consumes: `buildView`, `laborPoints`, `Pt`, `LaborRow`, `glyphs.json`, `coerceForm`, `emptyForm`, `sampleForm`, options.
- Produces: `Template`, `TplField`, `TplChart`, `SheetAssets` types; `getPath(obj, key)`, `asText(v)`, `isChecked(v, expected?)`; `wrap`, `fitText(text, w, h, base, min = 3) → { size, lines }`, `estimateWidth`, `LINE = 1.15`, `ASCENT = 0.905`; `<TemplatePage template view assets fluid? children?>` (root `<svg class="sheet">`); `<Sheet page form assets fluid?>`; `<AllSheets form assets>`; `TEMPLATES`, `PAGE_NUMBERS`; `APP_ASSETS`; route `/dev/sheet/N[?sample=1|?empty=1]` (404 in production).

- [ ] **Step 1: Write failing unit tests**

`tests/unit/fit.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { fitText, wrap } from '@/lib/sheets/fit';

describe('wrap', () => {
  test('keeps paragraphs and wraps words', () => {
    expect(wrap('aaa bbb ccc\nddd', 30, 8)).toEqual(['aaa bbb', 'ccc', 'ddd']); // 30 / (8*0.52) → 7 chars/line
  });
  test('empty paragraph preserved', () => expect(wrap('a\n\nb', 100, 8)).toEqual(['a', '', 'b']));
});

describe('fitText', () => {
  test('keeps base size when it fits', () => expect(fitText('short', 200, 20, 8).size).toBe(8));
  test('shrinks long text to fit height', () => {
    const r = fitText('word '.repeat(200), 200, 40, 8);
    expect(r.size).toBeLessThan(8);
    expect(r.lines.length * r.size * 1.15).toBeLessThanOrEqual(40);
  });
  test('stops at min size', () => expect(fitText('word '.repeat(5000), 50, 10, 8).size).toBe(3));
});
```

`tests/unit/view.test.ts`:
```ts
import { expect, test } from 'vitest';
import { asText, getPath, isChecked } from '@/lib/sheets/view';

test('getPath', () => {
  expect(getPath({ a: { b: [{ c: 'x' }] } }, 'a.b.0.c')).toBe('x');
  expect(getPath({ a: 1 }, 'a.b.c')).toBeUndefined();
});
test('asText', () => {
  expect(asText('x')).toBe('x'); expect(asText(3)).toBe('3');
  expect(asText(true)).toBe(''); expect(asText(['a', 'b'])).toBe('a, b'); expect(asText(undefined)).toBe('');
});
test('isChecked', () => {
  expect(isChecked(['Pills', 'IUD'], 'IUD')).toBe(true);
  expect(isChecked('M', 'M')).toBe(true);
  expect(isChecked('S', 'M')).toBe(false);
  expect(isChecked(true)).toBe(true);
  expect(isChecked('', undefined)).toBe(false);
  expect(isChecked('text', undefined)).toBe(true);
});
```

`tests/unit/template-page.test.tsx`:
```tsx
import { expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TemplatePage } from '@/lib/sheets/TemplatePage';
import type { Template } from '@/lib/sheets/template';

const tpl: Template = {
  page: 1, width: 595, height: 842,
  paths: [{ d: 'M0 0L10 0', stroke: '#000000', sw: 0.66 }],
  texts: [{ t: 'NAME:', x: 10, y: 20, s: 9, b: true }],
  fields: [
    { k: 'patient.lastName', x: 50, y: 20, s: 9, b: false },
    { k: 'page2.hpi', x: 10, y: 100, w: 100, h: 20, s: 8, b: false, ml: true },
  ],
  checks: [
    { k: 'page1.contraception', v: 'Pills', x: 5, y: 5, w: 6.3, h: 6.3 },
    { k: 'page5.postpartumCondition', v: 'Good', x: 5, y: 15, w: 6.3, h: 6.3, ow: true },
  ],
  marks: [{ k: 'page3.position', v: 'Midposition', x: 300, y: 300, s: 9, b: true }],
  images: [{ src: 'seal.png', x: 1, y: 1, w: 2, h: 2 }],
};
const view = {
  patient: { lastName: 'DOE & <X>' }, page2: { hpi: 'word '.repeat(300) },
  page1: { contraception: ['Pills'] }, page3: { position: 'Midposition' }, page5: { postpartumCondition: '' },
};

test('renders labels, escaped values, checks, marks, images', () => {
  const html = renderToStaticMarkup(<TemplatePage template={tpl} view={view} assets={{ 'seal.png': '/s.png' }} />);
  expect(html).toContain('width="595pt"');
  expect(html).toContain('NAME:');
  expect(html).toContain('DOE &amp; &lt;X&gt;');
  expect(html).toContain('href="/s.png"');
  expect(html.match(/<path/g)?.length).toBe(2); // the rule + the Pills checkbox; synthetic unchecked "Good" hidden
  expect(html).toContain('>X</text>');
});

test('multiline field shrinks below its base size', () => {
  const html = renderToStaticMarkup(<TemplatePage template={tpl} view={view} assets={{}} />);
  const sizes = [...html.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
  expect(Math.min(...sizes)).toBeLessThan(8);
});
```

`tests/unit/templates-phi.test.ts`:
```ts
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import * as O from '@/lib/options';

const root = path.resolve(__dirname, '../..');
const fixture = path.join(root, 'fixtures', 'reference.json');
const OPTION_VALUES = new Set(Object.values(O).flat().map((s) => s.toLowerCase()));

test.skipIf(!fs.existsSync(fixture))('no fixture value appears in committed template labels', () => {
  const values: string[] = [];
  (function walk(v: unknown) {
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (s.length >= 5 && !OPTION_VALUES.has(s)) values.push(s);
    } else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  })(JSON.parse(fs.readFileSync(fixture, 'utf8')));
  const dir = path.join(root, 'lib', 'sheets', 'templates');
  for (const f of fs.readdirSync(dir).filter((n) => /^page\d\.json$/.test(n))) {
    const texts: string[] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).texts.map((t: { t: string }) => t.t.toLowerCase());
    for (const v of values) for (const t of texts) expect(t.includes(v), `${f}: a label contains a fixture value`).toBe(false);
  }
});
```
Run: `npm test` → new tests FAIL.

- [ ] **Step 2: Implement `lib/sheets/template.ts`**
```ts
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
```

- [ ] **Step 3: Implement `lib/sheets/view.ts` and `lib/sheets/fit.ts`**
```ts
// lib/sheets/view.ts
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
```
```ts
// lib/sheets/fit.ts — deterministic (server-safe) fitting using an average Arial glyph width.
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
```

- [ ] **Step 4: Implement `lib/sheets/TemplatePage.tsx`**
```tsx
import type { ReactNode } from 'react';
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
    const { size, lines } = fitText(text, f.w, f.h, f.s);
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
  const squeeze = f.w && estimateWidth(text, f.s) > f.w ? { textLength: f.w, lengthAdjust: 'spacingAndGlyphs' as const } : {};
  return (
    <text x={f.x} y={f.y} fontSize={f.s} fontWeight={weight} textAnchor={anchor} style={{ whiteSpace: 'pre' }} {...squeeze}>
      {text}
    </text>
  );
}

export function TemplatePage({ template: t, view, assets, fluid, children }: {
  template: Template; view: unknown; assets: SheetAssets; fluid?: boolean; children?: ReactNode;
}) {
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
        {t.fields.map((f, i) => <Field key={i} f={f} view={view} clipId={`p${t.page}f${i}`} />)}
        {children}
      </g>
    </svg>
  );
}
```

- [ ] **Step 5: Implement `LaborChart.tsx`, stubs, `templates/index.ts`, `assets.ts`, `Sheet.tsx`**

`lib/sheets/LaborChart.tsx`:
```tsx
import type { LaborRow } from '@/lib/schema';
import { laborPoints, type Pt } from '@/lib/derive';
import type { TplChart } from './template';

export function LaborChart({ chart, table }: { chart: TplChart; table: LaborRow[] }) {
  const { dil, stn } = laborPoints(table);
  const hx = (h: number) => chart.hourX[0] + ((chart.hourX[1] - chart.hourX[0]) * h) / 10;
  const dy = (v: number) => chart.dil.y3 + ((chart.dil.y10 - chart.dil.y3) * (v - 3)) / 7;
  const sy = (v: number) => chart.stn.y0 + ((chart.stn.yMinus5 - chart.stn.y0) * v) / -5;
  const series = (pts: Pt[], y: (v: number) => number, lo: number, hi: number) => {
    const ok = pts.filter((p) => p.v >= lo && p.v <= hi);
    return (
      <g>
        {ok.length > 1 && <polyline points={ok.map((p) => `${hx(p.h)},${y(p.v)}`).join(' ')} fill="none" stroke={chart.color} strokeWidth={0.75} />}
        {ok.map((p) => <rect key={p.h} x={hx(p.h) - 1.5} y={y(p.v) - 0.4} width={3} height={0.8} fill={chart.color} />)}
      </g>
    );
  };
  return <g>{series(dil, dy, 3, 10)}{series(stn, sy, -5, 0)}</g>;
}
```

Six stubs, `lib/sheets/templates/page1.json` … `page6.json` (with `"page"` = 1…6):
```json
{ "page": 1, "width": 595, "height": 842, "paths": [], "texts": [], "fields": [], "checks": [], "marks": [], "images": [] }
```

`lib/sheets/templates/index.ts`:
```ts
import type { Template } from '../template';
import p1 from './page1.json';
import p2 from './page2.json';
import p3 from './page3.json';
import p4 from './page4.json';
import p5 from './page5.json';
import p6 from './page6.json';

export const TEMPLATES = { 1: p1, 2: p2, 3: p3, 4: p4, 5: p5, 6: p6 } as unknown as Record<number, Template>;
export const PAGE_NUMBERS = [1, 2, 3, 4, 5, 6] as const;
```

`lib/sheets/assets.ts`:
```ts
import type { SheetAssets } from './template';
export const APP_ASSETS: SheetAssets = { 'header.png': '/sheet-assets/header.png', 'seal.png': '/sheet-assets/seal.png' };
```

`lib/sheets/Sheet.tsx`:
```tsx
import type { PogsForm } from '@/lib/schema';
import { buildView } from '@/lib/derive';
import { TemplatePage } from './TemplatePage';
import { LaborChart } from './LaborChart';
import { PAGE_NUMBERS, TEMPLATES } from './templates';
import type { SheetAssets } from './template';

export function Sheet({ page, form, assets, fluid }: { page: number; form: PogsForm; assets: SheetAssets; fluid?: boolean }) {
  const t = TEMPLATES[page];
  return (
    <TemplatePage template={t} view={buildView(form)} assets={assets} fluid={fluid}>
      {t.chart ? <LaborChart chart={t.chart} table={form.page4.laborTable} /> : null}
    </TemplatePage>
  );
}

export function AllSheets({ form, assets }: { form: PogsForm; assets: SheetAssets }) {
  return <>{PAGE_NUMBERS.map((p) => <Sheet key={p} page={p} form={form} assets={assets} />)}</>;
}
```

- [ ] **Step 6: Fonts and print CSS** — append to `app/globals.css`:
```css
@font-face { font-family: 'Arimo'; src: url('/fonts/arimo-400.woff2') format('woff2'); font-weight: 400; font-style: normal; }
@font-face { font-family: 'Arimo'; src: url('/fonts/arimo-700.woff2') format('woff2'); font-weight: 700; font-style: normal; }

.print-only { display: none; }
@media print {
  @page { size: A4; margin: 0; }
  html, body { margin: 0; background: #fff; }
  .no-print { display: none !important; }
  .print-only { display: block; }
  .print-only .sheet { display: block; break-after: page; }
}
```

- [ ] **Step 7: Dev route** — `app/dev/sheet/[page]/page.tsx`:
```tsx
import fs from 'node:fs';
import path from 'node:path';
import { notFound } from 'next/navigation';
import { Sheet } from '@/lib/sheets/Sheet';
import { APP_ASSETS } from '@/lib/sheets/assets';
import { emptyForm, sampleForm } from '@/lib/defaults';
import { coerceForm } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export default async function DevSheet({ params, searchParams }: {
  params: Promise<{ page: string }>; searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { page } = await params;
  const sp = await searchParams;
  const n = Number(page);
  if (!(n >= 1 && n <= 6)) notFound();
  const file = path.join(process.cwd(), 'fixtures', 'reference.json');
  const form = sp.sample ? sampleForm()
    : sp.empty || !fs.existsSync(file) ? emptyForm()
    : coerceForm(JSON.parse(fs.readFileSync(file, 'utf8'))).form;
  return <div style={{ background: '#fff', width: 'fit-content' }}><Sheet page={n} form={form} assets={APP_ASSETS} /></div>;
}
```

- [ ] **Step 8: Create the git-ignored fixture `fixtures/reference.json`**

Start from `JSON.stringify(emptyForm(), null, 2)` and transcribe every value visible in the six reference PDFs, exactly as printed (case, punctuation; multi-line blocks joined with `\n`). Checkbox states → option values from `lib/options.ts` for ticked boxes only (e.g. `contraception: ["Pills","Condom"]`, `page2.antenatalRisks: ["Others"]`, `antenatalRisksOther: "placenta previa"`). Page 3 X marks → `position: "Midposition"`, `membranes: "Intact"`; page 3 `bmi: " "` (one space, so the derived BMI does not render — the reference BMI blank is empty). Page 5 `aga: "x"`, `primaryCs: { checked: true, incision: "Low Transverse", tubalLigation: false, indication: "Placenta previa in hemorrhage" }`. Page 4 labor table hour 0 `{ "dilatation": "2", "station": "-3" }`, hour 10 `{ "dilatation": "", "station": "-5" }`, `fullDilatation: "FOR CS"`, `promHours: "13"`. `obHistory`: 11 rows (G11 outcome `current`). Then:
```bash
git check-ignore fixtures/reference.json   # must print the path
npm run dump-view                         # → "wrote N view entries"
```

- [ ] **Step 9: Fidelity spec** — `tests/fidelity/fidelity.spec.ts`:
```ts
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const MAX_RATIO: Record<number, number> = { 1: 0.015, 2: 0.015, 3: 0.015, 4: 0.015, 5: 0.015, 6: 0.015 };
const ref = (n: number) => path.join('tests', 'fidelity', 'reference', `page${n}.png`);
const out = path.join('tests', 'fidelity', 'output');

for (const n of [1, 2, 3, 4, 5, 6]) {
  test(`page ${n} matches reference`, async ({ page }) => {
    test.skip(!fs.existsSync(ref(n)), 'reference not rasterized');
    await page.goto(`/dev/sheet/${n}`);
    await page.evaluate(() => document.fonts.ready);
    const shot = PNG.sync.read(await page.locator('svg.sheet').screenshot());
    const want = PNG.sync.read(fs.readFileSync(ref(n)));
    expect(Math.abs(shot.width - want.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(shot.height - want.height)).toBeLessThanOrEqual(2);
    const w = Math.min(shot.width, want.width);
    const h = Math.min(shot.height, want.height);
    const crop = (img: PNG) => { const c = new PNG({ width: w, height: h }); PNG.bitblt(img, c, 0, 0, w, h, 0, 0); return c; };
    const a = crop(want);
    const b = crop(shot);
    const diff = new PNG({ width: w, height: h });
    const bad = pixelmatch(a.data, b.data, diff.data, w, h, { threshold: 0.2 });
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, `page${n}.actual.png`), PNG.sync.write(b));
    fs.writeFileSync(path.join(out, `page${n}.diff.png`), PNG.sync.write(diff));
    const ratio = bad / (w * h);
    console.log(`page ${n}: mismatch ${(ratio * 100).toFixed(3)}%`);
    expect(ratio).toBeLessThan(MAX_RATIO[n]);
  });
}
```

- [ ] **Step 10: Run** — `npm test` → all PASS. `npm run test:fidelity` → all six FAIL (stubs are blank) and write `tests/fidelity/output/page*.{actual,diff}.png`, proving the harness works end to end.

- [ ] **Step 11: Commit**
```bash
git add lib/sheets app/dev app/globals.css tests/unit tests/fidelity/fidelity.spec.ts
git status --short   # fixtures/ and tests/fidelity/{reference,output} must not appear
git commit -m "feat: add SVG template renderer, dev sheet route, fidelity harness, PHI guard"
```

---

### Tasks 8–13: one task per page (mapping → template → fidelity pass)

Each page task — **Files:** Create `scripts/pdfref/mappings/pageN.json`; Modify (generated) `lib/sheets/templates/pageN.json`. **Interfaces:** consumes the builder (Task 6), renderer (Task 7) and fixture view; produces a committed `pageN.json` that passes fidelity.

**Measuring:** values written `"⟨…⟩"` in the mappings below must be replaced with numbers before the first build, read from `fixtures/ref/pageN.spans.tsv` / `.drawings.tsv`:
- `at: [x, y]` — x = start of the blank/underline (thin horizontal line x0 + 1, or the reference value's x when one exists on another page row of the same column); y = baseline (`y` column) of that row's label.
- `box: [x, y, w, h]` — from rule/frame coordinates: left = frame inner x + 2, top = bottom (`y1`) of the section label, right/bottom = next rule − 1.
- table `columns` x = `x` of the reference value in that column; `firstBaseline` = `y` of row 1 values; `pitch` = row-to-row baseline difference (equal to rule spacing).

**Loop — repeat until green:**

- [ ] **A. Write the mapping** (per-task content below) with all `⟨…⟩` replaced by measured numbers.
- [ ] **B. Build** — `cd "$SCRATCH" && python "$ROOT/scripts/pdfref/build_template.py" N`. On `BUILD ERROR`, fix the mapping as the message says (add `near` / `at` / a `split` / a check entry; add to `labelTexts` only for texts that genuinely are printed form labels) and rebuild.
- [ ] **C. Review labels** — read `fixtures/review/pageN.labels.tsv`; every line must be printed form text. Any patient value → map it and rebuild.
- [ ] **D. Fidelity** — `npm run test:fidelity -- -g "page N "`. Read `tests/fidelity/output/pageN.diff.png` and `.actual.png`; correct slot positions/sizes/weights for mismatched regions; rebuild; repeat until mismatch < 1.5 %.
- [ ] **E. Empty and sample render** — load `/dev/sheet/N?empty=1` and `/dev/sheet/N?sample=1` (Playwright screenshot or browser) and confirm: empty shows only form text and unchecked boxes; sample values sit in the right blanks.
- [ ] **F. Unit + PHI** — `npm test` → PASS (includes PHI guard).
- [ ] **G. Commit** — `git add scripts/pdfref/mappings/pageN.json lib/sheets/templates/pageN.json && git commit -m "feat: page N template"`

---

### Task 8: Page 1 template

`scripts/pdfref/mappings/page1.json` (image xrefs from Task 5 Step 4 output):
```json
{
  "page": 1,
  "images": { "13": "header.png", "14": "seal.png" },
  "fields": [
    { "key": "patient.hospNo", "align": "r" },
    { "key": "patient.caseNo", "align": "r" },
    { "key": "patient.lastName" }, { "key": "patient.firstName" }, { "key": "patient.middleName" },
    { "key": "patient.age", "near": "AGE:" },
    { "key": "patient.room", "near": "Rm#:" },
    { "key": "patient.address" },
    { "key": "patient.admissionDateTime" },
    { "key": "page1.admittingImpression", "box": "⟨below 'Admitting Impression:' to the rule above the Blood Type block; left frame to FINAL DIAGNOSIS column − 4⟩", "size": 7.53 },
    { "key": "page1.finalDiagnosis", "box": "⟨FINAL DIAGNOSIS column: below its label to the rule above 'Blood Type:'⟩", "size": 3.77 },
    { "key": "page1.bloodType", "near": "Blood Type:" },
    { "key": "page1.rh", "near": "Rh:" },
    { "key": "page1.vdrl", "at": "⟨x of bloodType value, y of 'VDRL:'⟩", "size": 7.53, "bold": true },
    { "key": "page1.hbsag", "near": "HBsAg:" },
    { "key": "page1.antibodies", "at": "⟨x of rh value, y of 'Antibodies:'⟩", "size": 7.53, "bold": true },
    { "key": "page1.chiefComplaint" },
    { "key": "page1.obScore.g", "near": "G" }, { "key": "page1.obScore.p", "near": "P" },
    { "key": "page1.obScore.ft", "near": "Ft" }, { "key": "page1.obScore.pr", "near": "Pr" },
    { "key": "page1.obScore.ab", "near": "Ab" }, { "key": "page1.obScore.l", "near": "L" },
    { "key": "page1.lmp" }, { "key": "page1.edc", "near": "EDC:" },
    { "key": "page1.pmp", "at": "⟨x of lmp value, y of 'PMP:'⟩", "size": 7.53, "bold": true },
    { "key": "page1.aog", "near": "AOG:" },
    { "key": "page1.ultrasoundDate" }, { "key": "page1.adjustedEdc", "near": "Adjusted EDC:" },
    { "key": "page1.quickeningDate", "at": "⟨x of aogByUltrasound value, y of 'Date of Quickening:'⟩", "size": 7.53, "bold": true },
    { "key": "page1.aogByUltrasound" },
    { "key": "page1.menarche", "near": "Menarche at:" }, { "key": "page1.interval", "near": "Interval:" },
    { "key": "page1.duration", "near": "Duration:" }, { "key": "page1.amount", "near": "Amount:" },
    { "key": "page1.dysmenorrhea", "near": "Dysmenorrhea:" },
    { "key": "page1.coitarche", "near": "Coitarche at:" }, { "key": "page1.sexualPartners", "near": "Sexual Partner:" },
    { "key": "page1.stis", "near": "STIs:" }, { "key": "page1.papsmear", "near": "Papsmear:" },
    { "key": "page1.totalWeightGain", "at": "⟨blank after 'TOTAL WEIGHT GAIN:'⟩", "size": 7.53, "bold": true },
    { "key": "page1.usualBp", "at": "⟨blank after 'Usual BP'⟩", "size": 7.53, "bold": true },
    { "key": "page1.hb", "at": "⟨blank after 'Hb'⟩", "size": 7.53, "bold": true },
    { "key": "page1.hct", "at": "⟨blank after 'Hct'⟩", "size": 7.53, "bold": true },
    { "key": "page1.urineChon", "at": "⟨blank after 'Urine CHON:'⟩", "size": 7.53, "bold": true },
    { "key": "page1.fbs", "at": "⟨blank after 'FBS:'⟩", "size": 7.53, "bold": true },
    { "key": "page1.ogtt", "at": "⟨blank after 'OGTT'⟩", "size": 7.53, "bold": true },
    { "key": "page1.supplementsOther", "at": "⟨blank after 'Others:' on the SUPPLEMENTS row⟩", "size": 6.02 }
  ],
  "tables": [
    { "key": "page1.obHistory", "region": "⟨table body: below header row to bottom of 13th row⟩",
      "columns": { "order": "⟨x 'G1'⟩", "outcome": "⟨x first 'NSD'⟩", "year": "⟨x '2000'⟩", "gestation": "⟨x '7 months'⟩",
                   "sex": "⟨x 'Male'⟩", "birthWeight": "⟨x 'Unrecalled'⟩", "status": "⟨x 'expired'⟩", "complications": "⟨x 'IUFD'⟩" },
      "firstBaseline": "⟨y 'G1'⟩", "pitch": "⟨y 'G2' − y 'G1'⟩", "rows": 13, "size": 7.53 }
  ],
  "checks": [
    { "key": "patient.civilStatus", "value": "M", "label": "M", "side": "right", "near": "AGE:" },
    { "key": "patient.civilStatus", "value": "S", "label": "S", "side": "right" },
    { "key": "patient.civilStatus", "value": "W", "label": "W", "side": "right" },
    { "key": "patient.civilStatus", "value": "Sep", "label": "Sep.", "side": "right" },
    { "key": "page1.desiredFamilySize", "value": "1", "label": "1", "near": "DESIRED FAMILY SIZE" },
    { "key": "page1.desiredFamilySize", "value": "2", "label": "2", "near": "DESIRED FAMILY SIZE" },
    { "key": "page1.desiredFamilySize", "value": "3", "label": "3", "near": "DESIRED FAMILY SIZE" },
    { "key": "page1.desiredFamilySize", "value": "4", "label": "4", "near": "DESIRED FAMILY SIZE" },
    { "key": "page1.desiredFamilySize", "value": "more", "label": "more" },
    { "key": "page1.contraception", "value": "None", "label": "None", "near": "CONTRACEPTION HISTORY:" },
    { "key": "page1.contraception", "value": "Pills", "label": "Pills" },
    { "key": "page1.contraception", "value": "IUD", "label": "IUD" },
    { "key": "page1.contraception", "value": "Rhythm", "label": "Rhythm" },
    { "key": "page1.contraception", "value": "Condom", "label": "Condom" },
    { "key": "page1.education", "value": "None", "label": "None", "near": "EDUCATIONAL PROFILE:" },
    { "key": "page1.education", "value": "Primary", "label": "Primary" },
    { "key": "page1.education", "value": "Secondary", "label": "Secondary" },
    { "key": "page1.education", "value": "College", "label": "College" },
    { "key": "page1.socioEconomic", "value": "Dependent/Unemployed", "label": "Dependent/Unemployed" },
    { "key": "page1.socioEconomic", "value": "Employed", "label": "Employed" },
    { "key": "page1.socioEconomic", "value": "Self-Employed", "label": "Self - Employed" },
    { "key": "page1.income", "value": "Below minimum wage", "label": "Below minimum wage" },
    { "key": "page1.income", "value": "Minimum wage", "label": "Minimum wage" },
    { "key": "page1.income", "value": "Above minimum", "label": "Above minimum" },
    { "key": "page1.antenatalVisits", "value": "None", "label": "None", "near": "ANTENATAL VISITS:" },
    { "key": "page1.antenatalVisits", "value": "1", "label": "1", "near": "ANTENATAL VISITS:" },
    { "key": "page1.antenatalVisits", "value": "2", "label": "2", "near": "ANTENATAL VISITS:" },
    { "key": "page1.antenatalVisits", "value": "3", "label": "3", "near": "ANTENATAL VISITS:" },
    { "key": "page1.antenatalVisits", "value": "4", "label": "4", "near": "ANTENATAL VISITS:" },
    { "key": "page1.antenatalVisits", "value": "5", "label": "5", "near": "ANTENATAL VISITS:" },
    { "key": "page1.antenatalVisits", "value": ">5", "label": ">5" },
    { "key": "page1.provider", "value": "MD", "label": "MD" },
    { "key": "page1.provider", "value": "MW", "label": "MW" },
    { "key": "page1.provider", "value": "Others", "label": "Others", "near": "HEALTH CARE PROVIDER:" },
    { "key": "page1.immunizations", "value": "TT", "label": "TT" },
    { "key": "page1.immunizations", "value": "Td", "label": "Td" },
    { "key": "page1.immunizations", "value": "Tdap", "label": "Tdap" },
    { "key": "page1.immunizations", "value": "Hep B", "label": "Hep B" },
    { "key": "page1.immunizations", "value": "Others", "label": "Others", "near": "Hep B" },
    { "key": "page1.supplements", "value": "Vitamins", "label": "Vitamins" },
    { "key": "page1.supplements", "value": "Fe", "label": "Fe" },
    { "key": "page1.supplements", "value": "Ca", "label": "Ca" },
    { "key": "page1.supplements", "value": "Others", "label": "Others:" }
  ]
}
```
Notes: the 4.52 pt LASTNAME / FIRSTNAME / MIDDLENAME captions remain labels; the 4.52 pt "male" in row G2 is inside the table region and is consumed. Single-letter anchors (`G`, `P`, `L`, `M`, `S`, `W`) may be ambiguous — when the builder says so, add `near` pointing at the row label (`OBSTETRICAL HISTORY:` / `AGE:`). Run loop A–G. Expected build summary: ≥ 40 checks, ≥ 104 table cells.

---

### Task 9: Page 2 template

`scripts/pdfref/mappings/page2.json`:
```json
{
  "page": 2,
  "fields": [
    { "key": "page2.hpi", "box": "⟨below 'HISTORY OF PRESENT ILLNESS (HPI)' to the next rule; frame inner width⟩", "size": 8.58 },
    { "key": "page2.pastHistory", "box": "⟨below 'PAST HISTORY: (PREVIOUS ILLNESS AND OPERATIONS)' to the next rule⟩", "size": 8.58 },
    { "key": "page2.familyHistory", "box": "⟨below 'FAMILY HISTORY:' to the next rule⟩", "size": 8.58 },
    { "key": "page2.personalSocialHistory", "box": "⟨below 'PERSONAL-SOCIAL HISTORY:' to the next rule⟩", "size": 8.58 },
    { "key": "page2.occupation", "box": "⟨left column under 'OCCUPATION AND ENVIRONMENT:' down to the 'Drug Therapy:' row⟩", "size": 8.58 },
    { "key": "page2.alcohol", "near": "Alcohol:" },
    { "key": "page2.tobacco", "near": "Tobacco/Cigarette:" },
    { "key": "page2.drugAllergies", "near": "Drug/Allergies:" },
    { "key": "page2.drugTherapy", "near": "Drug Therapy:" },
    { "key": "page2.otherAllergies", "near": "Other Allergies:" },
    { "key": "footer.surname" }, { "key": "footer.givenName" }, { "key": "footer.mi" },
    { "key": "footer.age", "near": "Age:" },
    { "key": "footer.hospNo", "align": "r" },
    { "key": "footer.ward", "near": "Ward/Rm:" }
  ],
  "splits": [ { "label": "Others:", "key": "page2.antenatalRisksOther" } ],
  "checks": [
    { "key": "page2.antenatalRisks", "value": "Anemia", "label": "Anemia" },
    { "key": "page2.antenatalRisks", "value": "HTN/Preclampsia/CHVD", "label": "HTN/Preclampsia/CHVD" },
    { "key": "page2.antenatalRisks", "value": "Fetal Wastage", "label": "Fetal Wastage" },
    { "key": "page2.antenatalRisks", "value": "Previous CS/Surgery", "label": "Previous CS/Surgery" },
    { "key": "page2.antenatalRisks", "value": "Cardiac", "label": "Cardiac" },
    { "key": "page2.antenatalRisks", "value": "Premature labor", "label": "Premature labor" },
    { "key": "page2.antenatalRisks", "value": "UTI", "label": "UTI" },
    { "key": "page2.antenatalRisks", "value": "Renal", "label": "Renal" },
    { "key": "page2.antenatalRisks", "value": "IUGR", "label": "IUGR" },
    { "key": "page2.antenatalRisks", "value": "Infections LC Tracts", "label": "Infections LC Tracts" },
    { "key": "page2.antenatalRisks", "value": "Diabetes Mellitus", "label": "Diabetes Mellitus" },
    { "key": "page2.antenatalRisks", "value": "Infertility", "label": "Infertility" },
    { "key": "page2.antenatalRisks", "value": "Nutritional (1/2-21 lbs/wk)", "label": "Nutritional (1/2-21 lbs/wk)" },
    { "key": "page2.antenatalRisks", "value": "Respiratory", "label": "Respiratory" },
    { "key": "page2.antenatalRisks", "value": "Others", "label": "Others:" },
    { "key": "footer.sex", "value": "M", "label": "M", "near": "Sex:" },
    { "key": "footer.sex", "value": "F", "label": "F", "near": "Sex:" }
  ]
}
```
Notes: the split runs before checks, so the `Others:` check finds the new label span. Use exact span texts from `spans.tsv` where they differ (e.g. `Nutritional (1/2-21  lbs/wk)` with a double space normalizes equal; `M.I` vs `M.I.` is a label and needs nothing). Run loop A–G.

---

### Task 10: Page 3 template

`scripts/pdfref/mappings/page3.json`:
```json
{
  "page": 3,
  "fields": [
    { "key": "page3.examDate" }, { "key": "page3.examTime", "near": "Time:" }, { "key": "page3.examiner" },
    { "key": "page3.bp", "near": "BP:" }, { "key": "page3.hr", "near": "HR:" }, { "key": "page3.rr", "near": "RR:" },
    { "key": "page3.temp", "near": "Temp." }, { "key": "page3.wt", "near": "Wt." }, { "key": "page3.ht", "near": "Ht." },
    { "key": "page3.bmi", "at": "⟨blank after 'BMI'⟩", "size": 7.33, "bold": true },
    { "key": "page3.ps", "at": "⟨blank after 'PS'⟩", "size": 7.33, "bold": true },
    { "key": "page3.gcs", "at": "⟨blank after 'GCS'⟩", "size": 7.33, "bold": true },
    { "key": "page3.heent" }, { "key": "page3.breast" }, { "key": "page3.chestLungs" }, { "key": "page3.cardiovascular" },
    { "key": "page3.abdomen", "near": "Abdomen:" }, { "key": "page3.fh" }, { "key": "page3.efw" }, { "key": "page3.fht" },
    { "key": "page3.l1" }, { "key": "page3.l2" }, { "key": "page3.l3" }, { "key": "page3.l4" },
    { "key": "page3.genitourinary" }, { "key": "page3.musculoskeletal" }, { "key": "page3.extremities" }, { "key": "page3.cns" },
    { "key": "page3.externalGenitals" }, { "key": "page3.uterus", "near": "Uterus:" }, { "key": "page3.vagina" },
    { "key": "page3.dilatation", "near": "Dilatation:" }, { "key": "page3.effacement" }, { "key": "page3.station", "near": "Station:" },
    { "key": "page1.admittingImpression", "box": "⟨below 'ADMITTING IMPRESSION' to the top of 'PLAN OF CARE:'⟩", "size": 7.33 },
    { "key": "page3.planOfCare", "box": "⟨below 'PLAN OF CARE:' to the rule above 'Officially Referred from/to:'⟩", "size": 7.33 },
    { "key": "page3.referredFromTo" }, { "key": "page3.historyBy", "near": "History by:" }, { "key": "page3.doneOn" },
    { "key": "footer.surname" }, { "key": "footer.givenName" }, { "key": "footer.mi" },
    { "key": "footer.age", "near": "Age:" }, { "key": "footer.hospNo", "align": "r" }, { "key": "footer.ward", "near": "Ward/Rm:" }
  ],
  "marks": [
    { "key": "page3.position", "value": "Anterior", "at": "⟨blank before 'Anterior'⟩", "size": 7.33 },
    { "key": "page3.position", "value": "Midposition", "near": "Midposition:" },
    { "key": "page3.position", "value": "Posterior", "at": "⟨blank before 'Posterior' (same row)⟩", "size": 7.33 },
    { "key": "page3.membranes", "value": "Intact", "near": "Membranes" },
    { "key": "page3.membranes", "value": "Ruptured", "at": "⟨blank after 'Ruptured:'⟩", "size": 7.33 }
  ],
  "checks": [
    { "key": "page3.generalStatus", "value": "Conscious", "label": "Conscious" },
    { "key": "page3.generalStatus", "value": "Coherent", "label": "Coherent" },
    { "key": "page3.generalStatus", "value": "Unconscious", "label": "Unconscious" },
    { "key": "page3.generalStatus", "value": "Distressed", "label": "Distressed" },
    { "key": "page3.generalStatus", "value": "Anxious", "label": "Anxious" },
    { "key": "page3.generalStatus", "value": "Cooperative", "label": "Cooperative" },
    { "key": "page3.generalStatus", "value": "Pale/Flushed", "label": "Pale/Flushed" },
    { "key": "page3.generalStatus", "value": "Others", "label": "Others" },
    { "key": "page3.amnioticFluid", "value": "Meconium Stained", "label": "Meconium Stained" },
    { "key": "page3.amnioticFluid", "value": "Clear", "label": "Clear" },
    { "key": "page3.pelvimetry", "value": "Contracted", "label": "Contracted" },
    { "key": "page3.pelvimetry", "value": "Border Line", "label": "Border Line" },
    { "key": "page3.pelvimetry", "value": "Adequate", "label": "Adequate" },
    { "key": "page3.pelvimetryPlanes", "value": "Inlet", "label": "Inlet" },
    { "key": "page3.pelvimetryPlanes", "value": "Midplane", "label": "Midplane" },
    { "key": "page3.pelvimetryPlanes", "value": "Outlet", "label": "Outlet" },
    { "key": "footer.sex", "value": "M", "label": "M", "near": "Sex:" },
    { "key": "footer.sex", "value": "F", "label": "F", "near": "Sex:" }
  ]
}
```
Notes: "Gravid"/"GRAVID" match case-insensitively, hence `near` on abdomen and uterus. "Dr. Guzman" is both examiner and history-by: `historyBy` (anchored) claims first, `examiner` (auto) takes the rest. The 'a.m. / p.m.' fragments are labels. Run loop A–G.

---

### Task 11: Page 4 template (scaled, chart)

`scripts/pdfref/mappings/page4.json`:
```json
{
  "page": 4,
  "fitWidth": { "frame": "⟨rect [x0, y0, x1, y1] of the thick frame drawing (left ≈ 18, top ≈ 54)⟩", "targetRight": 578.3 },
  "drop": { "fills": ["⟨hex colour of the blue series markers⟩"], "regions": [] },
  "chart": {
    "hourX": ["⟨x of tick label '0' under the chart (centre)⟩", "⟨x of tick label '10' (centre)⟩"],
    "dil": { "y3": "⟨y of the gridline labelled 3⟩", "y10": "⟨y of the gridline labelled 10⟩" },
    "stn": { "y0": "⟨y of the gridline labelled 0⟩", "yMinus5": "⟨y of the gridline labelled -5⟩" },
    "color": "⟨same hex as drop.fills⟩"
  },
  "fields": [
    { "key": "page4.onsetDate", "at": "⟨blank after 'ONSET DATE:'⟩", "size": 4.88, "bold": true },
    { "key": "page4.onsetTime", "at": "⟨blank after 'TIME:'⟩", "size": 4.88, "bold": true },
    { "key": "page4.fullDilatation" },
    { "key": "page4.delivery", "at": "⟨blank after 'DELIVERY'⟩", "size": 5.36, "bold": true },
    { "key": "page4.placenta", "at": "⟨blank after 'PLACENTA'⟩", "size": 5.36, "bold": true },
    { "key": "page4.totalDuration", "at": "⟨blank after 'TOTAL DURATION'⟩", "size": 4.88, "bold": true },
    { "key": "page4.firstStage", "at": "⟨blank after 'FIRST STAGE:'⟩", "size": 4.88, "bold": true },
    { "key": "page4.secondStage", "at": "⟨blank after 'SECOND STAGE:'⟩", "size": 4.88, "bold": true },
    { "key": "page4.thirdStage", "at": "⟨blank after 'THIRD STAGE:'⟩", "size": 4.88, "bold": true },
    { "key": "page4.promHours", "near": "PROM" },
    { "key": "footer.surname" }, { "key": "footer.givenName" }, { "key": "footer.mi" },
    { "key": "footer.age", "near": "Age:" }, { "key": "footer.hospNo", "align": "r" }, { "key": "footer.ward", "near": "Ward/Rm:" }
  ],
  "checks": [
    { "key": "page4.membranesStatus", "value": "Ruptured", "label": "Ruptured" },
    { "key": "page4.membranesStatus", "value": "Intact", "label": "Intact" },
    { "key": "page4.ruptureType", "value": "PROM", "label": "PROM" },
    { "key": "page4.ruptureType", "value": "EROM", "label": "EROM" },
    { "key": "page4.ruptureType", "value": "Cord Prolapse", "label": "Cord Prolapse" },
    { "key": "page4.ruptureType", "value": "Amnionitis", "label": "Amnionitis" },
    { "key": "page4.ruptureType", "value": "Amniotomy", "label": "Amniotomy" },
    { "key": "page4.ruptureType", "value": "Spontaneous", "label": "Spontaneous" },
    { "key": "page4.fluid", "value": "Clear", "label": "Clear" },
    { "key": "page4.fluid", "value": "Meconium Stained", "label": "Meconuim Stained" },
    { "key": "page4.meconium", "value": "Thick", "label": "Thick" },
    { "key": "page4.meconium", "value": "Thin", "label": "Thin" },
    { "key": "page4.progress", "value": "Normal", "label": "NORMAL", "near": "PROGRESS OF LABOR:" },
    { "key": "page4.progress", "value": "Abnormal", "label": "ABNORMAL" },
    { "key": "page4.abnormalType", "value": "Precipitate", "label": "Precipitate" },
    { "key": "page4.abnormalType", "value": "Prolonged", "label": "Prolonged" },
    { "key": "page4.abnormalType", "value": "Protracted", "label": "Protracted" },
    { "key": "page4.fetal", "value": "Normal", "label": "NORMAL", "near": "FETAL" },
    { "key": "page4.fetal", "value": "Distress", "label": "DISTRESS" },
    { "key": "footer.sex", "value": "M", "label": "M", "near": "Sex:" },
    { "key": "footer.sex", "value": "F", "label": "F", "near": "Sex:" }
  ]
}
```
Notes: "Meconuim" is the reference's own spelling — keep it as the label. The side table right of the frame is dropped by `fitWidth`; the chart's static axes/gridlines stay as paths, only the blue series is dropped and redrawn by `LaborChart`. Chart coordinates are in reference (untransformed) space — the template transform applies to them too. **After writing this mapping, re-run `rasterize.py`** so `tests/fidelity/reference/page4.png` is the transformed crop. In step D, check the markers at hour 0 (−3) and hour 10 (−5) line up. Run loop A–G.

---

### Task 12: Page 5 template

`scripts/pdfref/mappings/page5.json`:
```json
{
  "page": 5,
  "fields": [
    { "key": "page5.fetusDate", "near": "DELIVERY OF FETUS:" }, { "key": "page5.fetusTime", "near": "DELIVERY OF FETUS:" },
    { "key": "page5.attendedBy", "near": "Attended by:" },
    { "key": "page5.primaryCs.indication" },
    { "key": "page5.repeatCs.indication", "at": "⟨blank right of the Repeat CS 'INDICATION' (same x as the primary indication value)⟩", "size": 8.62, "bold": true },
    { "key": "page5.placentaDate", "near": "DELIVERY OF PLACENTA:" }, { "key": "page5.placentaTime", "near": "DELIVERY OF PLACENTA:" },
    { "key": "page5.placentaBy", "near": "By:" },
    { "key": "page5.postpartumBp", "near": "Blood Pressure:" }, { "key": "page5.bloodLoss", "near": "Blood Loss:" },
    { "key": "page5.complications", "near": "COMPLICATIONS:" },
    { "key": "page5.babySex", "near": "SEX:" }, { "key": "page5.babyWeight", "near": "WEIGHT:" },
    { "key": "page5.babyLength", "at": "⟨blank after 'LENGTH:'⟩", "size": 8.62, "bold": true },
    { "key": "page5.apgar1", "near": "1 min." }, { "key": "page5.apgar5", "near": "5 mins" },
    { "key": "page5.pediatricAging", "near": "Pediatric Aging:" },
    { "key": "page5.resuscitations", "at": "⟨blank after 'RESUSCITATIONS:'⟩", "size": 8.62, "bold": true },
    { "key": "page5.sga", "at": "⟨blank after 'SGA:'⟩", "size": 8.62, "bold": true },
    { "key": "page5.aga", "near": "AGA" },
    { "key": "page5.lga", "at": "⟨blank after 'LGA'⟩", "size": 8.62, "bold": true },
    { "key": "page5.abnormalities", "at": "⟨blank after 'ABNORMALITIES:'⟩", "size": 8.62, "bold": true },
    { "key": "footer.surname" }, { "key": "footer.givenName" }, { "key": "footer.mi" },
    { "key": "footer.age", "near": "Age:" }, { "key": "footer.hospNo", "align": "r" }, { "key": "footer.ward", "near": "Ward/Rm:" }
  ],
  "checks": [
    { "key": "page5.vaginalMethod", "value": "Spontaneous", "label": "Spontaneous", "near": "METHOD OF DELIVERY" },
    { "key": "page5.vaginalMethod", "value": "Assisted vaginal delivery", "label": "Assisted vaginal delivery" },
    { "key": "page5.vaginalMethod", "value": "Vacuum", "label": "Vacuum" },
    { "key": "page5.vaginalMethod", "value": "Forceps", "label": "Forceps" },
    { "key": "page5.vaginalMethod", "value": "Breech delivery", "label": "Breech delivery" },
    { "key": "page5.vaginalMethod", "value": "Breech Spontaneous", "label": "Spontaneous", "near": "Breech delivery" },
    { "key": "page5.vaginalMethod", "value": "Breech Partial", "label": "Partial" },
    { "key": "page5.vaginalMethod", "value": "Breech Total", "label": "Total", "near": "Partial" },
    { "key": "page5.vaginalMethod", "value": "Vaginal birth after CS", "label": "Vaginal birth after CS" },
    { "key": "page5.vaginalMethod", "value": "Anesthesia", "label": "Anesthesia" },
    { "key": "page5.vaginalMethod", "value": "Anesthesia Local", "label": "Local" },
    { "key": "page5.vaginalMethod", "value": "Anesthesia TIVA", "label": "TIVA" },
    { "key": "page5.vaginalMethod", "value": "Anesthesia Regional", "label": "Regional", "near": "TIVA" },
    { "key": "page5.vaginalMethod", "value": "Anesthesia Inhalational/GA", "label": "Inhalational /GA" },
    { "key": "page5.episiotomy", "value": "Median", "label": "Median" },
    { "key": "page5.episiotomy", "value": "Mediolateral", "label": "Mediolateral" },
    { "key": "page5.primaryCs.checked", "label": "Primary CS:" },
    { "key": "page5.primaryCs.incision", "value": "Low Transverse", "label": "Low Transverse", "near": "Primary CS:" },
    { "key": "page5.primaryCs.incision", "value": "Low Vertical", "label": "Low Vertical", "near": "Primary CS:" },
    { "key": "page5.primaryCs.incision", "value": "Classical", "label": "Classical", "near": "Primary CS:" },
    { "key": "page5.primaryCs.tubalLigation", "label": "w/ Tubal Ligation", "near": "Primary CS:" },
    { "key": "page5.primaryCs.indication", "label": "INDICATION", "near": "Primary CS:" },
    { "key": "page5.repeatCs.checked", "label": "Repeat CS:" },
    { "key": "page5.repeatCs.incision", "value": "Low Transverse", "label": "Low Transverse", "near": "Repeat CS:" },
    { "key": "page5.repeatCs.incision", "value": "Low Vertical", "label": "Low Vertical", "near": "Repeat CS:" },
    { "key": "page5.repeatCs.incision", "value": "Classical", "label": "Classical", "near": "Repeat CS:" },
    { "key": "page5.repeatCs.tubalLigation", "label": "w/ Tubal Ligation", "near": "Repeat CS:" },
    { "key": "page5.repeatCs.indication", "label": "INDICATION", "near": "CS Hysterectomy" },
    { "key": "page5.csHysterectomy.checked", "label": "CS Hysterectomy" },
    { "key": "page5.csHysterectomy.type", "value": "Total", "label": "Total", "near": "CS Hysterectomy" },
    { "key": "page5.csHysterectomy.type", "value": "Sub-Total", "label": "Sub-Total" },
    { "key": "page5.placentaMethod", "value": "Spontaneous", "label": "Spontaneous", "near": "DELIVERY OF PLACENTA:" },
    { "key": "page5.placentaMethod", "value": "Controlled Cord Traction", "label": "Controlled Cord Traction" },
    { "key": "page5.placentaMethod", "value": "Manual Extraction", "label": "Manual Extraction" },
    { "key": "page5.perinealRepair", "value": "1st Degree", "label": "1st Degree" },
    { "key": "page5.perinealRepair", "value": "2nd Degree", "label": "2nd Degree" },
    { "key": "page5.perinealRepair", "value": "3rd Degree", "label": "3rd Degree" },
    { "key": "page5.perinealRepair", "value": "4th Degree", "label": "4th Degree" },
    { "key": "page5.anesthesia", "value": "Local Infiltration", "label": "Local Infiltration" },
    { "key": "page5.anesthesia", "value": "Regional", "label": "Regional", "near": "Local Infiltration" },
    { "key": "page5.anesthesia", "value": "General", "label": "General" },
    { "key": "page5.postpartumCondition", "value": "Good", "label": "Good", "synthetic": true },
    { "key": "page5.postpartumCondition", "value": "Fair", "label": "Fair" },
    { "key": "page5.postpartumCondition", "value": "Poor", "label": "Poor" },
    { "key": "footer.sex", "value": "M", "label": "M", "near": "Sex:" },
    { "key": "footer.sex", "value": "F", "label": "F", "near": "Sex:" }
  ]
}
```
Notes: identical date/time texts (`10/12/2026`, `10:33 AM`) on two rows are separated by the `near` anchors. Use the exact printed span text for labels cut off in the reference (`Inhalational /GA` may be `Inhalational .`). `Good` has no box in the reference; the synthetic check draws one only when selected. Run loop A–G.

---

### Task 13: Page 6 template

`scripts/pdfref/mappings/page6.json`:
```json
{
  "page": 6,
  "fields": [
    { "key": "patient.lastName", "near": "NAME:" }, { "key": "patient.firstName", "near": "NAME:" }, { "key": "patient.middleName", "near": "NAME:" },
    { "key": "patient.admissionDateTime" },
    { "key": "page1.admittingImpression", "box": "⟨below 'ADMITTING DIAGNOSIS:' to the header block's bottom rule, left column⟩", "size": 7.6 },
    { "key": "page6.attendingPhysicians" },
    { "key": "patient.hospNo", "near": "HOSPITAL NUMBER:", "align": "r" },
    { "key": "footer.surname", "near": "Surname" }, { "key": "footer.givenName", "near": "Given Name" }, { "key": "footer.mi" },
    { "key": "footer.age", "near": "Age:" }, { "key": "footer.hospNo", "near": "Hospital No:", "align": "r" }, { "key": "footer.ward", "near": "Ward/Rm:" }
  ],
  "tables": [
    { "key": "page6.monitoring", "region": "⟨table body from row-1 top rule to last row bottom rule⟩",
      "columns": {
        "dateTime": "⟨x '10/12/2026' row 1⟩", "bp": "⟨x '120/80'⟩", "hr": "⟨HR cell left + 2⟩", "rr": "⟨RR cell left + 2⟩",
        "temp": "⟨Temp cell left + 2⟩", "uo": "⟨x '-'⟩", "fht": "⟨x '150s'⟩", "intv": "⟨x 'NONE'⟩",
        "dur": "⟨DUR cell left + 2⟩", "int": "⟨INT cell left + 2⟩", "dil": "⟨x 'SE: (+)…'⟩", "eff": "⟨EFF cell left + 2⟩",
        "pres": "⟨PRES cell left + 2⟩", "stn": "⟨STN cell left + 2⟩", "mem": "⟨MEM cell left + 2⟩", "nstCtg": "⟨x 'I'⟩",
        "remarks": "⟨REMARKS cell left + 2⟩"
      },
      "firstBaseline": "⟨baseline of row-1 values⟩", "pitch": "⟨row height from the horizontal rules⟩", "rows": 13, "size": 8.36 }
  ],
  "checks": [
    { "key": "footer.sex", "value": "M", "label": "M", "near": "Sex:" },
    { "key": "footer.sex", "value": "F", "label": "F", "near": "Sex:" }
  ]
}
```
Notes: the reference right-aligns HR/RR/Temp and prints the date at 6.08 pt. If those cells dominate the diff, extend the builder's table entry with `"align": { "hr": "r", "rr": "r", "temp": "r" }` (emit `al: "r"`, x = cell right − 2) and `"sizes": { "dateTime": 6.08 }`, each with a pytest case in `test_build_template.py`, then use them here. Row 1's IE text spans DIL…MEM; mapping it to `dil` reproduces that overflow. Run loop A–G.

---

### Task 14: Form UI (config-driven editor, live preview, autosave)

**Files:**
- Create: `components/form/config.ts`, `components/form/fields.tsx`, `components/form/FormEditor.tsx`, `components/form/Preview.tsx`, `components/PogsApp.tsx`
- Modify: `app/page.tsx`, `app/layout.tsx`, `app/globals.css` (remove scaffold dark-mode body colours)
- Test: `tests/unit/config.test.ts`

**Interfaces:**
- Consumes: `PogsForm`, `emptyForm`, options, `seedObHistory`, `loadDraft`, `saveDraft`, `safeStorage`, `Sheet`, `AllSheets`, `APP_ASSETS`, row factories, `getPath`.
- Produces: `FieldDef`, `SectionDef`, `PAGES`; `<FieldWidget def control register>`; `<FormEditor page control register>`; `<Preview form page>` (`data-testid="preview"`); `<PogsApp>` (client) owning `useForm<PogsForm>`.

- [ ] **Step 1: Failing test** — `tests/unit/config.test.ts`:
```ts
import { expect, test } from 'vitest';
import { PAGES } from '@/components/form/config';
import { emptyForm } from '@/lib/defaults';
import { getPath } from '@/lib/sheets/view';

test('every field path exists in the form with a matching type', () => {
  const f = emptyForm();
  for (const p of PAGES) for (const s of p.sections) for (const d of s.fields) {
    const v = getPath(f, d.path);
    if (d.kind === 'multi' || d.kind === 'table') expect(Array.isArray(v), d.path).toBe(true);
    else if (d.kind === 'bool') expect(typeof v, d.path).toBe('boolean');
    else expect(typeof v, d.path).toBe('string');
  }
});

test('six pages', () => expect(PAGES).toHaveLength(6));
```
Run → FAIL.

- [ ] **Step 2: Implement `components/form/config.ts`**
```ts
import * as O from '@/lib/options';

export type Column = { key: string; label: string };
export type FieldDef =
  | { kind: 'text'; path: string; label: string; wide?: boolean }
  | { kind: 'textarea'; path: string; label: string; rows?: number }
  | { kind: 'single'; path: string; label: string; options: string[] }
  | { kind: 'multi'; path: string; label: string; options: string[] }
  | { kind: 'bool'; path: string; label: string }
  | { kind: 'table'; path: string; label: string; columns: Column[]; maxRows: number; fixedRows?: number; rowLabel?: (i: number) => string };
export type SectionDef = { title: string; fields: FieldDef[] };

const t = (path: string, label: string, wide = false): FieldDef => ({ kind: 'text', path, label, wide });
const ta = (path: string, label: string, rows = 4): FieldDef => ({ kind: 'textarea', path, label, rows });
const one = (path: string, label: string, options: string[]): FieldDef => ({ kind: 'single', path, label, options });
const many = (path: string, label: string, options: string[]): FieldDef => ({ kind: 'multi', path, label, options });
const yes = (path: string, label: string): FieldDef => ({ kind: 'bool', path, label });

export const PAGES: { title: string; sections: SectionDef[] }[] = [
  { title: 'Page 1', sections: [
    { title: 'Patient', fields: [
      t('patient.lastName', 'Last name'), t('patient.firstName', 'First name'), t('patient.middleName', 'Middle name'),
      t('patient.age', 'Age'), one('patient.civilStatus', 'Civil status', O.CIVIL_STATUS),
      t('patient.hospNo', 'Hosp #'), t('patient.caseNo', 'Case #'), t('patient.room', 'Rm #'),
      t('patient.address', 'Address', true), t('patient.admissionDateTime', 'Date/time of admission', true),
    ] },
    { title: 'Diagnosis & labs', fields: [
      ta('page1.admittingImpression', 'Admitting impression', 3), ta('page1.finalDiagnosis', 'Final diagnosis', 6),
      t('page1.bloodType', 'Blood type'), t('page1.rh', 'Rh'), t('page1.vdrl', 'VDRL'), t('page1.hbsag', 'HBsAg'),
      t('page1.antibodies', 'Antibodies'), t('page1.chiefComplaint', 'Chief complaint', true),
    ] },
    { title: 'Obstetrical history', fields: [
      t('page1.obScore.g', 'G'), t('page1.obScore.p', 'P'), t('page1.obScore.ft', 'Ft'), t('page1.obScore.pr', 'Pr'),
      t('page1.obScore.ab', 'Ab'), t('page1.obScore.l', 'L'),
      { kind: 'table', path: 'page1.obHistory', label: 'Pregnancies', maxRows: 13, columns: [
        { key: 'order', label: 'Order' }, { key: 'outcome', label: 'Outcome' }, { key: 'year', label: 'Year' },
        { key: 'gestation', label: 'Gestation' }, { key: 'sex', label: 'Sex' }, { key: 'birthWeight', label: 'Birth wt' },
        { key: 'status', label: 'Status' }, { key: 'complications', label: 'Complications' },
      ] },
    ] },
    { title: 'Profile', fields: [
      one('page1.desiredFamilySize', 'Desired family size', O.FAMILY_SIZE), many('page1.contraception', 'Contraception', O.CONTRACEPTION),
      one('page1.education', 'Education', O.EDUCATION), one('page1.socioEconomic', 'Socio-economic', O.SOCIO), one('page1.income', 'Income', O.INCOME),
    ] },
    { title: 'Present pregnancy', fields: [
      t('page1.lmp', 'LMP'), t('page1.edc', 'EDC'), t('page1.pmp', 'PMP'), t('page1.aog', 'AOG'),
      t('page1.ultrasoundDate', 'Ultrasound date'), t('page1.quickeningDate', 'Date of quickening'),
      t('page1.adjustedEdc', 'Adjusted EDC'), t('page1.aogByUltrasound', 'AOG by ultrasound'),
      t('page1.menarche', 'Menarche at'), t('page1.interval', 'Interval'), t('page1.duration', 'Duration'),
      t('page1.amount', 'Amount'), t('page1.dysmenorrhea', 'Dysmenorrhea'), t('page1.coitarche', 'Coitarche at'),
      t('page1.sexualPartners', 'Sexual partners'), t('page1.stis', 'STIs'), t('page1.papsmear', 'Papsmear'),
    ] },
    { title: 'Prenatal care', fields: [
      one('page1.antenatalVisits', 'Antenatal visits', O.ANTENATAL_VISITS), many('page1.provider', 'Health care provider', O.PROVIDER),
      many('page1.immunizations', 'Immunizations', O.IMMUNIZATIONS), t('page1.totalWeightGain', 'Total weight gain'),
      t('page1.usualBp', 'Usual BP'), t('page1.hb', 'Hb'), t('page1.hct', 'Hct'), t('page1.urineChon', 'Urine CHON'),
      t('page1.fbs', 'FBS'), t('page1.ogtt', 'OGTT'), many('page1.supplements', 'Supplements', O.SUPPLEMENTS),
      t('page1.supplementsOther', 'Supplements — others'),
    ] },
  ] },
  { title: 'Page 2', sections: [
    { title: 'Antenatal program', fields: [many('page2.antenatalRisks', 'Risks', O.ANTENATAL_RISKS), t('page2.antenatalRisksOther', 'Others (specify)', true)] },
    { title: 'History', fields: [
      ta('page2.hpi', 'History of present illness', 8), ta('page2.pastHistory', 'Past history', 5),
      ta('page2.familyHistory', 'Family history', 3), ta('page2.personalSocialHistory', 'Personal-social history', 3),
      ta('page2.occupation', 'Occupation and environment', 3), t('page2.alcohol', 'Alcohol'), t('page2.tobacco', 'Tobacco/Cigarette'),
      t('page2.drugAllergies', 'Drug/Allergies'), t('page2.drugTherapy', 'Drug therapy'), t('page2.otherAllergies', 'Other allergies'),
    ] },
  ] },
  { title: 'Page 3', sections: [
    { title: 'Physical examination', fields: [
      t('page3.examDate', 'Date'), t('page3.examTime', 'Time'), t('page3.examiner', 'Examiner'),
      t('page3.bp', 'BP'), t('page3.hr', 'HR'), t('page3.rr', 'RR'), t('page3.temp', 'Temp'), t('page3.wt', 'Wt (kg)'),
      t('page3.ht', 'Ht (cm)'), t('page3.bmi', 'BMI (blank = auto)'), t('page3.ps', 'PS'), t('page3.gcs', 'GCS'),
      many('page3.generalStatus', 'General status', O.GENERAL_STATUS),
      t('page3.heent', 'HEENT', true), t('page3.breast', 'Breast', true), t('page3.chestLungs', 'Chest & lungs', true),
      t('page3.cardiovascular', 'Cardiovascular', true), t('page3.abdomen', 'Abdomen', true),
      t('page3.fh', 'FH'), t('page3.efw', 'EFW'), t('page3.fht', 'FHT'),
      t('page3.l1', 'L1'), t('page3.l2', 'L2'), t('page3.l3', 'L3'), t('page3.l4', 'L4'),
      t('page3.genitourinary', 'Genitourinary', true), t('page3.musculoskeletal', 'Musculoskeletal', true),
      t('page3.extremities', 'Extremities', true), t('page3.cns', 'CNS', true),
    ] },
    { title: 'Pelvic examination', fields: [
      t('page3.externalGenitals', 'External genitals'), t('page3.uterus', 'Uterus'), t('page3.vagina', 'Vagina'),
      t('page3.dilatation', 'Dilatation (cm)'), t('page3.effacement', 'Effacement'), one('page3.position', 'Position', O.CERVIX_POSITION),
      one('page3.membranes', 'Membranes', O.MEMBRANES), one('page3.amnioticFluid', 'Amniotic fluid', O.AMNIOTIC_FLUID),
      t('page3.station', 'Station'), one('page3.pelvimetry', 'Clinical pelvimetry', O.PELVIMETRY),
      many('page3.pelvimetryPlanes', 'Planes', O.PELVIC_PLANES),
    ] },
    { title: 'Plan', fields: [
      ta('page3.planOfCare', 'Plan of care', 3), t('page3.referredFromTo', 'Officially referred from/to', true),
      t('page3.historyBy', 'History by'), t('page3.doneOn', 'Done on'),
    ] },
  ] },
  { title: 'Page 4', sections: [
    { title: 'Labor', fields: [
      t('page4.onsetDate', 'Onset date'), t('page4.onsetTime', 'Onset time'), t('page4.fullDilatation', 'Full dilatation'),
      t('page4.delivery', 'Delivery'), t('page4.placenta', 'Placenta'), t('page4.totalDuration', 'Total duration (hrs)'),
      t('page4.firstStage', 'First stage (hrs)'), t('page4.secondStage', 'Second stage (hrs)'), t('page4.thirdStage', 'Third stage (hrs)'),
      { kind: 'table', path: 'page4.laborTable', label: 'Hours in labor (chart)', maxRows: 11, fixedRows: 11, rowLabel: (i) => `${i} h`,
        columns: [{ key: 'dilatation', label: 'Cervical dilatation' }, { key: 'station', label: 'Station' }] },
    ] },
    { title: 'Membranes & progress', fields: [
      one('page4.membranesStatus', 'Membranes', O.MEMBRANE_STATUS), many('page4.ruptureType', 'Rupture', O.RUPTURE_TYPE),
      t('page4.promHours', 'PROM hours'), one('page4.fluid', 'Fluid', O.FLUID), one('page4.meconium', 'Meconium', O.MECONIUM),
      one('page4.progress', 'Progress of labor', O.PROGRESS), one('page4.abnormalType', 'Abnormal', O.ABNORMAL_TYPE),
      one('page4.fetal', 'Fetal', O.FETAL),
    ] },
  ] },
  { title: 'Page 5', sections: [
    { title: 'Delivery of fetus', fields: [
      t('page5.fetusDate', 'Date'), t('page5.fetusTime', 'Time'), t('page5.attendedBy', 'Attended by'),
      many('page5.vaginalMethod', 'Method of delivery', O.VAGINAL_METHOD), one('page5.episiotomy', 'Episiotomy', O.EPISIOTOMY),
    ] },
    { title: 'Abdominal delivery', fields: [
      yes('page5.primaryCs.checked', 'Primary CS'), one('page5.primaryCs.incision', 'Primary CS incision', O.CS_INCISION),
      yes('page5.primaryCs.tubalLigation', 'Primary CS w/ tubal ligation'), t('page5.primaryCs.indication', 'Primary CS indication', true),
      yes('page5.repeatCs.checked', 'Repeat CS'), one('page5.repeatCs.incision', 'Repeat CS incision', O.CS_INCISION),
      yes('page5.repeatCs.tubalLigation', 'Repeat CS w/ tubal ligation'), t('page5.repeatCs.indication', 'Repeat CS indication', true),
      yes('page5.csHysterectomy.checked', 'CS hysterectomy'), one('page5.csHysterectomy.type', 'Hysterectomy type', O.HYSTERECTOMY),
    ] },
    { title: 'Placenta & postpartum', fields: [
      t('page5.placentaDate', 'Placenta date'), t('page5.placentaTime', 'Placenta time'), t('page5.placentaBy', 'By'),
      one('page5.placentaMethod', 'Placenta delivery', O.PLACENTA_METHOD), t('page5.postpartumBp', 'Postpartum BP (mmHg)'),
      t('page5.bloodLoss', 'Blood loss (cc)'), one('page5.perinealRepair', 'Perineal repair', O.PERINEAL),
      one('page5.anesthesia', 'Anesthesia', O.ANESTHESIA), t('page5.complications', 'Complications', true),
      one('page5.postpartumCondition', 'Postpartum condition', O.CONDITION),
    ] },
    { title: 'Fetal outcome', fields: [
      t('page5.babySex', 'Sex'), t('page5.babyWeight', 'Weight'), t('page5.babyLength', 'Length'),
      t('page5.apgar1', 'APGAR 1 min'), t('page5.apgar5', 'APGAR 5 min'), t('page5.pediatricAging', 'Pediatric aging'),
      t('page5.resuscitations', 'Resuscitations'), t('page5.sga', 'SGA'), t('page5.aga', 'AGA'), t('page5.lga', 'LGA'),
      t('page5.abnormalities', 'Abnormalities', true),
    ] },
  ] },
  { title: 'Page 6', sections: [
    { title: 'Antepartum monitoring', fields: [
      t('page6.attendingPhysicians', 'Attending physicians', true),
      { kind: 'table', path: 'page6.monitoring', label: 'Monitoring rows', maxRows: 13, columns: [
        { key: 'dateTime', label: 'Date/time' }, { key: 'bp', label: 'BP' }, { key: 'hr', label: 'HR' }, { key: 'rr', label: 'RR' },
        { key: 'temp', label: 'Temp' }, { key: 'uo', label: 'UO' }, { key: 'fht', label: 'FHT' }, { key: 'intv', label: 'INTV' },
        { key: 'dur', label: 'DUR' }, { key: 'int', label: 'INT' }, { key: 'dil', label: 'DIL' }, { key: 'eff', label: 'EFF' },
        { key: 'pres', label: 'PRES' }, { key: 'stn', label: 'STN' }, { key: 'mem', label: 'MEM' }, { key: 'nstCtg', label: 'NST/CTG' },
        { key: 'remarks', label: 'Remarks' },
      ] },
    ] },
  ] },
];
```

- [ ] **Step 3: Implement `components/form/fields.tsx`**
```tsx
'use client';
import { Controller, useFieldArray, type Control, type UseFormRegister } from 'react-hook-form';
import type { PogsForm } from '@/lib/schema';
import type { FieldDef } from './config';
import { emptyLaborRow, emptyMonitoringRow, emptyObRow } from '@/lib/defaults';

type Props = { def: FieldDef; control: Control<PogsForm>; register: UseFormRegister<PogsForm> };
const input = 'w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none';
const ROW_FACTORY: Record<string, () => Record<string, string>> = {
  'page1.obHistory': emptyObRow, 'page4.laborTable': emptyLaborRow, 'page6.monitoring': emptyMonitoringRow,
};

export function FieldWidget({ def, control, register }: Props) {
  // Config paths are checked against emptyForm() by tests/unit/config.test.ts.
  const name = def.path as never;
  switch (def.kind) {
    case 'text':
      return <label className={def.wide ? 'col-span-2' : ''}><span className="text-xs text-slate-600">{def.label}</span><input className={input} {...register(name)} /></label>;
    case 'textarea':
      return <label className="col-span-2"><span className="text-xs text-slate-600">{def.label}</span><textarea className={input} rows={def.rows} {...register(name)} /></label>;
    case 'bool':
      return <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" {...register(name)} />{def.label}</label>;
    case 'single':
    case 'multi':
      return (
        <fieldset className="col-span-2">
          <legend className="text-xs text-slate-600">{def.label}</legend>
          <Controller control={control} name={name} render={({ field }) => {
            const value = field.value as unknown;
            const on = (o: string) => (def.kind === 'multi' ? (value as string[]).includes(o) : value === o);
            const toggle = (o: string) => {
              if (def.kind === 'multi') {
                const cur = value as string[];
                field.onChange(cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]);
              } else field.onChange(value === o ? '' : o);
            };
            return (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {def.options.map((o) => (
                  <label key={o} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={on(o)} onChange={() => toggle(o)} />{o}
                  </label>
                ))}
              </div>
            );
          }} />
        </fieldset>
      );
    case 'table':
      return <TableWidget def={def} control={control} register={register} />;
  }
}

function TableWidget({ def, control, register }: {
  def: Extract<FieldDef, { kind: 'table' }>; control: Control<PogsForm>; register: UseFormRegister<PogsForm>;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: def.path as never });
  return (
    <div className="col-span-2 overflow-x-auto">
      <div className="text-xs text-slate-600">{def.label}</div>
      <table className="text-xs">
        <thead><tr>{def.rowLabel && <th />}{def.columns.map((c) => <th key={c.key} className="px-1 text-left font-medium">{c.label}</th>)}<th /></tr></thead>
        <tbody>
          {fields.map((f, i) => (
            <tr key={f.id}>
              {def.rowLabel && <td className="pr-1 text-slate-500">{def.rowLabel(i)}</td>}
              {def.columns.map((c) => (
                <td key={c.key}><input aria-label={`${c.label} ${i + 1}`} className="w-24 rounded border border-slate-300 px-1 py-0.5" {...register(`${def.path}.${i}.${c.key}` as never)} /></td>
              ))}
              <td>{!def.fixedRows && <button type="button" className="px-1 text-red-600" onClick={() => remove(i)} aria-label="Remove row">✕</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!def.fixedRows && fields.length < def.maxRows && (
        <button type="button" className="mt-1 text-xs text-sky-700" onClick={() => append(ROW_FACTORY[def.path]() as never)}>+ Add row</button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implement `FormEditor.tsx`, `Preview.tsx`, `PogsApp.tsx`, `app/page.tsx`**

`components/form/FormEditor.tsx`:
```tsx
'use client';
import type { Control, UseFormRegister } from 'react-hook-form';
import type { PogsForm } from '@/lib/schema';
import { PAGES } from './config';
import { FieldWidget } from './fields';

export function FormEditor({ page, control, register }: { page: number; control: Control<PogsForm>; register: UseFormRegister<PogsForm> }) {
  return (
    <div className="space-y-6">
      {PAGES[page - 1].sections.map((s) => (
        <section key={s.title}>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">{s.title}</h3>
          <div className="grid grid-cols-2 gap-3">
            {s.fields.map((d) => <FieldWidget key={d.path} def={d} control={control} register={register} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
```

`components/form/Preview.tsx`:
```tsx
'use client';
import type { PogsForm } from '@/lib/schema';
import { Sheet } from '@/lib/sheets/Sheet';
import { APP_ASSETS } from '@/lib/sheets/assets';

export function Preview({ form, page }: { form: PogsForm; page: number }) {
  return (
    <div className="mx-auto max-w-[820px] bg-white shadow" data-testid="preview">
      <Sheet page={page} form={form} assets={APP_ASSETS} fluid />
    </div>
  );
}
```

`components/PogsApp.tsx`:
```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { PogsForm } from '@/lib/schema';
import { emptyForm } from '@/lib/defaults';
import { loadDraft, saveDraft, safeStorage } from '@/lib/storage';
import { seedObHistory } from '@/lib/derive';
import { AllSheets } from '@/lib/sheets/Sheet';
import { APP_ASSETS } from '@/lib/sheets/assets';
import { FormEditor } from './form/FormEditor';
import { Preview } from './form/Preview';

export function PogsApp() {
  const { control, register, reset, getValues, setValue } = useForm<PogsForm>({ defaultValues: emptyForm() });
  const form = useWatch({ control }) as PogsForm;
  const [page, setPage] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [autosave, setAutosave] = useState(true);
  const loaded = useRef(false);

  useEffect(() => {
    if (!safeStorage()) { setAutosave(false); loaded.current = true; return; }
    const draft = loadDraft();
    if (draft) reset(draft);
    loaded.current = true;
  }, [reset]);

  useEffect(() => {
    if (!loaded.current || !autosave) return;
    const id = setTimeout(() => saveDraft(getValues()), 500);
    return () => clearTimeout(id);
  }, [form, autosave, getValues]);

  const g = form.page1?.obScore?.g ?? '';
  useEffect(() => {
    const rows = getValues('page1.obHistory');
    const seeded = seedObHistory(rows, g);
    if (seeded.length !== rows.length) setValue('page1.obHistory', seeded);
  }, [g, getValues, setValue]);

  return (
    <>
      <div className="no-print flex h-screen flex-col bg-white text-slate-900">
        {!autosave && <div className="bg-amber-100 px-4 py-1 text-xs text-amber-900">Autosave is off (browser storage unavailable). Use Save .json to keep your work.</div>}
        <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
          <h1 className="mr-4 font-semibold">POGS Generator</h1>
          {[1, 2, 3, 4, 5, 6].map((p) => (
            <button key={p} type="button" onClick={() => setPage(p)}
              className={`rounded px-3 py-1 text-sm ${p === page ? 'bg-sky-600 text-white' : 'bg-slate-100'}`}>Page {p}</button>
          ))}
          <button type="button" className="ml-auto rounded bg-slate-100 px-3 py-1 text-sm lg:hidden" onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? 'Form' : 'Preview'}
          </button>
        </header>
        <main className="grid min-h-0 flex-1 lg:grid-cols-2">
          <div className={`overflow-y-auto p-4 ${showPreview ? 'hidden lg:block' : ''}`}>
            <FormEditor page={page} control={control} register={register} />
          </div>
          <div className={`overflow-y-auto bg-slate-200 p-4 ${showPreview ? '' : 'hidden lg:block'}`}>
            <Preview form={form} page={page} />
          </div>
        </main>
      </div>
      <div className="print-only"><AllSheets form={form} assets={APP_ASSETS} /></div>
    </>
  );
}
```

`app/page.tsx`:
```tsx
import { PogsApp } from '@/components/PogsApp';

export default function Home() {
  return <PogsApp />;
}
```
In `app/layout.tsx` set `export const metadata = { title: 'POGS Generator', description: 'Generate the VSMMC POGS Obstetrical Sheet' };`. In `app/globals.css` delete the scaffold's `prefers-color-scheme: dark` block and body colour rules (keep the Tailwind import and the Task 7 additions).

- [ ] **Step 5: Run** — `npm test` → PASS. `npm run dev`, open `/`: type a last name on Page 1 and confirm the preview updates; switch tabs; reload and confirm the draft persists.

- [ ] **Step 6: Commit** — `git add components app tests/unit/config.test.ts && git commit -m "feat: config-driven form with live preview and autosave"`

---

### Task 15: Toolbar (save / load / new / sample / print)

**Files:**
- Create: `components/form/Toolbar.tsx`, `components/Toast.tsx`
- Modify: `components/PogsApp.tsx`

**Interfaces:**
- Consumes: `serializeForm`, `parseFormFile`, `emptyForm`, `sampleForm`.
- Produces: `type ToastMsg = { text: string; action?: { label: string; run: () => void } }`; `<Toast msg onClose>` (`role="status"`); `<Toolbar getValues reset notify onDownload>`; `downloadBlob(blob, filename)`.

- [ ] **Step 1: Implement `components/Toast.tsx`**
```tsx
'use client';

export type ToastMsg = { text: string; action?: { label: string; run: () => void } };

export function Toast({ msg, onClose }: { msg: ToastMsg | null; onClose: () => void }) {
  if (!msg) return null;
  return (
    <div role="status" className="no-print fixed bottom-4 right-4 z-50 flex max-w-md items-center gap-3 rounded bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
      <span className="whitespace-pre-line">{msg.text}</span>
      {msg.action && (
        <button type="button" className="rounded bg-sky-500 px-2 py-1" onClick={() => { msg.action!.run(); onClose(); }}>{msg.action.label}</button>
      )}
      <button type="button" aria-label="Dismiss" onClick={onClose}>✕</button>
    </div>
  );
}
```

- [ ] **Step 2: Implement `components/form/Toolbar.tsx`**
```tsx
'use client';
import { useRef, useState } from 'react';
import type { PogsForm } from '@/lib/schema';
import { emptyForm, sampleForm } from '@/lib/defaults';
import { parseFormFile, serializeForm } from '@/lib/storage';
import type { ToastMsg } from '../Toast';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const fileBase = (f: PogsForm) => (f.patient.lastName.trim() || 'patient').replace(/[^\w .-]/g, '_');
const btn = 'rounded bg-slate-100 px-3 py-1 text-sm hover:bg-slate-200 disabled:opacity-50';

export function Toolbar({ getValues, reset, notify, onDownload }: {
  getValues: () => PogsForm; reset: (f: PogsForm) => void; notify: (m: ToastMsg) => void; onDownload: () => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function load(file: File) {
    try {
      const { form, skipped } = parseFormFile(await file.text());
      reset(form);
      notify({ text: skipped.length ? `Loaded with ${skipped.length} skipped field(s):\n${skipped.slice(0, 8).join(', ')}` : 'Loaded.' });
    } catch (e) {
      notify({ text: (e as Error).message });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="rounded bg-sky-600 px-3 py-1 text-sm text-white disabled:opacity-50" disabled={busy}
        onClick={async () => { setBusy(true); try { await onDownload(); } finally { setBusy(false); } }}>
        {busy ? 'Generating…' : 'Download PDF'}
      </button>
      <button type="button" className={btn} onClick={() => window.print()}>Print</button>
      <button type="button" className={btn}
        onClick={() => downloadBlob(new Blob([serializeForm(getValues())], { type: 'application/json' }), `${fileBase(getValues())} POGS.json`)}>
        Save .json
      </button>
      <button type="button" className={btn} onClick={() => fileRef.current?.click()}>Load .json</button>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden data-testid="load-input"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void load(f); e.target.value = ''; }} />
      <button type="button" className={btn} onClick={() => { if (confirm('Clear all fields for a new patient?')) reset(emptyForm()); }}>New patient</button>
      <button type="button" className={btn} onClick={() => reset(sampleForm())}>Load sample</button>
    </div>
  );
}
```

- [ ] **Step 3: Wire into `PogsApp.tsx`** — import `Toolbar`, `Toast`, `ToastMsg`; add `const [toast, setToast] = useState<ToastMsg | null>(null);`; add a temporary `const downloadPdf = async () => window.print();` (replaced in Task 16); render below the tab header:
```tsx
<div className="border-b px-4 py-2"><Toolbar getValues={getValues} reset={(f) => reset(f)} notify={setToast} onDownload={downloadPdf} /></div>
```
and `<Toast msg={toast} onClose={() => setToast(null)} />` as the last child of the `.no-print` wrapper.

- [ ] **Step 4: Manual check** — Save .json → New patient → Load .json restores fields; loading a text file shows "Not a valid JSON file"; Print shows six A4 sheets and no app chrome.

- [ ] **Step 5: Commit** — `git add components && git commit -m "feat: toolbar with save/load/new/sample/print"`

---

### Task 16: Server PDF endpoint and download

**Files:**
- Create: `lib/pdf/renderHtml.tsx`, `lib/pdf/browser.ts`, `pages/api/pdf.ts`
- Modify: `components/PogsApp.tsx`
- Test: `tests/api/pdf.spec.ts`

**Interfaces:**
- Consumes: `AllSheets`, `coerceForm`, `serializeForm`, `downloadBlob`.
- Produces: `renderSheetsHtml(form: PogsForm): string`; `htmlToPdf(html: string): Promise<Buffer>`; `POST /api/pdf` → 200 PDF | 400 `{ error, skipped? }` | 405 | 500 `{ error }`.

- [ ] **Step 1: Write the failing API test** — `tests/api/pdf.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { emptyForm, sampleForm } from '../../lib/defaults';

test('sample form → 6 A4 pages', async ({ request }) => {
  const res = await request.post('/api/pdf', { data: sampleForm() });
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/pdf');
  expect(res.headers()['content-disposition']).toContain('DELA CRUZ POGS.pdf');
  const doc = await PDFDocument.load(await res.body());
  expect(doc.getPageCount()).toBe(6);
  for (const p of doc.getPages()) {
    expect(Math.abs(p.getWidth() - 595.28)).toBeLessThan(1.5);
    expect(Math.abs(p.getHeight() - 841.89)).toBeLessThan(1.5);
  }
});

test('missing last name → 400', async ({ request }) => {
  const res = await request.post('/api/pdf', { data: emptyForm() });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toMatch(/last name/i);
});

test('wrong shape → 400 with skipped paths', async ({ request }) => {
  const res = await request.post('/api/pdf', { data: { patient: { lastName: 'X', age: { bad: 1 } } } });
  expect(res.status()).toBe(400);
  expect((await res.json()).skipped).toContain('patient.age');
});

test('GET → 405', async ({ request }) => {
  expect((await request.get('/api/pdf')).status()).toBe(405);
});
```
Run: `npx playwright test --project=api` → FAIL (404).

- [ ] **Step 2: Implement `lib/pdf/renderHtml.tsx`**
```tsx
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PogsForm } from '@/lib/schema';
import { AllSheets } from '@/lib/sheets/Sheet';

const pub = (...p: string[]) => path.join(process.cwd(), 'public', ...p);
const b64 = (file: string) => fs.readFileSync(file).toString('base64');

let cache: { css: string; assets: Record<string, string> } | null = null;

function embedded() {
  if (cache) return cache;
  const css = `
@font-face { font-family: 'Arimo'; src: url(data:font/woff2;base64,${b64(pub('fonts', 'arimo-400.woff2'))}) format('woff2'); font-weight: 400; }
@font-face { font-family: 'Arimo'; src: url(data:font/woff2;base64,${b64(pub('fonts', 'arimo-700.woff2'))}) format('woff2'); font-weight: 700; }
@page { size: A4; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
.sheet { display: block; break-after: page; }
.sheet:last-child { break-after: auto; }`;
  const assets = {
    'header.png': `data:image/png;base64,${b64(pub('sheet-assets', 'header.png'))}`,
    'seal.png': `data:image/png;base64,${b64(pub('sheet-assets', 'seal.png'))}`,
  };
  cache = { css, assets };
  return cache;
}

export function renderSheetsHtml(form: PogsForm): string {
  const { css, assets } = embedded();
  const body = renderToStaticMarkup(<AllSheets form={form} assets={assets} />);
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`;
}
```

- [ ] **Step 3: Implement `lib/pdf/browser.ts`**
```ts
import puppeteer, { type Browser } from 'puppeteer-core';

const LOCAL_CHROME = process.platform === 'win32'
  ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/google-chrome';

async function launch(): Promise<Browser> {
  if (process.env.VERCEL) {
    const chromium = (await import('@sparticuz/chromium')).default;
    return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  }
  return puppeteer.launch({ executablePath: process.env.CHROME_PATH || LOCAL_CHROME, headless: true });
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 4: Implement `pages/api/pdf.ts`**
```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { coerceForm } from '@/lib/storage';
import { renderSheetsHtml } from '@/lib/pdf/renderHtml';
import { htmlToPdf } from '@/lib/pdf/browser';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { form, skipped } = coerceForm(req.body);
  if (skipped.length) return res.status(400).json({ error: 'Invalid fields', skipped });
  if (!form.patient.lastName.trim()) return res.status(400).json({ error: 'Patient last name is required' });
  try {
    const pdf = await htmlToPdf(renderSheetsHtml(form));
    const name = `${form.patient.lastName.trim().replace(/[^\w .-]/g, '_')} POGS.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(pdf);
  } catch (e) {
    // Never log the request body or patient fields.
    console.error('pdf generation failed:', (e as Error).name);
    return res.status(500).json({ error: 'PDF generation failed' });
  }
}
```

- [ ] **Step 5: Real download in `PogsApp.tsx`** — replace the temporary `downloadPdf`:
```tsx
async function downloadPdf() {
  const values = getValues();
  if (!values.patient.lastName.trim()) { setToast({ text: 'Enter the patient last name first (Page 1).' }); return; }
  try {
    const res = await fetch('/api/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: serializeForm(values) });
    if (!res.ok) throw new Error(String(res.status));
    downloadBlob(await res.blob(), `${values.patient.lastName.trim()} POGS.pdf`);
  } catch {
    setToast({ text: 'Server PDF failed — use Print instead.', action: { label: 'Print', run: () => window.print() } });
  }
}
```
(import `serializeForm` from `@/lib/storage` and `downloadBlob` from `./form/Toolbar`.)

- [ ] **Step 6: Run** — `npx playwright test --project=api` → PASS. In the UI, Load .json `fixtures/reference.json`, Download PDF, and open it next to the references to confirm all six pages match.

- [ ] **Step 7: Commit** — `git add lib/pdf pages components tests/api && git commit -m "feat: server PDF endpoint with print fallback"`

---

### Task 17: End-to-end tests and deploy readiness

**Files:**
- Create: `tests/e2e/app.spec.ts`

**Interfaces:**
- Consumes: the running app (Tasks 14–16).

- [ ] **Step 1: Write tests** — `tests/e2e/app.spec.ts`:
```ts
import fs from 'node:fs';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('typing updates preview', async ({ page }) => {
  await page.getByLabel('Last name').fill('TESTNAME');
  await expect(page.getByTestId('preview')).toContainText('TESTNAME');
});

test('autosave survives reload', async ({ page }) => {
  await page.getByLabel('Last name').fill('PERSIST');
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.getByLabel('Last name')).toHaveValue('PERSIST');
});

test('save → new → load round-trip', async ({ page }) => {
  await page.getByLabel('Last name').fill('ROUNDTRIP');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save .json' }).click()]);
  const file = await dl.path();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'New patient' }).click();
  await expect(page.getByLabel('Last name')).toHaveValue('');
  await page.getByTestId('load-input').setInputFiles(file!);
  await expect(page.getByLabel('Last name')).toHaveValue('ROUNDTRIP');
  expect(JSON.parse(fs.readFileSync(file!, 'utf8')).patient.lastName).toBe('ROUNDTRIP');
});

test('invalid file shows error and keeps form', async ({ page }) => {
  await page.getByLabel('Last name').fill('KEEP');
  await page.getByTestId('load-input').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('nope') });
  await expect(page.getByRole('status')).toContainText('Not a valid JSON file');
  await expect(page.getByLabel('Last name')).toHaveValue('KEEP');
});

test('page tabs switch the editor', async ({ page }) => {
  await page.getByRole('button', { name: 'Page 2' }).click();
  await expect(page.getByLabel('History of present illness')).toBeVisible();
});
```

- [ ] **Step 2: Run everything**
```bash
npm test && npx playwright test && npm run build
```
Expected: unit, fidelity (six pages < 1.5 %), API and E2E all pass; production build succeeds; with `npm run start`, `/dev/sheet/1` returns 404.

- [ ] **Step 3: Commit** — `git add tests/e2e && git commit -m "test: end-to-end coverage for editor, autosave, save/load"`

- [ ] **Step 4: Deploy** — outward-facing: ask the user before running `vercel deploy`. No env vars needed (`VERCEL` is set automatically and switches Chromium to `@sparticuz/chromium`).

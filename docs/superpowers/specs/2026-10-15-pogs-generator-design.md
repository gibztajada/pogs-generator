# POGS Generator — Design Spec

Date: 2026-10-15
Status: Revised after reference-PDF analysis (A4, extraction-driven templates)

## 1. Purpose

A Next.js web app where a VSMMC clerk/resident fills in one OB patient's data in a structured form and downloads the 6-page **POGS Obstetrical Sheet** (form code `MSD-OB.GYNE-F-1 Rev. 4`, September 1, 2025) as a PDF. Concept follows the gregorylearns Forms Generator (form in, filled PDF out), but output is this specific 6-page sheet.

**Success criteria**

1. Generated pages visually match the reference patient's files `… POGS 2 - Page 1.pdf`, `page 2.pdf`, `Sheet3.pdf` … `Sheet6.pdf` in layout, borders, rule weights, column widths, label positions, font family, font weight, font size, checkbox glyphs, header and footer — verified by pixel-diff (§8.1). Page 4 is the agreed exception (§5.6).
2. One patient's data entered once flows to every place it appears on all 6 pages.
3. Work survives a page refresh and can be saved/resumed as a file.

## 2. Decisions (agreed)

| Topic | Decision |
|---|---|
| Framework | Next.js, TypeScript |
| Input style | Structured form (fields, checkbox groups, editable tables) |
| Persistence | localStorage autosave + `.json` export/import per patient |
| Hosting | Vercel, with server features |
| PDF approach | Sheets rendered as SVG from extracted templates; server renders PDF via headless Chrome. Browser Print as fallback |
| Fidelity | Exact replication of reference layout, font weights and font sizes |
| Paper | **A4**, 595 × 842 pt, portrait (measured from the references) |
| Page 4 | Bordered form scaled up to full frame width; labor side table not printed |

## 3. Reference analysis (facts the design relies on)

- All six references are A4 (595 × 842 pt), exported from Google Sheets.
- All text is `ArialMT` / `Arial-BoldMT`. Each page has its own scale, so sizes differ per page: body text 7.53 pt (p1), 8.58 (p2), 7.33 (p3), 4.88 (p4), 8.62 (p5), 7.6 (p6); plus per-page variants (e.g. p1 title 15.06 bold, p1 final diagnosis 3.77, p6 values 8.36/9.12 bold).
- The p1 header is two embedded PNGs: hospital text block (568×152 px at 109.5,60.4–350.5,116.6) and seal (201×168 px at 35.9,60.4–109.5,116.6).
- Checkboxes are filled vector paths (~6.3 pt square on p2); unchecked = rounded ring, checked = ring + check strokes.
- Rules: outer frame ~1.98 pt, inner rules ~0.66 pt.
- Labor chart (p4) is vector drawings.

## 4. Architecture

**Stack:** Next.js + TypeScript; Tailwind for app UI only; React Hook Form; Zod; `puppeteer-core` + `@sparticuz/chromium`; Vitest; Playwright (local Chrome channel); Python 3 + PyMuPDF for reference tooling (dev-time only).

**Extraction-driven templates.** A dev-time Python builder reads each reference PDF and writes `lib/sheets/templates/pageN.json`: every vector path (frame, rules, chart grid), every static label (text, baseline x/y, size, weight), images, checkbox slots, and field slots. Field slots replace the patient values found in the reference, located by matching against a git-ignored fixture of the reference patient's data and a committed per-page mapping (`scripts/pdfref/mappings/pageN.json`) that names the field key for each slot. Committed templates therefore contain form structure only — no patient data. A generic `<TemplatePage>` renders a template plus form values as one SVG at 595 × 842 user units = pt.

```
app/
  page.tsx                   split view: form | live preview
  dev/sheet/[page]/page.tsx  dev-only: renders one sheet from fixture (fidelity tests)
pages/api/pdf.ts             POST form JSON → 6-page A4 PDF
lib/
  schema.ts  options.ts      Zod schema + PogsForm type; checkbox option lists
  defaults.ts                emptyForm(), sampleForm() (fictitious)
  derive.ts                  buildView (footer, BMI), seedObHistory, laborPoints
  storage.ts                 coerceForm, draft autosave, JSON export/import
  sheets/                    template types, TemplatePage, fit, view helpers, LaborChart, Sheet(s), templates/*.json
  pdf/                       renderSheetsHtml, htmlToPdf
components/form/             config-driven form, toolbar, preview
public/fonts/  public/sheet-assets/   Arimo woff2; header.png, seal.png
scripts/pdfref/              extract assets/glyphs, dump, rasterize, build_template, mappings/
scripts/dump-view.ts         fixture → flat view JSON for the builder
tests/unit  tests/fidelity  tests/api  tests/e2e
```

The PDF endpoint is a Pages Router API route so `react-dom/server` can be used without App Router restrictions.

## 5. Sheet rendering (fidelity)

1. **Geometry** comes from the reference vector data, not hand measurement; coordinates are kept in pt.
2. **Typography.** Labels keep their extracted size and weight exactly. Field slots take the size/weight of the reference value they replace. Font: Arimo (metric-compatible with Arial), bundled and embedded in PDFs.
3. **Glyphs.** Checkbox glyph paths are extracted from the reference (p2 has both states) and normalized; slots reuse the reference box position and size.
4. **Header.** Both header PNGs extracted from the p1 PDF and placed at their exact rectangles.
5. **Footer.** Form code, revision date and "Page N of 6" are static labels from the references; patient identity blocks on p2–p6 are field slots fed by `buildView().footer`.
6. **Page 4.** Template is scaled about the frame's top-left so the frame spans the same width as the other pages' frames (right edge 578.3 pt). The side table outside the frame is dropped. The chart's data series are drawn by `LaborChart` from the labor table; static axes/grid come from the reference. Its fidelity reference is the original page rasterized with the same transform and cropped to the frame.
7. **Overflow.** Multiline boxes wrap and shrink-to-fit deterministically (character-width estimate, min 3 pt). Single-line slots with a width compress via `textLength` when too long.
8. **Pagination.** One SVG per A4 page, `break-after: page`; exactly 6 pages.

## 6. Data model (`PogsForm`)

Strings unless noted (free-form clinical entry); multi-select = string[]; `schemaVersion: 1`.

- **patient** — lastName, firstName, middleName, age, civilStatus (`M|S|W|Sep`), hospNo, caseNo, room, address, admissionDateTime. Sex fixed **F** on footers.
- **page1** — admittingImpression, finalDiagnosis, bloodType, rh, vdrl, hbsag, antibodies, chiefComplaint; obScore {g, p, ft, pr, ab, l}; obHistory[] (max 13) {order, outcome, year, gestation, sex, birthWeight, status, complications}; desiredFamilySize; contraception[]; education; socioEconomic; income; lmp, edc, pmp, aog, ultrasoundDate, quickeningDate, adjustedEdc, aogByUltrasound; menarche, interval, duration, amount, dysmenorrhea; coitarche, sexualPartners, stis, papsmear; antenatalVisits; provider[]; immunizations[]; totalWeightGain, usualBp, hb, hct, urineChon, fbs, ogtt; supplements[], supplementsOther.
- **page2** — antenatalRisks[], antenatalRisksOther; hpi, pastHistory, familyHistory, personalSocialHistory, occupation, alcohol, tobacco, drugAllergies, drugTherapy, otherAllergies.
- **page3** — examDate, examTime, examiner; bp, hr, rr, temp, wt, ht, bmi (derived when blank), ps, gcs; generalStatus[]; heent, breast, chestLungs, cardiovascular, abdomen, fh, efw, fht, l1–l4, genitourinary, musculoskeletal, extremities, cns; externalGenitals, uterus, vagina, dilatation, effacement, position, membranes, amnioticFluid, station; pelvimetry, pelvimetryPlanes[]; planOfCare, referredFromTo, historyBy, doneOn. Admitting impression is read from page1.
- **page4** — onsetDate, onsetTime, fullDilatation, delivery, placenta, totalDuration, firstStage, secondStage, thirdStage; laborTable (exactly 11 rows, hours 0–10) {dilatation, station}; membranesStatus, ruptureType[], promHours, fluid, meconium; progress, abnormalType; fetal.
- **page5** — fetusDate, fetusTime, attendedBy; vaginalMethod[]; episiotomy; primaryCs {checked: boolean, incision, tubalLigation: boolean, indication}; repeatCs {same}; csHysterectomy {checked: boolean, type}; placentaDate, placentaTime, placentaBy, placentaMethod; postpartumBp, bloodLoss; perinealRepair; anesthesia; complications; postpartumCondition; babySex, babyWeight, babyLength, apgar1, apgar5, pediatricAging, resuscitations, sga, aga, lga, abnormalities.
- **page6** — attendingPhysicians; monitoring[] (max 13) {dateTime, bp, hr, rr, temp, uo, fht, intv, dur, int, dil, eff, pres, stn, mem, nstCtg, remarks}.

Option lists live in `lib/options.ts`. Derived view adds `footer` {surname, givenName, mi, age, sex: 'F', hospNo, ward} and BMI = wt / (ht in m)² to 1 decimal when blank and both numeric.

## 7. Form UI

- Desktop: left form with tabs **Page 1–6**; right live preview of the active page (SVG, scales to panel width). Narrow screens: preview behind a toggle.
- Config-driven fields: text, textarea, single-choice (radio-like, deselectable), multi-choice, boolean, editable tables (OB history seeded G1…Gn from G; labor table fixed 0–10; monitoring add/remove, max 13).
- Toolbar: **Download PDF**, **Print**, **Save .json**, **Load .json**, **New patient** (confirm), **Load sample** (fictitious).
- Validation is light: only patient last name required for Download.

## 8. PDF route and error handling

`POST /api/pdf`: coerce body against the schema → 400 with skipped paths if any field has the wrong shape, 400 if last name blank → `renderSheetsHtml` (self-contained HTML, base64 fonts and header images) → Chromium `page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })` → `application/pdf`, `attachment; filename="<LASTNAME> POGS.pdf"`. No persistence; bodies never logged. `maxDuration` 60 s via `vercel.json`.

| Failure | Behavior |
|---|---|
| Server PDF error/timeout | Toast "Server PDF failed — use Print instead" with one-click browser print |
| Bad/old `.json` on Load | Valid fields loaded, skipped paths listed |
| localStorage unavailable | Autosave disabled, small banner |

Browser **Print** renders all six SVG sheets with `@page { size: A4; margin: 0 }` and hides app chrome — fully on-device.

## 9. Testing

1. **Fidelity (acceptance).** References rasterized at 192 dpi; Playwright screenshots each dev-route sheet at device scale 2 (same pixel grid) and pixelmatch-diffs; per-page max mismatch ratio 1.5% (tunable once per page, then locked). Diff images in `tests/fidelity/output/`.
2. **Unit (Vitest).** derive, storage/coercion, fit, view helpers, TemplatePage rendering, PHI guard (no fixture identity value appears in any committed template).
3. **Python (pytest).** Builder and extraction on synthetic PDFs.
4. **API (Playwright request).** Sample → 200, 6 A4 pages; missing last name → 400.
5. **E2E.** Typing updates preview; Save/Load round-trip; autosave survives reload.

## 10. Privacy

- The reference patient's data is real patient information: reference PDFs, `fixtures/`, rasterized references and fidelity outputs are git-ignored. Builder output is checked by the PHI guard test. Reference PDF filenames are never written in code: scripts resolve them from the git-ignored `fixtures/ref-sources.json` (page number → filename).
- Committed "Load sample" uses fictitious data.
- Server PDF path transmits patient data to Vercel per request; nothing stored or logged. Browser Print keeps data on-device.

## 11. Out of scope

User accounts, database, batch output, access-code gate, editing on the preview, text-paste import.

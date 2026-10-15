# POGS Generator — Design Spec

Date: 2026-10-15
Status: Draft for review

## 1. Purpose

A Next.js web app where a VSMMC clerk/resident fills in one OB patient's data in a structured form and downloads the 6-page **POGS Obstetrical Sheet** (form code `MSD-OB.GYNE-F-1 Rev. 4`, September 1, 2025) as a PDF. Concept follows the gregorylearns Forms Generator (form in, filled PDF out), but output is this specific 6-page sheet.

**Success criteria**

1. Generated pages visually match the reference files `SOSTINO POGS 2 - Page 1.pdf`, `page 2.pdf`, `Sheet3.pdf` … `Sheet6.pdf` in layout, borders, column widths, label positions, font family, font weight, font size, checkbox glyphs, header and footer — verified by pixel-diff (§8.1).
2. One patient's data entered once flows to every place it appears on all 6 pages.
3. Work survives a page refresh and can be saved/resumed as a file.

## 2. Decisions (agreed)

| Topic | Decision |
|---|---|
| Framework | Next.js (App Router), TypeScript |
| Input style | Structured form (fields, checkbox groups, editable tables) |
| Persistence | localStorage autosave + `.json` export/import per patient |
| Hosting | Vercel, with server features |
| PDF approach | HTML/CSS replica components; server renders via headless Chrome. Browser Print as fallback |
| Fidelity | Exact replication of reference layout, font weights and font sizes |
| Paper | US Letter, 8.5 × 11 in, portrait |

## 3. Architecture

**Stack:** Next.js + TypeScript; Tailwind for the app UI only; plain CSS (pt units) for sheet components; React Hook Form + Zod; `puppeteer-core` + `@sparticuz/chromium` in an API route; Vitest; Playwright.

```
app/
  page.tsx                 split view: form (left) | live preview (right)
  api/pdf/route.ts         POST PogsForm JSON → 6-page PDF
lib/
  schema.ts                Zod schema + `PogsForm` type (single source of truth)
  defaults.ts              emptyForm(), sampleForm() (fictitious data)
  derive.ts                footer fields, BMI, OB-history rows, labor chart points
  storage.ts               autosave, export/import, schemaVersion migration
  typography.ts            named text styles extracted from reference PDFs
components/
  form/                    one section component per sheet page + Toolbar
  sheets/Page1..Page6.tsx  pure print replicas: (form) → markup
  sheets/primitives.tsx    Checkbox, Blank, RuledTable, SheetFrame, PatientFooter, FormCode
  sheets/LaborChart.tsx    inline SVG dilatation/station chart
  sheets/sheet.css         page geometry, borders, fonts
public/
  fonts/                   Arimo (Arial-metric), Tinos (Times-metric)
  vsmmc-seal.png           extracted from reference Page 1 PDF
scripts/
  extract-typography.py    pdfplumber dump of font/size/weight/position per text span
  rasterize-references.*   reference PDFs → PNGs for pixel-diff
tests/
  unit/  api/  e2e/  fidelity/
```

Sheet components are pure and shared by the live preview and the PDF route, so preview equals output.

## 4. Data model (`PogsForm`)

All fields optional strings unless noted; numbers stored as strings to keep entry free-form (clinical notes are messy). Includes `schemaVersion: 1`.

- **patient** — lastName, firstName, middleName, age, civilStatus (`M|S|W|Sep`), hospNo, caseNo, room, address, admissionDateTime. Sex is fixed **F** on all footers.
- **page1** — admittingImpression, finalDiagnosis, bloodType, rh, vdrl, hbsag, antibodies, chiefComplaint; obScore {G, P, Ft, Pr, Ab, L}; obHistory[] {order, outcome, year, gestation, sex, birthWeight, status, complications}; desiredFamilySize (`1|2|3|4|more`); contraception[] (`None, Pills, IUD, Rhythm, Condom`); education (`None|Primary|Secondary|College`); socioEconomic (`Dependent/Unemployed|Employed|Self-Employed`); income (`Below|Minimum|Above`); lmp, edc, pmp, aog, ultrasoundDate, quickeningDate, adjustedEdc, aogByUltrasound; menarche, interval, duration, amount, dysmenorrhea; coitarche, sexualPartners, stis, papsmear; antenatalVisits (`None|1|2|3|4|5|>5`); provider[] (`MD, MW, Others`); immunizations[] (`TT, Td, Tdap, Hep B, Others`); totalWeightGain, usualBp, hb, hct, urineChon, fbs, ogtt; supplements[] (`Vitamins, Fe, Ca, Others`), supplementsOther.
- **page2** — antenatalRisks[] (Anemia, HTN/Preeclampsia/CHVD, Fetal Wastage, Previous CS/Surgery, Cardiac, Premature labor, UTI, Renal, IUGR, Infections LC Tracts, Diabetes Mellitus, Infertility, Nutritional, Respiratory, Others), antenatalRisksOther; hpi, pastHistory, familyHistory, personalSocialHistory, occupation, alcohol, tobacco, drugAllergies, drugTherapy, otherAllergies.
- **page3** — examDate, examTime, examiner; bp, hr, rr, temp, wt, ht, bmi (derived, overridable), ps, gcs; generalStatus[] (Conscious, Coherent, Unconscious, Distressed, Anxious, Cooperative, Pale/Flushed, Others); heent, breast, chestLungs, cardiovascular, abdomen, fh, efw, fht, l1–l4, genitourinary, musculoskeletal, extremities, cns; externalGenitals, uterus, vagina, dilatation, effacement, position (`Anterior|Midposition|Posterior`), membranes (`Intact|Ruptured`), amnioticFluid (`Meconium Stained|Clear`), station; pelvimetry (`Contracted|Border Line|Adequate`), pelvimetryPlanes[] (Inlet, Midplane, Outlet); planOfCare, referredFromTo, historyBy, doneOn. Admitting impression comes from page1.
- **page4** — onsetDate, onsetTime, fullDilatation, delivery, placenta, totalDuration, firstStage, secondStage, thirdStage; laborTable[11] {hour 0–10, dilatation, station}; membranesStatus (`Ruptured|Intact`), ruptureType[] (PROM + hours, EROM, Cord Prolapse, Amnionitis, Amniotomy, Spontaneous), fluid (`Clear|Meconium Stained`), meconium (`Thick|Thin`); progress (`Normal|Abnormal`), abnormalType (`Precipitate|Prolonged|Protracted`); fetal (`Normal|Distress`).
- **page5** — fetusDate, fetusTime, attendedBy; vaginalMethod[] (Spontaneous, Assisted vaginal delivery, Vacuum, Forceps, Breech delivery, Breech Spontaneous/Partial/Total, VBAC, Anesthesia Local/TIVA/Regional/Inhalational); episiotomy (`Median|Mediolateral`); primaryCs {checked, incision (`Low Transverse|Low Vertical|Classical`), tubalLigation, indication}; repeatCs {same}; csHysterectomy (`Total|Sub-Total`); placentaDate, placentaTime, placentaBy, placentaMethod (`Spontaneous|Controlled Cord Traction|Manual Extraction`); postpartumBp, bloodLoss; perinealRepair (`1st..4th`); anesthesia (`Local Infiltration|Regional|General`); complications; postpartumCondition (`Good|Fair|Poor`); babySex, babyWeight, babyLength, apgar1, apgar5, pediatricAging, resuscitations, sga, aga, lga, abnormalities.
- **page6** — attendingPhysicians; monitoring[] (max 13) {dateTime, bp, hr, rr, temp, uo, fht, intv, dur, int, dil, eff, pres, stn, mem, nstCtg, remarks}.

**Derived (`derive.ts`)**: footer block (surname, given name, M.I., age, sex F, hosp no, ward/rm) for pages 2–6; full-name line for page 6; BMI = wt(kg)/(ht(m))² to 1 decimal when both numeric; OB-history row count = max(G, existing rows); labor chart points from non-empty laborTable cells.

## 5. Sheet rendering (fidelity)

1. **Measurement.** Rasterize each reference PDF at high DPI; take exact page margins, frame borders, rule positions, row heights and column widths. The references were exported from Google Sheets, so each page is rebuilt on a fixed grid (CSS Grid / absolutely sized tables in pt) on a fixed 612 × 792 pt page — never fluid.
2. **Typography.** `scripts/extract-typography.py` (pdfplumber) records font family, weight, italic and point size for every text span on all 6 pages. Results become named styles in `lib/typography.ts` (e.g. `title`, `headerSerif`, `headerSerifItalic`, `label`, `labelBold`, `value`, `valueBold`, `valueSmall`, `tableHeader`, `formCode`). Every sheet element uses a named style; no ad-hoc sizes. Fonts: Arimo for Arial/Helvetica, Tinos for Times, bundled locally and embedded in the PDF.
3. **Glyphs.** Unchecked = hollow square (☐), checked = filled check-square, matching reference glyphs and size. Underlined blanks keep fixed length whether filled or empty.
4. **Header.** VSMMC block reproduced exactly: seal (extracted from Page 1 PDF), "Republic of the Philippines / Department of Health / VICENTE SOTTO MEMORIAL MEDICAL CENTER / (Formerly Southern Islands Medical Center)", italic underlined "PhilHealth Center of Excellence", and the "POGS OBSTETRICAL SHEET" title cell.
5. **Footer.** Bottom-right of every page, outside the frame: `MSD-OB.GYNE-F-1 Rev. 4` / `September 1, 2025` / `Page N of 6`. Patient identity block inside the frame on pages 2–6 as in references.
6. **Page 4.** The hours-in-labor side table (outside the frame in the reference) is the chart's data source; it is a form input and is **not printed**. The chart is an inline SVG matching the reference axes (dilatation 3–10 upper panel, station 0 to −5 lower panel, hours 0–10, "STATION" legend).
7. **Overflow.** Fixed boxes never reflow the page; long text (e.g. final diagnosis) is shrunk-to-fit within its box, mirroring the reference's small text.
8. **Pagination.** One sheet per Letter page via `break-after: page`; exactly 6 pages.

## 6. Form UI

- Desktop: left form with tabs **Page 1–6**; right live preview of the active page at true proportions with zoom. Narrow screens: preview behind a toggle.
- Checkbox groups mirror the sheet: single-choice groups behave as radios (deselectable); multi-choice allow many.
- Editable grids: OB history (rows G1…Gn seeded from G), labor table (fixed 0–10), monitoring (add/remove, max 13).
- Textareas for HPI, histories, diagnoses, plan.
- Toolbar: **Download PDF**, **Print**, **Save .json**, **Load .json**, **New patient** (confirm), **Load sample** (fictitious data).
- Validation is light: types enforced, only patient last name required for Download; blanks warn, never block.

## 7. PDF route and error handling

`POST /api/pdf` (Node runtime, `maxDuration` raised for cold start):

1. Parse body with Zod → 400 with field list on failure.
2. `renderToStaticMarkup(<Sheets form={...} />)` into a self-contained HTML document with inlined CSS, base64 fonts and seal (no network fetches).
3. Launch Chromium (`@sparticuz/chromium` on Vercel; local Chrome in dev), `page.pdf({ format: 'Letter', printBackground: true, preferCSSPageSize: true })`.
4. Respond `application/pdf`, `Content-Disposition: attachment; filename="<LASTNAME> POGS.pdf"`.
5. No persistence; request bodies and patient fields are never logged.

| Failure | Behavior |
|---|---|
| Server PDF error/timeout | Toast "Server PDF failed — use Print instead" with one-click browser print |
| Bad/old `.json` on Load | Zod parse; load valid fields, list skipped ones; `schemaVersion` migration hook |
| localStorage unavailable | Autosave disabled, small banner |

Browser **Print** uses the same sheet components with `@page { size: letter; margin: 0 }` and hides app chrome — fully on-device.

## 8. Testing

1. **Fidelity (acceptance).** Reference PDFs rasterized to PNG. Playwright renders each sheet with the SOSTINO fixture at identical DPI and pixel-diffs (pixelmatch); per-page mismatch threshold (target ≤ 2% of pixels, tuned once per page then locked). Diff images saved under `tests/fidelity/output/`. Iterate page by page until all six pass.
2. **Typography check.** Run `extract-typography.py` on a generated PDF and compare span font/weight/size against the reference dump for matching labels.
3. **Unit (Vitest).** `derive.ts` (BMI, footer mapping, OB rows, chart points), schema parsing, JSON round-trip, migration.
4. **API.** POST sample → 200, `application/pdf`, 6 pages, Letter size, text contains key values.
5. **E2E.** Fill fields → preview updates; Save/Load round-trip; New patient clears.

## 9. Privacy

- SOSTINO data is real patient information. It is used only as a **local, git-ignored** fixture (`fixtures/`, reference PDFs, rasterized PNGs, fidelity outputs are all in `.gitignore`).
- Committed "Load sample" uses fictitious data with the same shape.
- Server PDF path transmits patient data to Vercel per request; nothing is stored or logged. Browser Print path keeps data on-device.

## 10. Out of scope

User accounts, database, batch/multi-patient output, access-code gate, editing directly on the preview, text-paste import.

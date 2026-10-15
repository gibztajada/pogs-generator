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

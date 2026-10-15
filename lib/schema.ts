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

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

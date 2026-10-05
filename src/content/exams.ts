/**
 * Exam reference content. Deliberately contains NO dates, seat counts,
 * question counts or registration status: those change every year and the
 * previous version showed stale 2025 dates as "Registration open".
 *
 * Every URL here must be re-checked each admission cycle. `verified` records
 * when a person last confirmed the link resolves to the official site.
 */
export interface ExamInfo {
  id: string;
  type: 'JEE_MAIN' | 'JEE_ADVANCED' | 'NEET' | 'CAT' | 'GATE';
  name: string;
  conductingBody: string;
  officialSite: { label: string; url: string } | null;
  counselling: { label: string; url: string }[];
  leadsTo: string;
  howToReadScore: string;
  notes?: string;
  verified: string; // YYYY-MM or "needs verification"
}

export const EXAMS: ExamInfo[] = [
  {
    id: 'jee-main',
    type: 'JEE_MAIN',
    name: 'JEE Main',
    conductingBody: 'National Testing Agency (NTA)',
    // Third-party sites cite both jeemain.nta.nic.in and jeemain.nta.ac.in.
    officialSite: { label: 'jeemain.nta.nic.in', url: 'https://jeemain.nta.nic.in' },
    counselling: [{ label: 'JoSAA (NITs, IIITs, GFTIs)', url: 'https://josaa.nic.in' }],
    leadsTo: 'B.Tech/B.E. admission at NITs, IIITs and other centrally funded institutes through JoSAA, and qualification for JEE Advanced.',
    howToReadScore: 'JoSAA uses your Common Rank List (CRL) rank for OPEN seats and your category rank for EWS, OBC-NCL, SC and ST seats.',
    notes: 'Many states and private universities run their own admissions; check each institute.',
    verified: 'needs verification',
  },
  {
    id: 'jee-advanced',
    type: 'JEE_ADVANCED',
    name: 'JEE Advanced',
    conductingBody: 'One of the IITs, on rotation',
    officialSite: { label: 'jeeadv.ac.in', url: 'https://jeeadv.ac.in' },
    counselling: [{ label: 'JoSAA (IITs)', url: 'https://josaa.nic.in' }],
    leadsTo: 'Admission to the IITs through JoSAA.',
    howToReadScore: 'Same rule as JoSAA: CRL for OPEN seats, category rank for reserved seats. Ranks marked with a "P" come from the preparatory rank list.',
    verified: 'needs verification',
  },
  {
    id: 'neet',
    type: 'NEET',
    name: 'NEET UG',
    conductingBody: 'National Testing Agency (NTA)',
    officialSite: { label: 'neet.nta.nic.in', url: 'https://neet.nta.nic.in' },
    counselling: [
      { label: 'MCC (All India Quota, deemed and central universities)', url: 'https://mcc.nic.in' },
      { label: 'Your state’s medical counselling authority (State Quota)', url: 'https://www.nmc.org.in' },
    ],
    leadsTo: 'MBBS, BDS and other medical seats through MCC and state counselling.',
    howToReadScore: 'All India Quota allotment uses your All India Rank; state quota rules differ by state.',
    verified: '2026-10',
  },
  {
    id: 'cat',
    type: 'CAT',
    name: 'CAT',
    conductingBody: 'One of the IIMs, on rotation',
    officialSite: { label: 'iimcat.ac.in', url: 'https://iimcat.ac.in' },
    counselling: [],
    leadsTo: 'Shortlisting for MBA/PGP programmes at IIMs and many other B-schools.',
    howToReadScore: 'CAT gives a percentile. Most institutes then combine it with academics, interviews and other criteria, so a percentile alone does not decide admission.',
    verified: 'needs verification',
  },
  {
    id: 'gate',
    type: 'GATE',
    name: 'GATE',
    conductingBody: 'IISc and the IITs, on rotation',
    officialSite: null,
    counselling: [],
    leadsTo: 'M.Tech/M.E. admissions (many through COAP or CCMT) and some PSU recruitment.',
    howToReadScore: 'Admissions usually use your GATE score (out of 1000), not your rank. Cut-offs differ by institute, programme and category.',
    notes: 'The official GATE website moves to the organising institute each year. Find it from the organising IIT/IISc’s own site.',
    verified: 'needs verification',
  },
];

export const OFFICIAL_RESOURCES = [
  { name: 'JoSAA', what: 'Engineering counselling for IITs, NITs, IIITs and GFTIs, including past opening and closing ranks.', url: 'https://josaa.nic.in' },
  { name: 'Medical Counselling Committee (MCC)', what: 'NEET UG All India Quota counselling and seat allotment results.', url: 'https://mcc.nic.in' },
  { name: 'National Medical Commission (NMC)', what: 'Regulator for medical education; lists of recognised medical colleges.', url: 'https://www.nmc.org.in' },
  { name: 'NIRF', what: 'Official national rankings published by the Ministry of Education.', url: 'https://www.nirfindia.org' },
  { name: 'AISHE', what: 'All India Survey on Higher Education: official institution codes and statistics.', url: 'https://aishe.gov.in' },
  { name: 'NAAC', what: 'Accreditation status and grades of colleges and universities.', url: 'https://www.naac.gov.in' },
  { name: 'AICTE', what: 'Regulator for technical education; lists of approved institutions.', url: 'https://www.aicte.gov.in' },
  { name: 'National Scholarship Portal', what: 'Central and state government scholarships in one application.', url: 'https://scholarships.gov.in' },
  { name: 'Open Government Data (data.gov.in)', what: 'Government datasets, mostly under the Government Open Data License – India.', url: 'https://data.gov.in' },
];

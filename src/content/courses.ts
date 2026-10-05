/**
 * Course reference content. No salary or fee figures: the previous version
 * showed invented ranges (e.g. "Judge — ₹10-30 LPA") as facts. Fees shown on
 * course pages come from college records, each with its data status.
 */
export interface CourseInfo {
  slug: string;
  name: string;
  fullName: string;
  level: 'Undergraduate' | 'Postgraduate' | 'Doctoral';
  duration: string;
  description: string;
  eligibility: string;
  typicalExams: string[];
  careerPaths: string[];
  courseFilter: string;
}

export const COURSES: CourseInfo[] = [
  {
    slug: 'btech', name: 'B.Tech', fullName: 'Bachelor of Technology', level: 'Undergraduate', duration: '4 years',
    description: 'Engineering degree in disciplines such as Computer Science, Electronics, Electrical, Mechanical, Civil and Chemical Engineering, combining theory, labs and project work.',
    eligibility: 'Class 12 with Physics and Mathematics; the third subject and minimum marks depend on the institute and counselling body. JoSAA admissions to NITs, IIITs and GFTIs have an additional Class 12 performance rule — read the JoSAA business rules for your year.',
    typicalExams: ['JEE Main', 'JEE Advanced', 'State engineering entrance/counselling', 'Institute-specific tests'],
    careerPaths: ['Software and IT', 'Core engineering industries', 'Public sector (often via GATE)', 'Higher studies (M.Tech, MS, MBA)'],
    courseFilter: 'B.Tech',
  },
  {
    slug: 'mbbs', name: 'MBBS', fullName: 'Bachelor of Medicine, Bachelor of Surgery', level: 'Undergraduate', duration: '5.5 years including a one-year compulsory internship',
    description: 'The primary medical qualification in India, covering pre-clinical, para-clinical and clinical phases followed by a rotating internship.',
    eligibility: 'Class 12 with Physics, Chemistry, Biology/Biotechnology and English, and a qualifying NEET UG result. Minimum marks and age rules are set by the National Medical Commission — check the current NEET information bulletin.',
    typicalExams: ['NEET UG'],
    careerPaths: ['Clinical practice', 'Postgraduate specialisation (MD/MS)', 'Public health', 'Medical research'],
    courseFilter: 'MBBS',
  },
  {
    slug: 'mba', name: 'MBA', fullName: 'Master of Business Administration', level: 'Postgraduate', duration: 'Usually 2 years',
    description: 'Management programme covering finance, marketing, operations, strategy and people management, usually with an internship.',
    eligibility: 'A bachelor’s degree, usually with a minimum aggregate set by each institute, plus an entrance test score and often interviews.',
    typicalExams: ['CAT', 'XAT', 'GMAT', 'CMAT', 'MAT'],
    careerPaths: ['Consulting', 'Finance', 'Marketing and sales', 'Operations', 'Entrepreneurship'],
    courseFilter: 'MBA',
  },
  {
    slug: 'bba', name: 'BBA', fullName: 'Bachelor of Business Administration', level: 'Undergraduate', duration: '3 or 4 years',
    description: 'Undergraduate introduction to management, accounting, marketing and economics.',
    eligibility: 'Class 12 in any stream; minimum marks vary by university.',
    typicalExams: ['CUET UG', 'IPMAT', 'University-specific tests'],
    careerPaths: ['Business operations', 'Sales and marketing', 'Further study (MBA)'],
    courseFilter: 'BBA',
  },
  {
    slug: 'bsc', name: 'B.Sc', fullName: 'Bachelor of Science', level: 'Undergraduate', duration: '3 or 4 years',
    description: 'Science degree in subjects such as Physics, Chemistry, Mathematics, Biology, Statistics or Computer Science.',
    eligibility: 'Class 12 with science subjects; requirements vary by university and subject.',
    typicalExams: ['CUET UG', 'IISER Aptitude Test', 'University-specific tests'],
    careerPaths: ['Research (M.Sc, PhD)', 'Data and analytics', 'Teaching', 'Laboratory and industry roles'],
    courseFilter: 'B.Sc',
  },
  {
    slug: 'llb', name: 'LLB', fullName: 'Bachelor of Laws', level: 'Undergraduate', duration: '3 years (after a degree) or 5 years (integrated, after Class 12)',
    description: 'Law degree; the 5-year integrated programmes (BA LLB, BBA LLB and others) are offered by National Law Universities and many other institutions.',
    eligibility: 'Class 12 for 5-year programmes, or a bachelor’s degree for 3-year LLB, with minimum marks set by each institution.',
    typicalExams: ['CLAT', 'AILET', 'LSAT India', 'University-specific tests'],
    careerPaths: ['Litigation', 'Corporate law', 'Judicial services', 'Policy and research'],
    courseFilter: 'LLB',
  },
  {
    slug: 'mtech', name: 'M.Tech', fullName: 'Master of Technology', level: 'Postgraduate', duration: '2 years',
    description: 'Specialised postgraduate engineering degree, often research-oriented.',
    eligibility: 'B.Tech/B.E. or equivalent; most institutes admit using GATE scores, some use their own tests.',
    typicalExams: ['GATE'],
    careerPaths: ['Research and development', 'Teaching', 'Specialist industry roles', 'PhD'],
    courseFilter: 'M.Tech',
  },
  {
    slug: 'bcom', name: 'B.Com', fullName: 'Bachelor of Commerce', level: 'Undergraduate', duration: '3 or 4 years',
    description: 'Degree in accounting, finance, taxation, business law and economics.',
    eligibility: 'Class 12, usually with commerce subjects; requirements vary by university.',
    typicalExams: ['CUET UG', 'University-specific tests'],
    careerPaths: ['Accounting and audit', 'Banking and finance', 'Professional courses (CA, CS, CMA)', 'MBA'],
    courseFilter: 'B.Com',
  },
  {
    slug: 'phd', name: 'PhD', fullName: 'Doctor of Philosophy', level: 'Doctoral', duration: 'Typically 3–6 years',
    description: 'Research degree awarded for an original thesis.',
    eligibility: 'A master’s degree (or a bachelor’s for some integrated programmes) plus an entrance test or qualifying exam such as UGC NET, CSIR NET or GATE, and an interview.',
    typicalExams: ['UGC NET', 'CSIR NET', 'GATE', 'Institute-specific tests'],
    careerPaths: ['Academia', 'Research labs', 'Industry research', 'Policy'],
    courseFilter: 'PhD',
  },
];

export const COURSE_SLUGS = COURSES.map((c) => c.slug);

export function getCourse(slug: string) {
  return COURSES.find((c) => c.slug === slug);
}

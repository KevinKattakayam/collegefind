export type CollegeType = 'GOVERNMENT' | 'PRIVATE';
export type DataStatus = 'DEMO' | 'UNVERIFIED' | 'VERIFIED';
export type ExamType = 'JEE_MAIN' | 'JEE_ADVANCED' | 'NEET' | 'CAT' | 'GATE';
export type SeatCategory = 'OPEN' | 'EWS' | 'OBC_NCL' | 'SC' | 'ST';
export type ViewMode = 'grid' | 'list';

/** Matches `collegeListSelect` in src/server/colleges.ts. Null means "unknown". */
export interface College {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  city: string;
  state: string;
  type: CollegeType;
  establishedYear: number | null;
  totalStudents: number | null;
  naacGrade: string | null;
  annualFees: number | null;
  placementPct: number | null;
  avgPackage: number | null;
  highestPackage: number | null;
  metricsYear: number | null;
  courses: string[];
  topRecruiters: string[];
  rating: number | null;
  reviewCount: number;
  dataStatus: DataStatus;
}

export interface CollegeDetail extends College {
  description: string | null;
  about: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  aisheCode: string | null;
  updatedAt: string;
}

export interface SavedComparison {
  id: string;
  collegeIds: string[];
  createdAt: string;
  colleges?: College[];
}

export interface Question {
  id: string;
  text: string;
  createdAt: string;
  user: { name: string };
  _count?: { answers: number };
}

export interface Answer {
  id: string;
  text: string;
  createdAt: string;
  user: { name: string };
}

export interface CollegesResponse {
  colleges: College[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CutoffRow {
  exam: ExamType;
  year: number;
  round: number;
  quota: string;
  category: SeatCategory;
  seatPool: 'GENDER_NEUTRAL' | 'FEMALE_ONLY';
  metric: 'RANK' | 'PERCENTILE' | 'SCORE';
  openingValue: number | null;
  closingValue: number;
  isPreparatory: boolean;
  program: { id: string; name: string; branch: string | null };
  source: { name: string; publisher: string; url: string; retrievedAt: string };
}

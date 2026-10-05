import type { Prisma, PrismaClient, SeatCategory, SeatPool } from '@prisma/client';
import type { PredictQuery } from '../validation';
import {
  admissionProbability,
  bandFor,
  confidenceFor,
  estimateClosing,
  type Band,
  type Confidence,
  type Metric,
} from './model';

export const PREDICTOR_DISCLAIMER =
  'These are estimates based on past closing ranks/scores, not guarantees. Seat matrices, ' +
  'applicant numbers and rules change every year. Always confirm with the official counselling ' +
  'authority (e.g. JoSAA, MCC) before making decisions, and fill choices you genuinely want.';

export const PREDICTOR_METHOD =
  'For each seat (program, quota, category, gender pool) we take the final-round closing value ' +
  'from up to 5 recent years, weight recent years more, apply half of any trend, and estimate a ' +
  'range for next year. Your chance is how likely next year’s closing is no better than your ' +
  'rank/score. Preparatory-list ranks are excluded. See /docs/PREDICTOR.md in the repository.';

const HOME_QUOTA_STATE: Record<string, string> = { GO: 'goa', JK: 'jammu & kashmir', LA: 'ladakh' };
const HOME_QUOTAS = ['HS', 'OS', 'GO', 'JK', 'LA'];

export function metricForExam(exam: PredictQuery['exam']): Metric {
  if (exam === 'CAT') return 'PERCENTILE';
  if (exam === 'GATE') return 'SCORE';
  return 'RANK';
}

interface SeatType {
  category: SeatCategory;
  isPwd: boolean;
  seatPool: SeatPool;
  value: number;
  valueLabel: string;
}

/** Every seat pool the student is eligible for, with the value used for each. */
export function eligibleSeatTypes(q: PredictQuery, metric: Metric): SeatType[] {
  const pools: SeatPool[] = q.gender === 'FEMALE' ? ['GENDER_NEUTRAL', 'FEMALE_ONLY'] : ['GENDER_NEUTRAL'];
  const out: SeatType[] = [];
  const push = (category: SeatCategory, isPwd: boolean, value: number | undefined, valueLabel: string) => {
    if (value === undefined) return;
    for (const seatPool of pools) out.push({ category, isPwd, seatPool, value, valueLabel });
  };

  if (metric === 'RANK') {
    // JoSAA: OPEN seats use CRL; EWS/OBC-NCL/SC/ST seats use category rank;
    // PwD seats use PwD rank within the candidate's category.
    push('OPEN', false, q.rank, 'CRL / All India Rank');
    if (q.category !== 'OPEN') push(q.category, false, q.categoryRank, `${q.category.replace('_', '-')} category rank`);
    if (q.isPwd) push(q.category, true, q.pwdRank, 'PwD rank');
  } else {
    const label = metric === 'PERCENTILE' ? 'percentile' : 'score';
    push('OPEN', false, q.score, label);
    if (q.category !== 'OPEN') push(q.category, false, q.score, label);
    if (q.isPwd) push(q.category, true, q.score, label);
  }
  return out;
}

function quotaWhere(homeState: string | undefined): Prisma.CutoffRecordWhereInput {
  if (!homeState) {
    // Unknown home state: exclude home-state-only quotas, keep All-India and Other-State.
    return { quota: { notIn: ['HS', 'GO', 'JK', 'LA'] } };
  }
  const stateEq = { equals: homeState, mode: 'insensitive' as const };
  const clauses: Prisma.CutoffRecordWhereInput[] = [
    { quota: { notIn: HOME_QUOTAS } },
    { quota: 'HS', program: { college: { state: stateEq } } },
    { quota: 'OS', program: { college: { NOT: { state: stateEq } } } },
  ];
  for (const [code, state] of Object.entries(HOME_QUOTA_STATE)) {
    if (homeState.toLowerCase() === state) clauses.push({ quota: code });
  }
  return { OR: clauses };
}

function programWhere(q: PredictQuery): Prisma.ProgramWhereInput {
  const and: Prisma.ProgramWhereInput[] = [];
  if (q.branches?.length) {
    and.push({
      OR: q.branches.flatMap((b) => [
        { branch: { contains: b, mode: 'insensitive' as const } },
        { name: { contains: b, mode: 'insensitive' as const } },
      ]),
    });
  }
  const college: Prisma.CollegeWhereInput[] = [];
  if (q.states?.length) {
    college.push({ OR: q.states.map((s) => ({ state: { equals: s, mode: 'insensitive' as const } })) });
  }
  if (q.maxFees !== undefined) {
    college.push({
      OR: [{ annualFees: { lte: q.maxFees } }, ...(q.includeUnknownFees ? [{ annualFees: null }] : [])],
    });
  }
  if (college.length) and.push({ college: { AND: college } });
  return and.length ? { AND: and } : {};
}

/** Coarse DB-side filter that removes seats the student has essentially no chance at. */
function prefilter(seat: SeatType, metric: Metric): Prisma.CutoffRecordWhereInput {
  const base = { category: seat.category, isPwd: seat.isPwd, seatPool: seat.seatPool };
  if (metric === 'RANK') return { ...base, closingValue: { gte: seat.value * 0.5 } };
  if (metric === 'PERCENTILE') return { ...base, closingValue: { lte: seat.value + 5 } };
  return { ...base, closingValue: { lte: seat.value * 1.25 } };
}

export interface PredictionResult {
  program: { id: string; name: string; branch: string | null; degree: string | null };
  college: {
    id: string;
    slug: string;
    name: string;
    shortName: string;
    city: string;
    state: string;
    type: string;
    annualFees: number | null;
    dataStatus: string;
  };
  seat: { quota: string; category: SeatCategory; isPwd: boolean; seatPool: SeatPool; valueUsed: number; valueLabel: string };
  probability: number;
  band: Band;
  confidence: Confidence;
  estimate: { expected: number; low: number; high: number; targetYear: number };
  history: { year: number; round: number; closing: number; source: { name: string; publisher: string; url: string } }[];
  explanation: string;
}

export interface PredictResponse {
  meta: {
    exam: PredictQuery['exam'];
    metric: Metric;
    hasData: boolean;
    latestDataYear: number | null;
    targetYear: number | null;
    assumptions: string[];
    method: string;
    disclaimer: string;
  };
  results: PredictionResult[];
  total: number;
}

const fmt = (n: number, metric: Metric) =>
  metric === 'RANK'
    ? Math.round(n).toLocaleString('en-IN')
    : metric === 'PERCENTILE'
      ? n.toFixed(2)
      : n.toFixed(1);

const SEAT_POOL_LABEL: Record<SeatPool, string> = {
  GENDER_NEUTRAL: 'Gender-Neutral',
  FEMALE_ONLY: 'Female-only',
};

export function explain(r: Omit<PredictionResult, 'explanation'>, metric: Metric): string {
  const what = metric === 'RANK' ? 'closing rank' : metric === 'PERCENTILE' ? 'closing percentile' : 'closing score';
  const seat = `${r.seat.category.replace('_', '-')}${r.seat.isPwd ? ' (PwD)' : ''}, ${SEAT_POOL_LABEL[r.seat.seatPool]}, ${r.seat.quota} quota`;
  const hist = r.history.map((h) => `${h.year}: ${fmt(h.closing, metric)}`).join(', ');
  const better =
    metric === 'RANK' ? r.seat.valueUsed <= r.estimate.expected : r.seat.valueUsed >= r.estimate.expected;
  const pct = Math.round(r.probability * 100);
  return (
    `Past final-round ${what} for ${seat}: ${hist}. ` +
    `Estimated ${r.estimate.targetYear} ${what} ≈ ${fmt(r.estimate.expected, metric)} ` +
    `(likely range ${fmt(r.estimate.low, metric)}–${fmt(r.estimate.high, metric)}). ` +
    `Your ${r.seat.valueLabel} ${fmt(r.seat.valueUsed, metric)} is ${better ? 'better than' : 'worse than'} that estimate, ` +
    `so the estimated chance is about ${pct}%. ` +
    `Confidence: ${r.confidence.toLowerCase()} (${r.history.length} year${r.history.length === 1 ? '' : 's'} of data).`
  );
}

export async function predict(q: PredictQuery, db: PrismaClient): Promise<PredictResponse> {
  const metric = metricForExam(q.exam);
  const assumptions: string[] = ['Ranks from the JoSAA preparatory rank list are excluded.'];
  const emptyMeta = {
    exam: q.exam,
    metric,
    method: PREDICTOR_METHOD,
    disclaimer: PREDICTOR_DISCLAIMER,
  };

  const agg = await db.cutoffRecord.aggregate({
    where: { exam: q.exam, metric, isPreparatory: false },
    _max: { year: true },
  });
  const latest = agg._max.year;
  if (latest === null) {
    return {
      meta: { ...emptyMeta, hasData: false, latestDataYear: null, targetYear: null, assumptions },
      results: [],
      total: 0,
    };
  }
  const targetYear = latest + 1;

  const seats = eligibleSeatTypes(q, metric);
  if (q.gender !== 'FEMALE') assumptions.push('Female-only (supernumerary) seats are not included.');
  if (metric === 'RANK' && q.category !== 'OPEN' && q.categoryRank === undefined) {
    assumptions.push('No category rank given, so only OPEN seats were evaluated. Add your category rank to include reserved seats.');
  }
  if (!q.homeState && q.exam === 'JEE_MAIN') {
    assumptions.push('Home state not given: Home-State (HS) quota seats are excluded and Other-State (OS) seats are included.');
  }
  if (q.round) assumptions.push(`Using round ${q.round} closing values only.`);
  else assumptions.push('Using the last available round of each year.');

  const base: Prisma.CutoffRecordWhereInput = {
    exam: q.exam,
    metric,
    isPreparatory: false,
    year: { gte: latest - 4 },
    ...(q.round ? { round: q.round } : {}),
    AND: [
      { OR: seats.map((s) => ({ category: s.category, isPwd: s.isPwd, seatPool: s.seatPool })) },
      quotaWhere(q.homeState),
      { program: programWhere(q) },
    ],
  };

  // Step 1 (DB): programs with at least one plausibly reachable year.
  const candidates = await db.cutoffRecord.findMany({
    where: { AND: [base, { OR: seats.map((s) => prefilter(s, metric)) }] },
    select: { programId: true },
    distinct: ['programId'],
    take: 1000,
  });
  if (candidates.length === 0) {
    return {
      meta: { ...emptyMeta, hasData: true, latestDataYear: latest, targetYear, assumptions },
      results: [],
      total: 0,
    };
  }

  // Step 2 (DB): full multi-year history for just those programs.
  const records = await db.cutoffRecord.findMany({
    where: { AND: [base, { programId: { in: candidates.map((c) => c.programId) } }] },
    select: {
      programId: true,
      year: true,
      round: true,
      quota: true,
      category: true,
      isPwd: true,
      seatPool: true,
      closingValue: true,
      program: {
        select: {
          id: true,
          name: true,
          branch: true,
          degree: true,
          college: {
            select: {
              id: true,
              slug: true,
              name: true,
              shortName: true,
              city: true,
              state: true,
              type: true,
              annualFees: true,
              dataStatus: true,
            },
          },
        },
      },
      source: { select: { name: true, publisher: true, url: true } },
    },
    orderBy: [{ year: 'asc' }, { round: 'asc' }],
  });

  type Rec = (typeof records)[number];
  const groups = new Map<string, Map<number, Rec>>();
  for (const r of records) {
    const key = [r.programId, r.quota, r.category, r.isPwd, r.seatPool].join('|');
    const byYear = groups.get(key) ?? new Map<number, Rec>();
    const prev = byYear.get(r.year);
    if (!prev || r.round > prev.round) byYear.set(r.year, r); // last round of the year
    groups.set(key, byYear);
  }

  const bestByProgram = new Map<string, PredictionResult>();
  for (const byYear of groups.values()) {
    const recs = [...byYear.values()].sort((a, b) => a.year - b.year);
    const first = recs[0];
    const seat = seats.find(
      (s) => s.category === first.category && s.isPwd === first.isPwd && s.seatPool === first.seatPool,
    );
    if (!seat) continue;
    const est = estimateClosing(
      recs.map((r) => ({ year: r.year, closing: r.closingValue })),
      metric,
      targetYear,
    );
    if (!est) continue;
    // Never present certainty: the model cannot account for rule changes,
    // seat-matrix changes or an unusual applicant year.
    const raw = admissionProbability(seat.value, est, metric);
    const probability = Math.min(0.97, Math.max(0.02, raw));
    const partial: Omit<PredictionResult, 'explanation'> = {
      program: { id: first.program.id, name: first.program.name, branch: first.program.branch, degree: first.program.degree },
      college: first.program.college,
      seat: {
        quota: first.quota,
        category: first.category,
        isPwd: first.isPwd,
        seatPool: first.seatPool,
        valueUsed: seat.value,
        valueLabel: seat.valueLabel,
      },
      probability: Math.round(probability * 100) / 100,
      band: bandFor(probability),
      confidence: confidenceFor(est.yearsUsed),
      estimate: { expected: est.expected, low: est.low, high: est.high, targetYear },
      history: recs.map((r) => ({ year: r.year, round: r.round, closing: r.closingValue, source: r.source })),
    };
    const result: PredictionResult = { ...partial, explanation: explain(partial, metric) };
    const existing = bestByProgram.get(first.programId);
    if (!existing || result.probability > existing.probability) bestByProgram.set(first.programId, result);
  }

  const lowerIsBetter = metric === 'RANK';
  const all = [...bestByProgram.values()]
    .filter((r) => q.includeUnlikely || r.band !== 'UNLIKELY')
    .sort(
      (a, b) =>
        b.probability - a.probability ||
        (lowerIsBetter ? a.estimate.expected - b.estimate.expected : b.estimate.expected - a.estimate.expected),
    );

  return {
    meta: { ...emptyMeta, hasData: true, latestDataYear: latest, targetYear, assumptions },
    results: all.slice(0, q.limit),
    total: all.length,
  };
}

import { Prisma, type CounsellingSystem, type CutoffRankType, type Exam, type SeatCategory, type SeatPool, type PrismaClient } from '@prisma/client';
import { z } from 'zod';

const empty = (value: unknown) => value === '' || value === null ? undefined : value;
const optionalText = (max: number) => z.preprocess(empty, z.string().trim().max(max).optional());
const optionalInt = (min: number, max: number) => z.preprocess(empty, z.coerce.number().int().min(min).max(max).optional());

export const cutoffQuerySchema = z.object({
  q: optionalText(100).default(''),
  college: optionalText(100).default(''),
  program: optionalText(140).default(''),
  counsellingSystem: z.preprocess(empty, z.enum(['UNSPECIFIED', 'JOSAA', 'CSAB', 'MCC', 'STATE', 'OTHER']).optional()),
  rankType: z.preprocess(empty, z.enum(['UNSPECIFIED', 'CRL', 'CATEGORY', 'PWD_CATEGORY', 'MERIT']).optional()),
  exam: z.preprocess(empty, z.enum(['JEE_MAIN', 'JEE_ADVANCED', 'NEET', 'CAT', 'GATE']).optional()),
  year: optionalInt(2000, 2100),
  yearFrom: optionalInt(2000, 2100),
  yearTo: optionalInt(2000, 2100),
  category: z.preprocess(empty, z.enum(['OPEN', 'EWS', 'OBC_NCL', 'SC', 'ST']).optional()),
  quota: z.preprocess(empty, z.string().trim().regex(/^[A-Za-z0-9_-]{1,24}$/).optional()),
  seatPool: z.preprocess(empty, z.enum(['GENDER_NEUTRAL', 'FEMALE_ONLY']).optional()),
  round: optionalInt(1, 50),
  isPwd: z.preprocess((value) => value === 'true' ? true : value === 'false' ? false : empty(value), z.boolean().optional()),
  metric: z.preprocess(empty, z.enum(['RANK', 'PERCENTILE', 'SCORE']).optional()),
  page: z.preprocess(empty, z.coerce.number().int().min(1).max(10_000).default(1)),
  pageSize: z.preprocess(empty, z.coerce.number().int().min(1).max(100).default(25)),
}).refine((query) => query.yearFrom === undefined || query.yearTo === undefined || query.yearFrom <= query.yearTo, {
  message: 'yearFrom must be less than or equal to yearTo', path: ['yearFrom'],
}).refine((query) => query.year === undefined || (query.yearFrom === undefined && query.yearTo === undefined), {
  message: 'Use either an exact year or a year range', path: ['year'],
});

export type CutoffQuery = z.infer<typeof cutoffQuerySchema>;

export interface PublicCutoffRow {
  id: string;
  college: { id: string; slug: string; name: string; city: string; state: string };
  program: { id: string; name: string; branch: string | null; degree: string | null; durationYears: number | null };
  counsellingSystem: CounsellingSystem;
  rankType: CutoffRankType;
  exam: Exam;
  year: number;
  round: number;
  quota: string;
  category: SeatCategory;
  isPwd: boolean;
  seatPool: SeatPool;
  metric: 'RANK' | 'PERCENTILE' | 'SCORE';
  openingValue: number | null;
  closingValue: number;
  isPreparatory: boolean;
  evidenceLocator: string | null;
  source: { name: string; publisher: string; url: string; publishedAt: Date | null; retrievedAt: Date };
  reviewedAt: Date;
}

function queryConditions(query: CutoffQuery, exactCollege = false): Prisma.Sql[] {
  const where: Prisma.Sql[] = [
    Prisma.sql`c."dataStatus" <> 'DEMO'::"DataStatus"`,
    Prisma.sql`latest.status = 'APPROVED'`,
    Prisma.sql`lower(s.url) LIKE 'https://%'`,
    Prisma.sql`position('@' in split_part(split_part(s.url, '://', 2), '/', 1)) = 0`,
    Prisma.sql`length(trim(s.publisher)) > 0`,
  ];
  if (query.q) where.push(Prisma.sql`position(lower(${query.q}) in lower(concat_ws(' ', c.name, c.slug, p.name, p.branch))) > 0`);
  if (query.college) where.push(exactCollege
    ? Prisma.sql`(lower(c.slug) = lower(${query.college}) OR lower(c.name) = lower(${query.college}))`
    : Prisma.sql`(position(lower(${query.college}) in lower(c.name)) > 0 OR position(lower(${query.college}) in lower(c.slug)) > 0)`);
  if (query.program) where.push(Prisma.sql`(position(lower(${query.program}) in lower(p.name)) > 0 OR position(lower(${query.program}) in lower(coalesce(p.branch, ''))) > 0)`);
  if (query.counsellingSystem) where.push(Prisma.sql`r."counsellingSystem" = ${query.counsellingSystem}::"CounsellingSystem"`);
  if (query.rankType) where.push(Prisma.sql`r."rankType" = ${query.rankType}::"CutoffRankType"`);
  if (query.exam) where.push(Prisma.sql`r.exam = ${query.exam}::"Exam"`);
  if (query.year !== undefined) where.push(Prisma.sql`r.year = ${query.year}`);
  if (query.yearFrom !== undefined) where.push(Prisma.sql`r.year >= ${query.yearFrom}`);
  if (query.yearTo !== undefined) where.push(Prisma.sql`r.year <= ${query.yearTo}`);
  if (query.category) where.push(Prisma.sql`r.category = ${query.category}::"SeatCategory"`);
  if (query.quota) where.push(Prisma.sql`r.quota = ${query.quota.toUpperCase()}`);
  if (query.seatPool) where.push(Prisma.sql`r."seatPool" = ${query.seatPool}::"SeatPool"`);
  if (query.round !== undefined) where.push(Prisma.sql`r.round = ${query.round}`);
  if (query.isPwd !== undefined) where.push(Prisma.sql`r."isPwd" = ${query.isPwd}`);
  if (query.metric) where.push(Prisma.sql`r.metric = ${query.metric}::"CutoffMetric"`);
  return where;
}

const FROM = Prisma.sql`
  FROM "CutoffRecord" r
  JOIN "Program" p ON p.id = r."programId"
  JOIN "College" c ON c.id = p."collegeId"
  JOIN "Source" s ON s.id = r."sourceId"
  JOIN LATERAL (
    SELECT d.status, d."createdAt" FROM "EvidenceDecision" d
    WHERE d."cutoffId" = r.id ORDER BY d."createdAt" DESC, d.id DESC LIMIT 1
  ) latest ON TRUE
`;

const SELECT = Prisma.sql`
  SELECT count(*) OVER() AS total, r.id,
    c.id AS "collegeId", c.slug AS "collegeSlug", c.name AS "collegeName", c.city AS "collegeCity", c.state AS "collegeState",
    p.id AS "programId", p.name AS "programName", p.branch AS "programBranch", p.degree AS "programDegree", p."durationYears" AS "durationYears",
    r."counsellingSystem", r."rankType", r.exam, r.year, r.round, r.quota, r.category, r."isPwd", r."seatPool", r.metric,
    r."openingValue", r."closingValue", r."isPreparatory", r."evidenceLocator",
    s.name AS "sourceName", s.publisher AS "sourcePublisher", s.url AS "sourceUrl", s."publishedAt" AS "sourcePublishedAt", s."retrievedAt" AS "sourceRetrievedAt",
    latest."createdAt" AS "reviewedAt"
`;

function toPublicCutoffRow(row: Record<string, unknown>): PublicCutoffRow {
  return {
    id: String(row.id),
    college: { id: String(row.collegeId), slug: String(row.collegeSlug), name: String(row.collegeName), city: String(row.collegeCity), state: String(row.collegeState) },
    program: { id: String(row.programId), name: String(row.programName), branch: row.programBranch === null ? null : String(row.programBranch), degree: row.programDegree === null ? null : String(row.programDegree), durationYears: row.durationYears === null ? null : Number(row.durationYears) },
    counsellingSystem: row.counsellingSystem as CounsellingSystem,
    rankType: row.rankType as CutoffRankType,
    exam: row.exam as Exam,
    year: Number(row.year), round: Number(row.round), quota: String(row.quota), category: row.category as SeatCategory,
    isPwd: Boolean(row.isPwd), seatPool: row.seatPool as SeatPool, metric: row.metric as PublicCutoffRow['metric'],
    openingValue: row.openingValue === null ? null : Number(row.openingValue), closingValue: Number(row.closingValue), isPreparatory: Boolean(row.isPreparatory),
    evidenceLocator: row.evidenceLocator === null ? null : String(row.evidenceLocator),
    source: { name: String(row.sourceName), publisher: String(row.sourcePublisher), url: String(row.sourceUrl), publishedAt: row.sourcePublishedAt as Date | null, retrievedAt: row.sourceRetrievedAt as Date },
    reviewedAt: row.reviewedAt as Date,
  };
}

/** Shared parameterized SQL is also used by the isolated benchmark harness so
 * EXPLAIN and latency results reflect the statements the app actually runs. */
export function cutoffQueryStatements(raw: unknown) {
  const query = cutoffQuerySchema.parse(raw);
  const conditions = queryConditions(query);
  const where = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
  const page = (pageNumber: number) => Prisma.sql`
    ${SELECT}${FROM}${where}
    ORDER BY r.year DESC, c.name ASC, p.name ASC, r."counsellingSystem" ASC, r.exam ASC,
      r.round DESC, r.quota ASC, r.category ASC, r."isPwd" ASC, r."seatPool" ASC, r.metric ASC, r.id ASC
    LIMIT ${query.pageSize} OFFSET ${(pageNumber - 1) * query.pageSize}
  `;
  const count = Prisma.sql`SELECT count(*) AS total ${FROM}${where}`;
  return { query, page, count };
}

/** All filtering, approved-only projection, counting and paging happen in PostgreSQL. */
export async function listPublicCutoffs(db: PrismaClient, raw: unknown) {
  const { query, page, count } = cutoffQueryStatements(raw);
  let pageNumber = query.page;
  let pageRows = await db.$queryRaw<(Record<string, unknown> & { total: bigint })[]>(page(pageNumber));
  const total = pageRows.length ? Number(pageRows[0].total) : Number((await db.$queryRaw<{ total: bigint }[]>(count))[0].total);
  const totalPages = Math.ceil(total / query.pageSize);
  const lastValidPage = totalPages || 1;
  if (pageNumber > lastValidPage) {
    pageNumber = lastValidPage;
    pageRows = await db.$queryRaw<(Record<string, unknown> & { total: bigint })[]>(page(pageNumber));
  }
  const items = pageRows.map(toPublicCutoffRow);
  return { ...query, page: pageNumber, total, totalPages, items };
}

const TREND_REQUIRED_FILTERS: (keyof CutoffQuery)[] = ['college', 'program', 'counsellingSystem', 'rankType', 'exam', 'category', 'quota', 'seatPool', 'isPwd', 'metric'];

/** Loads every verified observation for one fully scoped series. Filters are applied
 * in PostgreSQL; no page-size cap or chart-only sample can silently omit history. */
export async function listPublicCutoffTrend(db: PrismaClient, raw: unknown) {
  const query = cutoffQuerySchema.parse(raw);
  if (TREND_REQUIRED_FILTERS.some((key) => query[key] === undefined || query[key] === '')) return { state: 'NEEDS_FILTERS' as const, rows: [] as PublicCutoffRow[] };
  if (query.metric !== 'RANK') return { state: 'NOT_RANKS' as const, rows: [] as PublicCutoffRow[] };
  const where = Prisma.sql`WHERE ${Prisma.join(queryConditions(query, true), ' AND ')}`;
  const records = await db.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
    ${SELECT}${FROM}${where}
    ORDER BY r.year ASC, r.round ASC, r.id ASC
  `);
  const rows = records.map(toPublicCutoffRow);
  const colleges = new Set(rows.map((row) => row.college.id));
  const programs = new Set(rows.map((row) => row.program.id));
  if (colleges.size > 1 || programs.size > 1) return { state: 'AMBIGUOUS' as const, rows: [] as PublicCutoffRow[] };
  return { state: rows.length ? 'READY' as const : 'EMPTY' as const, rows };
}

/** Canonical institutions with at least one currently reviewed, source-backed
 * cutoff for an exam. This avoids filtering discovery on unreviewed raw rows. */
export async function listCollegesWithReviewedCutoffs(db: PrismaClient, exams: Exam[]) {
  if (!exams.length) return [] as string[];
  const rows = await db.$queryRaw<{ collegeId: string }[]>(Prisma.sql`
    SELECT DISTINCT c.id AS "collegeId"
    ${FROM}
    WHERE c."dataStatus" <> 'DEMO'::"DataStatus"
      AND latest.status = 'APPROVED'
      AND r.exam IN (${Prisma.join(exams.map((exam) => Prisma.sql`${exam}::"Exam"`))})
      AND lower(s.url) LIKE 'https://%'
      AND position('@' in split_part(split_part(s.url, '://', 2), '/', 1)) = 0
      AND length(trim(s.publisher)) > 0
  `);
  return rows.map(({ collegeId }) => collegeId);
}

/** Read one published observation by stable id. A missing/revoked row is indistinguishable
 * from an unknown id. Reject ambiguous latest decisions at the same timestamp. */
export async function findPublicRankObservation(db: PrismaClient, id: string) {
  const conditions = queryConditions(cutoffQuerySchema.parse({ metric: 'RANK' }));
  const rows = await db.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
    ${SELECT}${FROM}
    WHERE ${Prisma.join(conditions, ' AND ')}
      AND r.id = ${id} AND NOT r."isPreparatory"
      AND length(trim(r.quota)) > 0
      AND s."retrievedAt" <= now() AND (s."publishedAt" IS NULL OR s."publishedAt" <= now())
      AND r."rankType" <> 'UNSPECIFIED' AND r."counsellingSystem" <> 'UNSPECIFIED'
      AND r."closingValue" > 0 AND r."closingValue" <= 3000000
      AND r."closingValue" = trunc(r."closingValue")
      AND (r."openingValue" IS NULL OR
        (r."openingValue" > 0 AND r."openingValue" <= r."closingValue" AND r."openingValue" = trunc(r."openingValue")))
      AND NOT EXISTS (
        SELECT 1 FROM "EvidenceDecision" d WHERE d."cutoffId" = r.id
          AND d."createdAt" = latest."createdAt" AND d.status <> 'APPROVED'
      )
  `);
  return rows[0] ? toPublicCutoffRow(rows[0]) : null;
}

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { cutoffQueryStatements, listPublicCutoffTrend, listPublicCutoffs } from '@/server/cutoffs';
import { GET as cutoffApiGet } from '@/app/api/cutoffs/route';
import { resetDb, testDb } from './db';

const db = testDb();
beforeEach(async () => resetDb());
afterAll(async () => db.$disconnect());

const systems = ['UNSPECIFIED', 'JOSAA', 'CSAB', 'MCC', 'STATE', 'OTHER'] as const;
const exams = ['JEE_MAIN', 'JEE_ADVANCED', 'NEET', 'CAT', 'GATE'] as const;
const categories = ['OPEN', 'EWS', 'OBC_NCL', 'SC', 'ST'] as const;
const seatPools = ['GENDER_NEUTRAL', 'FEMALE_ONLY'] as const;
const quotas = ['AI', 'HS', 'OS', 'GO', 'TEST'] as const;
const metrics = ['RANK', 'PERCENTILE', 'SCORE'] as const;

type ScaleFixture = {
  id: string; collegeId: string; collegeSlug: string; collegeName: string;
  programId: string; programName: string; branch: string; sourceId: string;
  sourceName: string; publisher: string; url: string; publishedAt: Date; retrievedAt: Date;
  counsellingSystem: typeof systems[number]; rankType: 'UNSPECIFIED' | 'CRL' | 'CATEGORY' | 'PWD_CATEGORY' | 'MERIT';
  exam: typeof exams[number]; year: number; round: number; quota: string;
  category: typeof categories[number]; isPwd: boolean; seatPool: typeof seatPools[number];
  metric: typeof metrics[number]; openingValue: number | null; closingValue: number; isPreparatory: boolean;
};

function cutoffData(row: ScaleFixture) {
  return {
    id: row.id, programId: row.programId, sourceId: row.sourceId, exam: row.exam,
    counsellingSystem: row.counsellingSystem, rankType: row.rankType, year: row.year, round: row.round,
    quota: row.quota, category: row.category, isPwd: row.isPwd, seatPool: row.seatPool, metric: row.metric,
    openingValue: row.openingValue, closingValue: row.closingValue, isPreparatory: row.isPreparatory,
  };
}

async function createScaleFixture(size: number): Promise<ScaleFixture[]> {
  const reviewer = await db.user.create({ data: { name: 'Synthetic scale reviewer', email: 'cutoff-scale@example.test', password: 'fixture', role: 'ADMIN' } });
  const colleges = await Promise.all(Array.from({ length: 12 }, (_, index) => db.college.create({ data: {
    slug: `scale-college-${index.toString().padStart(2, '0')}`,
    name: index < 2 ? 'Synthetic Equal Sort College' : `Synthetic Scale College ${index.toString().padStart(2, '0')}`,
    shortName: `Scale ${index}`, city: `City ${index}`, state: `State ${index}`, type: 'GOVERNMENT',
  } })));
  const programs = await Promise.all(colleges.map((college) => db.program.create({ data: {
    collegeId: college.id, name: 'Synthetic Computer Science Programme', degree: 'B.Tech', branch: 'Computer Science', durationYears: 4,
  } })));
  const publishedAt = new Date('2025-06-10T00:00:00.000Z');
  const retrievedAt = new Date('2025-06-11T00:00:00.000Z');
  const sources = await Promise.all(Array.from({ length: 4 }, (_, index) => db.source.create({ data: {
    name: `Synthetic cutoff source ${index}`, publisher: `SYNTHETIC AUTHORITY ${index}`,
    url: `https://source${index}.example.test/cutoffs`, publishedAt, retrievedAt,
  } })));

  const rows: ScaleFixture[] = Array.from({ length: size }, (_, index) => {
    const programIndex = index < 2 ? index : index % programs.length;
    // The first pair deliberately tie on every displayed/sort column except ID.
    const code = index < 2 ? 0 : ((index - 1) * 7_919) % 216_000;
    const counsellingSystem = systems[code % systems.length];
    const exam = exams[Math.floor(code / systems.length) % exams.length];
    const year = 2018 + Math.floor(code / (systems.length * exams.length)) % 9;
    const round = 1 + Math.floor(code / (systems.length * exams.length * 9)) % 8;
    const quota = quotas[Math.floor(code / (systems.length * exams.length * 9 * 8)) % quotas.length];
    const category = categories[Math.floor(code / (systems.length * exams.length * 9 * 8 * quotas.length)) % categories.length];
    const isPwd = Math.floor(code / (systems.length * exams.length * 9 * 8 * quotas.length * categories.length)) % 2 === 1;
    const seatPool = seatPools[Math.floor(code / (systems.length * exams.length * 9 * 8 * quotas.length * categories.length * 2)) % seatPools.length];
    const metric = exam === 'CAT' ? 'PERCENTILE' : exam === 'GATE' ? 'SCORE' : 'RANK';
    const closingValue = metric === 'RANK' ? 10_000 + code : metric === 'PERCENTILE' ? 80 + (code % 20) : 40 + (code % 60);
    const source = sources[(code + programIndex) % sources.length];
    return {
      id: `cf4-scale-${index.toString().padStart(5, '0')}`,
      collegeId: colleges[programIndex].id, collegeSlug: colleges[programIndex].slug, collegeName: colleges[programIndex].name,
      programId: programs[programIndex].id, programName: programs[programIndex].name, branch: programs[programIndex].branch!,
      sourceId: source.id, sourceName: source.name, publisher: source.publisher, url: source.url, publishedAt, retrievedAt,
      counsellingSystem, rankType: counsellingSystem === 'UNSPECIFIED' ? 'UNSPECIFIED' : isPwd ? 'PWD_CATEGORY' : category === 'OPEN' ? 'CRL' : 'CATEGORY',
      exam, year, round, quota, category, isPwd, seatPool, metric, openingValue: code % 11 === 0 ? null : closingValue - 5,
      closingValue, isPreparatory: code % 17 === 0,
    };
  });

  await db.cutoffRecord.create({ data: { ...cutoffData(rows[0]), counsellingSystem: undefined, rankType: undefined } });
  await db.cutoffRecord.createMany({ data: rows.slice(1).map(cutoffData) });
  await db.evidenceDecision.createMany({ data: rows.map((row, index) => ({
    id: `cf4-scale-decision-${index.toString().padStart(5, '0')}`, cutoffId: row.id, reviewerId: reviewer.id,
    status: 'APPROVED', reason: 'Synthetic scale test; not a real approval', createdAt: new Date('2025-07-01T00:00:00.000Z'),
  })) });
  return rows;
}

function expectedOrder(a: ScaleFixture, b: ScaleFixture) {
  const cmp = (x: string | number, y: string | number) => x < y ? -1 : x > y ? 1 : 0;
  return cmp(b.year, a.year) || cmp(a.collegeName, b.collegeName) || cmp(a.programName, b.programName) ||
    cmp(systems.indexOf(a.counsellingSystem), systems.indexOf(b.counsellingSystem)) || cmp(exams.indexOf(a.exam), exams.indexOf(b.exam)) ||
    cmp(b.round, a.round) || cmp(a.quota, b.quota) || cmp(categories.indexOf(a.category), categories.indexOf(b.category)) ||
    cmp(Number(a.isPwd), Number(b.isPwd)) || cmp(seatPools.indexOf(a.seatPool), seatPools.indexOf(b.seatPool)) ||
    cmp(metrics.indexOf(a.metric), metrics.indexOf(b.metric)) || cmp(a.id, b.id);
}

function expectedFilter(rows: ScaleFixture[], query: Record<string, unknown>) {
  return rows.filter((row) =>
    (query.college === undefined || row.collegeName.toLowerCase().includes(String(query.college).toLowerCase()) || row.collegeSlug.toLowerCase().includes(String(query.college).toLowerCase())) &&
    (query.program === undefined || row.programName.toLowerCase().includes(String(query.program).toLowerCase()) || row.branch.toLowerCase().includes(String(query.program).toLowerCase())) &&
    (query.counsellingSystem === undefined || row.counsellingSystem === query.counsellingSystem) &&
    (query.rankType === undefined || row.rankType === query.rankType) &&
    (query.exam === undefined || row.exam === query.exam) && (query.year === undefined || row.year === query.year) &&
    (query.yearFrom === undefined || row.year >= Number(query.yearFrom)) && (query.yearTo === undefined || row.year <= Number(query.yearTo)) &&
    (query.category === undefined || row.category === query.category) && (query.quota === undefined || row.quota === String(query.quota).toUpperCase()) &&
    (query.seatPool === undefined || row.seatPool === query.seatPool) && (query.round === undefined || row.round === query.round) &&
    (query.isPwd === undefined || row.isPwd === query.isPwd) && (query.metric === undefined || row.metric === query.metric),
  ).sort(expectedOrder);
}

function percentile(samples: number[], p: number) {
  const sorted = [...samples].sort((a, b) => a - b);
  return Number(sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)].toFixed(3));
}

async function measure(fn: () => Promise<unknown>, iterations = 100) {
  for (let warmup = 0; warmup < 10; warmup++) await fn();
  const samples: number[] = [];
  for (let index = 0; index < iterations; index++) {
    const started = performance.now();
    await fn();
    samples.push(performance.now() - started);
  }
  return { samples: iterations, p50Ms: percentile(samples, 0.50), p95Ms: percentile(samples, 0.95), p99Ms: percentile(samples, 0.99) };
}

async function explain(query: Prisma.Sql) {
  const result = await db.$queryRaw<{ 'QUERY PLAN': Array<{ Plan: Record<string, unknown>; 'Planning Time': number; 'Execution Time': number }>}[]>(Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`);
  const root = result[0]['QUERY PLAN'][0];
  const nodes: { nodeType: string; relation?: string; index?: string; actualRows?: number; actualMs?: number; hitBlocks?: number; readBlocks?: number }[] = [];
  const visit = (node: Record<string, unknown>) => {
    nodes.push({
      nodeType: String(node['Node Type']),
      relation: node['Relation Name'] ? String(node['Relation Name']) : undefined,
      index: node['Index Name'] ? String(node['Index Name']) : undefined,
      actualRows: Number(node['Actual Rows'] ?? 0), actualMs: Number(node['Actual Total Time'] ?? 0),
      hitBlocks: Number(node['Shared Hit Blocks'] ?? 0), readBlocks: Number(node['Shared Read Blocks'] ?? 0),
    });
    for (const child of (node.Plans as Record<string, unknown>[] | undefined) ?? []) visit(child);
  };
  visit(root.Plan);
  return { planningMs: root['Planning Time'], executionMs: root['Execution Time'], nodes };
}

describe('public cutoff explorer', () => {
  it('returns a validation error for invalid API filters before querying the database', async () => {
    const response = await cutoffApiGet(new Request('http://localhost/api/cutoffs?yearFrom=2025&yearTo=2020'));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('filters before pagination and uses stable ordering across page boundaries', async () => {
    const reviewer = await db.user.create({ data: { name: 'Reviewer', email: 'cutoff-pages@example.test', password: 'fixture', role: 'ADMIN' } });
    const source = await db.source.create({ data: { name: 'Official table', publisher: 'Counselling authority', url: 'https://authority.gov.in/cutoffs', publishedAt: new Date('2025-06-01'), retrievedAt: new Date('2025-06-02') } });
    const colleges = await Promise.all(['Alpha', 'Beta', 'Gamma'].map((name) => db.college.create({ data: { slug: `cutoff-${name.toLowerCase()}`, name, shortName: name, city: 'Test city', state: 'Test state', type: 'GOVERNMENT' } })));
    const records = [];
    for (let i = 0; i < colleges.length; i++) {
      const program = await db.program.create({ data: { collegeId: colleges[i].id, name: `Programme ${i}`, branch: `Branch ${i}` } });
      records.push(await db.cutoffRecord.create({ data: { programId: program.id, exam: 'JEE_MAIN', counsellingSystem: 'JOSAA', rankType: 'CRL', year: 2024, round: 1, quota: 'AI', category: 'OPEN', seatPool: 'GENDER_NEUTRAL', metric: 'RANK', openingValue: i + 1, closingValue: 100 + i, sourceId: source.id } }));
    }
    for (const record of records) await db.evidenceDecision.create({ data: { cutoffId: record.id, reviewerId: reviewer.id, status: 'APPROVED', reason: 'Reviewed official test fixture' } });

    const page1 = await listPublicCutoffs(db, { page: 1, pageSize: 2, year: 2024, counsellingSystem: 'JOSAA' });
    const page2 = await listPublicCutoffs(db, { page: 2, pageSize: 2, year: 2024, counsellingSystem: 'JOSAA' });
    expect(page1.total).toBe(3);
    expect(page2.total).toBe(3);
    expect(page1.items.map((row) => row.college.name)).toEqual(['Alpha', 'Beta']);
    expect(page2.items.map((row) => row.college.name)).toEqual(['Gamma']);
    expect(new Set([...page1.items, ...page2.items].map((row) => row.id)).size).toBe(3);
    expect(await listPublicCutoffs(db, { page: 8, pageSize: 2, year: 2024 })).toMatchObject({ page: 2, total: 3, totalPages: 2, items: [{ college: { name: 'Gamma' } }] });
  });

  it('excludes unreviewed, rejected, non-HTTPS and demo cutoff rows', async () => {
    const reviewer = await db.user.create({ data: { name: 'Reviewer', email: 'cutoff-gates@example.test', password: 'fixture', role: 'ADMIN' } });
    const official = await db.source.create({ data: { name: 'Official', publisher: 'Authority', url: 'https://authority.gov.in/cutoffs', retrievedAt: new Date('2025-01-01') } });
    const insecure = await db.source.create({ data: { name: 'Not official', publisher: 'Authority', url: 'http://authority.gov.in/cutoffs', retrievedAt: new Date('2025-01-01') } });
    const real = await db.college.create({ data: { slug: 'cutoff-real', name: 'Real college', shortName: 'Real', city: 'C', state: 'S', type: 'GOVERNMENT' } });
    const demo = await db.college.create({ data: { slug: 'cutoff-demo', name: 'Demo college', shortName: 'Demo', city: 'C', state: 'S', type: 'GOVERNMENT', dataStatus: 'DEMO' } });
    const program = await db.program.create({ data: { collegeId: real.id, name: 'B.Tech' } });
    const demoProgram = await db.program.create({ data: { collegeId: demo.id, name: 'B.Tech' } });
    const approved = await db.cutoffRecord.create({ data: { programId: program.id, exam: 'JEE_MAIN', year: 2024, round: 1, quota: 'AI', category: 'OPEN', seatPool: 'GENDER_NEUTRAL', sourceId: official.id, closingValue: 100 } });
    const rejected = await db.cutoffRecord.create({ data: { programId: program.id, exam: 'JEE_MAIN', year: 2023, round: 1, quota: 'AI', category: 'OPEN', seatPool: 'GENDER_NEUTRAL', sourceId: official.id, closingValue: 90 } });
    const insecureRow = await db.cutoffRecord.create({ data: { programId: program.id, exam: 'JEE_MAIN', year: 2022, round: 1, quota: 'AI', category: 'OPEN', seatPool: 'GENDER_NEUTRAL', sourceId: insecure.id, closingValue: 80 } });
    const demoRow = await db.cutoffRecord.create({ data: { programId: demoProgram.id, exam: 'JEE_MAIN', year: 2024, round: 1, quota: 'AI', category: 'OPEN', seatPool: 'GENDER_NEUTRAL', sourceId: official.id, closingValue: 70 } });
    await db.cutoffRecord.create({ data: { programId: program.id, exam: 'JEE_MAIN', year: 2021, round: 1, quota: 'AI', category: 'OPEN', seatPool: 'GENDER_NEUTRAL', sourceId: official.id, closingValue: 60 } });
    await db.evidenceDecision.createMany({ data: [approved, rejected, insecureRow, demoRow].map((row) => ({ cutoffId: row.id, reviewerId: reviewer.id, status: row.id === rejected.id ? 'REJECTED' as const : 'APPROVED' as const, reason: 'Synthetic isolation assertion' })) });

    const result = await listPublicCutoffs(db, {});
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe(approved.id);
  });

  it('matches every represented seat dimension and excludes a later conflicting rejection', async () => {
    const reviewer = await db.user.create({ data: { name: 'Reviewer', email: 'cutoff-dimensions@example.test', password: 'fixture', role: 'ADMIN' } });
    const source = await db.source.create({ data: { name: 'Official cutoff fixture', publisher: 'Test authority', url: 'https://authority.gov.in/test', retrievedAt: new Date('2025-01-01') } });
    const college = await db.college.create({ data: { slug: 'cutoff-dimensions', name: 'Dimension College', shortName: 'Dimension', city: 'C', state: 'S', type: 'GOVERNMENT' } });
    const program = await db.program.create({ data: { collegeId: college.id, name: 'Programme with dimensions', branch: 'Dimension branch' } });
    const row = await db.cutoffRecord.create({ data: {
      programId: program.id, counsellingSystem: 'CSAB', rankType: 'PWD_CATEGORY', exam: 'JEE_MAIN', year: 2024,
      round: 6, quota: 'OS', category: 'OBC_NCL', isPwd: true, seatPool: 'FEMALE_ONLY', metric: 'RANK',
      openingValue: 10, closingValue: 20, sourceId: source.id,
    } });
    await db.evidenceDecision.create({ data: { cutoffId: row.id, reviewerId: reviewer.id, status: 'APPROVED', reason: 'Initial synthetic approval', createdAt: new Date('2025-01-02') } });

    const filters = {
      college: college.slug, program: 'Dimension branch', counsellingSystem: 'CSAB' as const, exam: 'JEE_MAIN' as const,
      year: 2024, category: 'OBC_NCL' as const, quota: 'OS', seatPool: 'FEMALE_ONLY' as const,
      round: 6, isPwd: true, metric: 'RANK' as const,
    };
    const matching = await listPublicCutoffs(db, filters);
    expect(matching.total).toBe(1);
    expect(matching.items[0]).toMatchObject({ id: row.id, counsellingSystem: 'CSAB', rankType: 'PWD_CATEGORY', isPwd: true, seatPool: 'FEMALE_ONLY', round: 6, quota: 'OS', category: 'OBC_NCL' });

    await db.evidenceDecision.create({ data: { cutoffId: row.id, reviewerId: reviewer.id, status: 'REJECTED', reason: 'Synthetic later conflict decision', createdAt: new Date('2025-01-03') } });
    expect((await listPublicCutoffs(db, filters)).total).toBe(0);
  });

  it('returns only one complete, approved rank series and preserves unreviewed years as gaps', async () => {
    const reviewer = await db.user.create({ data: { name: 'Synthetic trend reviewer', email: 'cutoff-trend@example.test', password: 'fixture', role: 'ADMIN' } });
    const source = await db.source.create({ data: { name: 'Trend source', publisher: 'SYNTHETIC COUNSELLING AUTHORITY', url: 'https://authority.example.test/trends', publishedAt: new Date('2025-01-01'), retrievedAt: new Date('2025-01-02') } });
    const college = await db.college.create({ data: { slug: 'synthetic-trend-college', name: 'Synthetic Trend College', shortName: 'Trend', city: 'Test', state: 'Test', type: 'GOVERNMENT' } });
    const program = await db.program.create({ data: { collegeId: college.id, name: 'Synthetic Engineering', branch: 'Synthetic Engineering', degree: 'B.Tech' } });
    const dimensions = { programId: program.id, sourceId: source.id, exam: 'JEE_MAIN' as const, counsellingSystem: 'JOSAA' as const, rankType: 'CRL' as const, quota: 'AI', category: 'OPEN' as const, isPwd: false, seatPool: 'GENDER_NEUTRAL' as const, metric: 'RANK' as const };
    const records = await Promise.all([
      db.cutoffRecord.create({ data: { ...dimensions, year: 2022, round: 1, openingValue: 100, closingValue: 200 } }),
      db.cutoffRecord.create({ data: { ...dimensions, year: 2024, round: 1, openingValue: 80, closingValue: 160 } }),
      db.cutoffRecord.create({ data: { ...dimensions, year: 2024, round: 3, openingValue: null, closingValue: 140 } }),
      db.cutoffRecord.create({ data: { ...dimensions, year: 2023, round: 1, openingValue: 90, closingValue: 180 } }),
      db.cutoffRecord.create({ data: { ...dimensions, year: 2024, round: 1, quota: 'HS', openingValue: 10, closingValue: 20 } }),
    ]);
    await db.evidenceDecision.createMany({ data: [0, 1, 2, 4].map((index) => ({ cutoffId: records[index].id, reviewerId: reviewer.id, status: 'APPROVED', reason: 'Synthetic chart test only' })) });
    const secondProgram = await db.program.create({ data: { collegeId: college.id, name: 'Engineering Systems', branch: 'Engineering Systems', degree: 'B.Tech' } });
    const secondRecord = await db.cutoffRecord.create({ data: { ...dimensions, programId: secondProgram.id, year: 2024, round: 1, openingValue: 50, closingValue: 100 } });
    await db.evidenceDecision.create({ data: { cutoffId: secondRecord.id, reviewerId: reviewer.id, status: 'APPROVED', reason: 'Synthetic ambiguity test only' } });
    const selection = { college: college.slug, program: 'Synthetic Engineering', counsellingSystem: 'JOSAA' as const, rankType: 'CRL' as const, exam: 'JEE_MAIN' as const, category: 'OPEN' as const, quota: 'AI', seatPool: 'GENDER_NEUTRAL' as const, isPwd: false, metric: 'RANK' as const };
    const trend = await listPublicCutoffTrend(db, selection);
    expect(trend.state).toBe('READY');
    expect(trend.rows.map(({ year, round }) => `${year}-${round}`)).toEqual(['2022-1', '2024-1', '2024-3']);
    expect(trend.rows.map(({ openingValue, closingValue }) => [openingValue, closingValue])).toEqual([[100, 200], [80, 160], [null, 140]]);
    const ambiguous = await listPublicCutoffTrend(db, { ...selection, program: 'Engineering' });
    expect(ambiguous.state).toBe('AMBIGUOUS');
    expect(ambiguous.rows).toEqual([]);
    const insufficient = await listPublicCutoffTrend(db, { college: college.slug, program: 'Synthetic Engineering' });
    expect(insufficient.state).toBe('NEEDS_FILTERS');
    const nonRank = await listPublicCutoffTrend(db, { ...selection, metric: 'SCORE' });
    expect(nonRank.state).toBe('NOT_RANKS');
  });

  it('returns all 61 eligible records across the default 25-row pages', async () => {
    const fixtures = await createScaleFixture(61);
    const pages = await Promise.all([1, 2, 3].map((page) => listPublicCutoffs(db, { page })));
    expect(pages.map((page) => page.items.length)).toEqual([25, 25, 11]);
    expect(pages.map((page) => page.total)).toEqual([61, 61, 61]);
    expect(pages.map((page) => page.totalPages)).toEqual([3, 3, 3]);
    const actualIds = pages.flatMap((page) => page.items.map((row) => row.id));
    expect(new Set(actualIds).size).toBe(61);
    expect(actualIds).toEqual(fixtures.toSorted(expectedOrder).map((row) => row.id));
    const tie = fixtures.find((row) => row.id === 'cf4-scale-00000')!;
    const tied = await listPublicCutoffs(db, {
      college: 'Synthetic Equal Sort College', program: tie.branch, counsellingSystem: tie.counsellingSystem,
      exam: tie.exam, year: tie.year, category: tie.category, quota: tie.quota, seatPool: tie.seatPool,
      round: tie.round, isPwd: tie.isPwd, metric: tie.metric,
    });
    expect(tied.items.map((row) => row.id)).toEqual(['cf4-scale-00000', 'cf4-scale-00001']);
    expect(tied.items[0]).toMatchObject({ counsellingSystem: 'UNSPECIFIED', rankType: 'UNSPECIFIED' });
  }, 60_000);

  it('paginates 2,001 rows, isolates compound dimensions, and records local query plans and latency', async () => {
    const fixtures = await createScaleFixture(2_001);
    await db.$executeRawUnsafe('ANALYZE "CutoffRecord"; ANALYZE "Program"; ANALYZE "College"; ANALYZE "Source"; ANALYZE "EvidenceDecision";');
    const pageSize = 100;
    const pageCount = Math.ceil(fixtures.length / pageSize);
    const pages = [];
    for (let page = 1; page <= pageCount; page++) {
      pages.push(await listPublicCutoffs(db, { page, pageSize }));
    }
    expect(pageCount).toBe(21);
    expect(pages.map((page) => page.items.length)).toEqual([...Array(20).fill(100), 1]);
    expect(pages.every((page) => page.total === 2_001 && page.totalPages === 21)).toBe(true);
    const actualIds = pages.flatMap((page) => page.items.map((row) => row.id));
    expect(new Set(actualIds).size).toBe(2_001);
    expect(actualIds).toEqual(fixtures.toSorted(expectedOrder).map((row) => row.id));

    const selected = fixtures[817];
    const filters = {
      college: selected.collegeSlug, program: selected.branch, counsellingSystem: selected.counsellingSystem, rankType: selected.rankType,
      exam: selected.exam, year: selected.year, category: selected.category, quota: selected.quota,
      seatPool: selected.seatPool, round: selected.round, isPwd: selected.isPwd, metric: selected.metric,
      pageSize: 100,
    };
    const expected = expectedFilter(fixtures, filters);
    const filtered = await listPublicCutoffs(db, filters);
    expect(filtered.total).toBe(expected.length);
    expect(filtered.items.map((row) => row.id)).toEqual(expected.map((row) => row.id).slice(0, 100));
    expect(filtered.items[0]).toMatchObject({
      id: expected[0].id, year: expected[0].year, round: expected[0].round, quota: expected[0].quota,
      category: expected[0].category, seatPool: expected[0].seatPool, isPwd: expected[0].isPwd,
      openingValue: expected[0].openingValue, closingValue: expected[0].closingValue,
      counsellingSystem: expected[0].counsellingSystem, rankType: expected[0].rankType,
      source: { name: expected[0].sourceName, publisher: expected[0].publisher, url: expected[0].url, publishedAt: expected[0].publishedAt, retrievedAt: expected[0].retrievedAt },
    });
    expect(filtered.items[0].reviewedAt).toEqual(new Date('2025-07-01T00:00:00.000Z'));
    expect(await listPublicCutoffs(db, { page: 99, pageSize }).then((result) => result)).toMatchObject({ page: 21, total: 2_001, items: [{ id: actualIds[2_000] }] });

    const unspecified = await listPublicCutoffs(db, {
      counsellingSystem: 'UNSPECIFIED', exam: fixtures[0].exam, year: fixtures[0].year,
      category: fixtures[0].category, quota: fixtures[0].quota, seatPool: fixtures[0].seatPool,
      round: fixtures[0].round, isPwd: fixtures[0].isPwd, metric: fixtures[0].metric,
    });
    expect(unspecified.items.map((row) => row.id)).toEqual(['cf4-scale-00000', 'cf4-scale-00001']);
    expect(unspecified.items.every((row) => row.counsellingSystem === 'UNSPECIFIED' && row.rankType === 'UNSPECIFIED')).toBe(true);

    const broadStatements = cutoffQueryStatements({ pageSize });
    const laterPageStatements = cutoffQueryStatements({ page: 21, pageSize });
    const selectiveStatements = cutoffQueryStatements({ ...filters, page: 1 });
    const timings = {
      nonselectiveFirstPage: await measure(() => db.$queryRaw(broadStatements.page(1))),
      nonselectiveLaterPage: await measure(() => db.$queryRaw(laterPageStatements.page(21))),
      selectivePage: await measure(() => db.$queryRaw(selectiveStatements.page(1))),
      nonselectiveFilteredCount: await measure(() => db.$queryRaw(broadStatements.count)),
      selectiveFilteredCount: await measure(() => db.$queryRaw(selectiveStatements.count)),
    };
    const plans = {
      nonselectivePage: await explain(broadStatements.page(1)),
      selectivePage: await explain(selectiveStatements.page(1)),
      nonselectiveCount: await explain(broadStatements.count),
      selectiveCount: await explain(selectiveStatements.count),
    };
    expect(plans.nonselectivePage.nodes.some((node) => node.relation === 'EvidenceDecision' && node.index === 'EvidenceDecision_cutoffId_createdAt_id_idx')).toBe(true);
    expect(plans.nonselectiveCount.nodes.some((node) => node.relation === 'EvidenceDecision' && node.index === 'EvidenceDecision_cutoffId_createdAt_id_idx')).toBe(true);
    console.info('[phase4-cutoff-benchmark]', JSON.stringify({ datasetRows: fixtures.length, approvedPublicRows: 2_001, pageSize, timings, plans }));
  }, 180_000);
});

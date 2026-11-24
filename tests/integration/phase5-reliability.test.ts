import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import { resetDb, testDb } from './db';

const db = testDb();
const session = vi.hoisted(() => ({ current: null as null | { id: string; role: 'USER' | 'ADMIN' } }));
vi.mock('@/lib/prisma', async () => {
  const { testDb } = await import('./db');
  const { projectPublicResult } = await import('@/server/public-evidence');
  return { prisma: testDb().$extends({ query: { $allModels: { async $allOperations({ operation, args, query }) {
    const result = await query(args);
    return operation.startsWith('find') ? projectPublicResult(result) : result;
  } } } }) };
});
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => (session.current ? { user: session.current } : null)) }));

const savedRoute = await import('@/app/api/saved/route');
const collegesRoute = await import('@/app/api/colleges/route');
const ORIGIN = 'https://collegefind.test';
const req = (path: string, init: RequestInit = {}) => new Request(`${ORIGIN}${path}`, {
  ...init,
  headers: { origin: ORIGIN, host: 'collegefind.test', 'content-type': 'application/json', ...(init.headers ?? {}) },
});
const json = async (response: Response) => ({ status: response.status, body: await response.json() });

beforeEach(async () => {
  await resetDb();
  session.current = null;
});
afterAll(async () => { await resetDb(); await db.$disconnect(); });

describe('Phase 5 search scale and shortlist concurrency', () => {
  it('preserves reviewed search counts and pagination at 205 and 5,205 colleges, while recording local latency distributions', async () => {
    const year = new Date().getUTCFullYear();
    const source = await db.source.create({ data: {
      name: 'Synthetic Phase 5 benchmark fixture — not an official source',
      publisher: 'CollegeFind test fixture', url: 'https://fixture.invalid/phase5-search', retrievedAt: new Date(),
    } });
    const reviewer = await db.user.create({ data: {
      name: 'Synthetic benchmark reviewer', email: 'phase5-benchmark@collegefind.test', password: 'test-only', role: 'ADMIN',
    } });

    const addColleges = async (start: number, count: number) => {
      await db.college.createMany({ data: Array.from({ length: count }, (_, offset) => {
        const index = start + offset;
        return {
          slug: `phase5-scale-${String(index).padStart(5, '0')}`,
          name: `Synthetic Scale College ${String(index).padStart(5, '0')}`,
          shortName: `SSC ${index}`, city: 'Benchmark City', state: 'Test State', type: 'GOVERNMENT' as const,
          dataStatus: 'UNVERIFIED' as const,
        };
      }) });

      const matching = Array.from({ length: count }, (_, offset) => start + offset).filter((index) => index % 25 === 0);
      if (!matching.length) return;
      const colleges = await db.college.findMany({
        where: { slug: { in: matching.map((index) => `phase5-scale-${String(index).padStart(5, '0')}`) } },
        select: { id: true, slug: true },
      });
      await db.fieldEvidence.createMany({ data: colleges.map((college) => ({
        collegeId: college.id,
        field: 'structured.programme',
        value: { kind: 'programme', programme: 'B.Tech Computer Science', level: 'UG', durationMonths: 48 },
        programScope: 'B.Tech Computer Science', academicYear: year,
        validUntil: new Date(`${year + 1}-12-31T00:00:00.000Z`), sourceId: source.id,
        identityKey: `phase5-scale-claim-${college.slug}`,
      })) });
      const claims = await db.fieldEvidence.findMany({
        where: { identityKey: { in: colleges.map((college) => `phase5-scale-claim-${college.slug}`) } }, select: { id: true },
      });
      await db.evidenceDecision.createMany({ data: claims.map((claim) => ({
        evidenceId: claim.id, reviewerId: reviewer.id, status: 'APPROVED' as const,
        reason: 'Synthetic test-only approval for search performance; not a genuine college verification',
      })) });
    };

    await addColleges(0, 205);
    const measure = async (expectedTotal: number, samples = 30) => {
      const durations: number[] = [];
      let first: { body: { colleges: Array<{ id: string; slug: string }>; total: number; totalPages: number; page: number } } | undefined;
      for (let index = 0; index < samples + 1; index++) {
        const start = performance.now();
        const response = await collegesRoute.GET(req('/api/colleges?city=Benchmark%20City&programme=Computer%20Science&sort=name&page=1&limit=50'));
        const elapsed = performance.now() - start;
        const body = await response.json() as { colleges: Array<{ id: string; slug: string }>; total: number; totalPages: number; page: number };
        expect(response.status).toBe(200);
        expect(body.total).toBe(expectedTotal);
        expect(body.page).toBe(1);
        expect(body.totalPages).toBe(Math.ceil(expectedTotal / 50));
        first ??= { body };
        if (index > 0) durations.push(elapsed); // one warm-up request is excluded
      }
      const sorted = [...durations].sort((a, b) => a - b);
      const percentile = (p: number) => Number(sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)].toFixed(2));
      const ids = new Set<string>();
      const slugs: string[] = [];
      for (let page = 1; page <= Math.ceil(expectedTotal / 50); page++) {
        const response = await collegesRoute.GET(req(`/api/colleges?city=Benchmark%20City&programme=Computer%20Science&sort=name&page=${page}&limit=50`));
        const body = await response.json() as { colleges: Array<{ id: string; slug: string }>; total: number };
        expect(body.total).toBe(expectedTotal);
        for (const row of body.colleges) { expect(ids.has(row.id)).toBe(false); ids.add(row.id); slugs.push(row.slug); }
      }
      expect(ids.size).toBe(expectedTotal);
      return { p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99), sampleCount: samples, returned: first?.body.colleges.length, total: ids.size, slugs };
    };

    const baseline = await measure(9);
    await addColleges(205, 5000);
    const expanded = await measure(209);
    // A local engineering budget for a 25x catalogue expansion, not a production SLA.
    expect(expanded.p95Ms).toBeLessThanOrEqual(300);
    const explain = await db.$queryRaw<unknown[]>`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT id FROM "College" WHERE city = 'Benchmark City' ORDER BY name ASC, id ASC LIMIT 50
    `;
    type PlanNode = { 'Node Type': string; 'Relation Name'?: string; 'Actual Rows': number; 'Shared Hit Blocks': number; 'Shared Read Blocks': number; 'Plans'?: PlanNode[] };
    const plan = (explain[0] as { 'QUERY PLAN': Array<{ Plan: PlanNode; 'Execution Time': number }> })['QUERY PLAN'][0];
    const summarizePlan = (node: PlanNode): object => ({ node: node['Node Type'], relation: node['Relation Name'], actualRows: node['Actual Rows'], sharedHitBlocks: node['Shared Hit Blocks'], sharedReadBlocks: node['Shared Read Blocks'], children: node.Plans?.map(summarizePlan) });
    const serverVersion = await db.$queryRaw<Array<{ version: string }>>`SELECT current_setting('server_version') AS version`;
    console.info('PHASE5_SEARCH_PLAN', JSON.stringify({ tree: summarizePlan(plan.Plan), executionMs: plan['Execution Time'] }));

    console.info('PHASE5_SEARCH_BENCHMARK', JSON.stringify({ dataset: 'synthetic disposable PostgreSQL; 205 then 5,205 colleges; 4% reviewed programme facts; 30 warm requests per size; local route handler including Prisma, projection, JSON serialization/parsing; one warm-up excluded', conditions: { node: process.version, platform: process.platform, architecture: process.arch, logicalCpus: os.cpus().length, memoryGiB: Number((os.totalmem() / 1024 ** 3).toFixed(1)), postgresql: serverVersion[0].version }, baseline: { ...baseline, slugs: undefined }, expanded: { ...expanded, slugs: undefined } }));

    // Database-backed identity filters remain bounded and deterministic; names tie to an explicit unique id order.
    await db.college.createMany({ data: ['a', 'b', 'c'].map((suffix) => ({
      id: `phase5-tie-${suffix}`, slug: `phase5-tie-${suffix}`, name: 'Shared Search Name', shortName: 'Shared',
      city: 'Tie City', state: 'Test State', type: 'GOVERNMENT' as const,
    })) });
    const tiePages = await Promise.all([1, 2, 3].map(async (page) => {
      const response = await collegesRoute.GET(req(`/api/colleges?search=Shared%20Search%20Name&limit=1&page=${page}`));
      const body = await response.json() as { colleges: Array<{ id: string }>; total: number };
      expect(body.total).toBe(3);
      return body.colleges[0].id;
    }));
    expect(tiePages).toEqual(['phase5-tie-a', 'phase5-tie-b', 'phase5-tie-c']);

    const unknown = await json(await collegesRoute.GET(req('/api/colleges?city=Benchmark%20City&programme=Not%20Published')));
    expect(unknown.status).toBe(200);
    expect(unknown.body.total).toBe(0);
  }, 120_000);

  it('serializes 201 competing shortlist entries at the 200 cap and keeps two-session reads owner-scoped and ordered', async () => {
    const owner = await db.user.create({ data: { name: 'Synthetic owner', email: 'phase5-stress-owner@collegefind.test', password: 'test-only', role: 'USER' } });
    const other = await db.user.create({ data: { name: 'Synthetic other', email: 'phase5-stress-other@collegefind.test', password: 'test-only', role: 'USER' } });
    await db.college.createMany({ data: Array.from({ length: 201 }, (_, index) => ({
      slug: `phase5-save-${String(index).padStart(3, '0')}`, name: `Phase 5 save ${String(index).padStart(3, '0')}`,
      shortName: `P5 ${index}`, city: 'Test City', state: 'Test State', type: 'GOVERNMENT' as const,
    })) });
    const keys = Array.from({ length: 201 }, (_, index) => `phase5-save-${String(index).padStart(3, '0')}`);
    session.current = { id: owner.id, role: 'USER' };

    const seeded = await json(await savedRoute.POST(req('/api/saved', { method: 'POST', body: JSON.stringify({ collegeKeys: keys.slice(0, 199) }) })));
    expect(seeded).toMatchObject({ status: 200, body: { savedCount: 199, alreadySavedCount: 0 } });

    const competing = await Promise.all(keys.slice(199).map((collegeKey) => savedRoute.POST(req('/api/saved', {
      method: 'POST', body: JSON.stringify({ collegeKeys: [collegeKey] }),
    }))));
    const results = await Promise.all(competing.map(json));
    expect(results.filter((result) => result.status === 200)).toHaveLength(1);
    expect(results.filter((result) => result.status === 409)).toHaveLength(1);
    expect(await db.savedCollege.count({ where: { userId: owner.id } })).toBe(200);

    const firstSessionRead = await json(await savedRoute.GET());
    const secondSessionRead = await json(await savedRoute.GET());
    expect(firstSessionRead.status).toBe(200);
    expect(firstSessionRead.body.saved.map((college: { id: string }) => college.id)).toEqual(secondSessionRead.body.saved.map((college: { id: string }) => college.id));

    const idempotentMerge = await json(await savedRoute.POST(req('/api/saved', {
      method: 'POST', body: JSON.stringify({ collegeKeys: firstSessionRead.body.saved.map((college: { slug: string }) => college.slug) }),
    })));
    expect(idempotentMerge).toMatchObject({ status: 200, body: { savedCount: 0, alreadySavedCount: 200 } });
    expect(await db.savedCollege.count({ where: { userId: owner.id } })).toBe(200);

    session.current = { id: other.id, role: 'USER' };
    expect((await json(await savedRoute.GET())).body.saved).toEqual([]);
    session.current = null;
    expect((await json(await savedRoute.GET())).status).toBe(401);
  }, 60_000);
});

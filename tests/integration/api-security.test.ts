/**
 * Exercises the real route handlers against a real database.
 * These are regression tests for the vulnerabilities found in the audit.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hash } from 'bcryptjs';
import { resetDb, testDb } from './db';

const db = testDb();

// Routes import the shared client; point it at the test database.
vi.mock('@/lib/prisma', async () => {
  const { testDb } = await import('./db');
  return { prisma: testDb() };
});

const session = vi.hoisted(() => ({ current: null as null | { id: string; role: 'USER' | 'ADMIN' } }));
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => (session.current ? { user: session.current } : null)),
}));

const { resetRateLimitsForTests } = await import('@/lib/rate-limit');
const seedRoute = await import('@/app/api/seed/route');
const registerRoute = await import('@/app/api/auth/register/route');
const savedRoute = await import('@/app/api/saved/route');
const savedIdRoute = await import('@/app/api/saved/[collegeId]/route');
const comparisonsRoute = await import('@/app/api/comparisons/route');
const comparisonIdRoute = await import('@/app/api/comparisons/[id]/route');
const questionsRoute = await import('@/app/api/questions/route');
const collegesRoute = await import('@/app/api/colleges/route');
const moderationRoute = await import('@/app/api/admin/moderation/route');
const questionsByCollege = await import('@/app/api/questions/[collegeId]/route');
const collegeDetailRoute = await import('@/app/api/colleges/[id]/route');
const cutoffsRoute = await import('@/app/api/colleges/[id]/cutoffs/route');
const featuredRoute = await import('@/app/api/colleges/featured/route');
const similarRoute = await import('@/app/api/colleges/similar/[id]/route');
const rankingsRoute = await import('@/app/api/rankings/route');
const statsRoute = await import('@/app/api/stats/route');

const ORIGIN = 'https://collegefind.test';
const req = (path: string, init: RequestInit & { origin?: string | null } = {}) => {
  const headers = new Headers(init.headers);
  if (init.origin !== null) headers.set('origin', init.origin ?? ORIGIN);
  headers.set('host', 'collegefind.test');
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  headers.set('x-forwarded-for', '203.0.113.9');
  return new Request(`${ORIGIN}${path}`, { ...init, headers });
};
const json = async (res: Response) => ({ status: res.status, body: await res.json().catch(() => null) });

async function makeUser(email: string, role: 'USER' | 'ADMIN' = 'USER') {
  return db.user.create({
    data: { name: 'Test', email, password: await hash('correct horse battery', 4), role },
    select: { id: true },
  });
}
async function makeCollege(slug: string) {
  return db.college.create({
    data: { slug, name: `College ${slug}`, shortName: slug, city: 'C', state: 'Kerala', type: 'GOVERNMENT' },
    select: { id: true },
  });
}

beforeEach(async () => {
  await resetDb();
  resetRateLimitsForTests();
  session.current = null;
  delete process.env.SEED_ENABLED;
  delete process.env.ADMIN_SEED_TOKEN;
});
afterAll(async () => {
  await db.$disconnect();
});

describe('seed endpoint (was: public and destructive)', () => {
  it('GET is gone — the old ?force=true wipe is unreachable', async () => {
    expect((await json(await seedRoute.GET())).status).toBe(404);
  });

  it('POST is 404 while seeding is disabled', async () => {
    expect((await json(await seedRoute.POST(req('/api/seed', { method: 'POST' })))).status).toBe(404);
  });

  it('POST without the admin token is rejected, and user data survives', async () => {
    process.env.SEED_ENABLED = 'true';
    process.env.ADMIN_SEED_TOKEN = 'x'.repeat(40);
    const user = await makeUser('keep@example.com');
    const college = await makeCollege('keep-me');
    await db.savedCollege.create({ data: { userId: user.id, collegeId: college.id } });

    expect((await json(await seedRoute.POST(req('/api/seed', { method: 'POST' })))).status).toBe(401);
    expect(
      (await json(await seedRoute.POST(req('/api/seed', { method: 'POST', headers: { authorization: 'Bearer wrong-token-but-long-enough-value' } })))).status,
    ).toBe(401);

    expect(await db.savedCollege.count()).toBe(1);
    expect(await db.college.count()).toBe(1);
  });

  it('fails closed for missing seed credentials and refuses synthetic data in production', async () => {
    process.env.SEED_ENABLED = 'true';
    delete process.env.ADMIN_SEED_TOKEN;
    expect((await json(await seedRoute.POST(req('/api/seed', { method: 'POST' })))).status).toBe(404);

    const oldNodeEnv = process.env.NODE_ENV;
    try {
      Reflect.set(process.env, 'NODE_ENV', 'production');
      process.env.SEED_ALLOW_PRODUCTION = 'true';
      process.env.ADMIN_SEED_TOKEN = 'z'.repeat(40);
      const response = await json(await seedRoute.POST(req('/api/seed?synthetic=true', {
        method: 'POST', headers: { authorization: `Bearer ${process.env.ADMIN_SEED_TOKEN}` },
      })));
      expect(response.status).toBe(400);
      expect(await db.auditLog.count({ where: { action: 'seed.run' } })).toBe(0);
    } finally {
      if (oldNodeEnv === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV');
      else Reflect.set(process.env, 'NODE_ENV', oldNodeEnv);
    }
  });

  it('with the correct token it only adds colleges and never deletes', async () => {
    process.env.SEED_ENABLED = 'true';
    const token = 'y'.repeat(40);
    process.env.ADMIN_SEED_TOKEN = token;
    const user = await makeUser('keep2@example.com');
    const college = await makeCollege('keep-me-2');
    await db.savedCollege.create({ data: { userId: user.id, collegeId: college.id } });

    const res = await json(await seedRoute.POST(req('/api/seed', { method: 'POST', headers: { authorization: `Bearer ${token}` } })));
    expect(res.status).toBe(200);
    expect(res.body.created).toBeGreaterThan(0);
    expect(await db.savedCollege.count()).toBe(1);
    expect(await db.college.findUnique({ where: { id: college.id } })).not.toBeNull();
    expect(await db.auditLog.count({ where: { action: 'seed.run' } })).toBe(1);
  });
});

describe('registration', () => {
  const body = (o: object) => ({ method: 'POST', body: JSON.stringify(o) });

  it('creates a user and never returns the password hash', async () => {
    const res = await json(await registerRoute.POST(req('/api/auth/register', body({ name: 'Asha', email: 'asha@example.com', password: 'correct horse battery' }))));
    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toContain('$2');
    expect(res.body.user.email).toBe('asha@example.com');
  });

  it('rejects weak passwords with field-level errors', async () => {
    const res = await json(await registerRoute.POST(req('/api/auth/register', body({ name: 'A', email: 'a@example.com', password: 'password123' }))));
    expect(res.status).toBe(400);
    expect(res.body.details.password).toBeTruthy();
  });

  it('treats emails case-insensitively and does not confirm which email exists', async () => {
    await registerRoute.POST(req('/api/auth/register', body({ name: 'A', email: 'dup@example.com', password: 'correct horse battery' })));
    const res = await json(await registerRoute.POST(req('/api/auth/register', body({ name: 'B', email: 'DUP@example.com', password: 'another good passphrase' }))));
    expect(res.status).toBe(409);
    expect(res.body.error).not.toMatch(/already registered/i);
    expect(await db.user.count()).toBe(1);
  });

  it('rate limits repeated signups from one IP', async () => {
    for (let i = 0; i < 5; i++) {
      await registerRoute.POST(req('/api/auth/register', body({ name: 'A', email: `u${i}@example.com`, password: 'correct horse battery' })));
    }
    const res = await json(await registerRoute.POST(req('/api/auth/register', body({ name: 'A', email: 'last@example.com', password: 'correct horse battery' }))));
    expect(res.status).toBe(429);
  });

  it('rejects cross-origin posts (CSRF)', async () => {
    const r = await registerRoute.POST(req('/api/auth/register', { ...body({ name: 'A', email: 'x@example.com', password: 'correct horse battery' }), origin: 'https://evil.example' }));
    expect(r.status).toBe(403);
  });

  it('rejects non-JSON content types and oversized bodies', async () => {
    const form = new Request(`${ORIGIN}/api/auth/register`, { method: 'POST', body: 'name=a', headers: { origin: ORIGIN, host: 'collegefind.test', 'content-type': 'application/x-www-form-urlencoded' } });
    expect((await json(await registerRoute.POST(form))).status).toBe(415);
    const big = await json(await registerRoute.POST(req('/api/auth/register', body({ name: 'A'.repeat(50_000), email: 'b@example.com', password: 'correct horse battery' }))));
    expect(big.status).toBe(413);
  });
});

describe('saved colleges and comparisons (authorization)', () => {
  it('requires authentication', async () => {
    expect((await json(await savedRoute.GET())).status).toBe(401);
    expect((await json(await comparisonsRoute.GET())).status).toBe(401);
  });

  it('cannot delete another user’s saved college or comparison (IDOR)', async () => {
    const [victim, attacker] = [await makeUser('victim@example.com'), await makeUser('attacker@example.com')];
    const college = await makeCollege('shared');
    await db.savedCollege.create({ data: { userId: victim.id, collegeId: college.id } });
    const comparison = await db.savedComparison.create({
      data: { userId: victim.id, signature: 'a|b', collegeIds: [college.id, college.id] },
    });

    session.current = { id: attacker.id, role: 'USER' };
    const del = await json(await savedIdRoute.DELETE(req(`/api/saved/${college.id}`, { method: 'DELETE' }), { params: Promise.resolve({ collegeId: college.id }) }));
    expect(del.body.removed).toBe(0);
    expect(await db.savedCollege.count({ where: { userId: victim.id } })).toBe(1);

    const delCmp = await json(await comparisonIdRoute.DELETE(req(`/api/comparisons/${comparison.id}`, { method: 'DELETE' }), { params: Promise.resolve({ id: comparison.id }) }));
    expect(delCmp.status).toBe(404);
    expect(await db.savedComparison.count()).toBe(1);
  });

  it('deletes only the owner comparison and validates identifiers and origin', async () => {
    const user = await makeUser('comparison-owner@example.com');
    const owned = await db.savedComparison.create({ data: { userId: user.id, signature: 'owned', collegeIds: ['a', 'b'] } });
    session.current = { id: user.id, role: 'USER' };
    expect((await json(await comparisonIdRoute.DELETE(req('/api/comparisons/bad/id', { method: 'DELETE' }), { params: Promise.resolve({ id: 'bad/id' }) }))).status).toBe(400);
    expect((await json(await comparisonIdRoute.DELETE(req(`/api/comparisons/${owned.id}`, { method: 'DELETE', origin: 'https://attacker.test' }), { params: Promise.resolve({ id: owned.id }) }))).status).toBe(403);
    expect((await json(await comparisonIdRoute.DELETE(req(`/api/comparisons/${owned.id}`, { method: 'DELETE' }), { params: Promise.resolve({ id: owned.id }) }))).status).toBe(200);
    expect((await json(await comparisonIdRoute.DELETE(req(`/api/comparisons/${owned.id}`, { method: 'DELETE' }), { params: Promise.resolve({ id: owned.id }) }))).status).toBe(404);
  });

  it('saving the same college twice is idempotent, not a 500', async () => {
    const user = await makeUser('saver@example.com');
    const college = await makeCollege('save-twice');
    session.current = { id: user.id, role: 'USER' };
    const body = { method: 'POST', body: JSON.stringify({ collegeId: college.id }) };
    const first = await json(await savedRoute.POST(req('/api/saved', body)));
    const second = await json(await savedRoute.POST(req('/api/saved', body)));
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.alreadySaved).toBe(true);
    expect(await db.savedCollege.count()).toBe(1);
  });

  it('merges a device shortlist by stable slug atomically and idempotently', async () => {
    const user = await makeUser('guest-merge@example.com');
    const [first, second] = await Promise.all([makeCollege('guest-merge-a'), makeCollege('guest-merge-b')]);
    session.current = { id: user.id, role: 'USER' };
    const body = { method: 'POST', body: JSON.stringify({ collegeKeys: ['guest-merge-a', second.id, 'guest-merge-a'] }) };
    const invalid = await json(await savedRoute.POST(req('/api/saved', body)));
    expect(invalid.status).toBe(400);
    const missing = await json(await savedRoute.POST(req('/api/saved', { method: 'POST', body: JSON.stringify({ collegeKeys: ['guest-merge-a', 'missing-guest-college'] }) })));
    expect(missing.status).toBe(404);
    expect(await db.savedCollege.count({ where: { userId: user.id } })).toBe(0);
    const batch = { method: 'POST', body: JSON.stringify({ collegeKeys: ['guest-merge-a', 'guest-merge-b'] }) };
    expect((await json(await savedRoute.POST(req('/api/saved', batch)))).body).toMatchObject({ savedCount: 2, alreadySavedCount: 0 });
    expect((await json(await savedRoute.POST(req('/api/saved', batch)))).body).toMatchObject({ savedCount: 0, alreadySavedCount: 2 });
    expect(await db.savedCollege.count({ where: { userId: user.id } })).toBe(2);
    expect((await db.savedCollege.findMany({ where: { userId: user.id }, select: { collegeId: true } })).map((row) => row.collegeId).sort()).toEqual([first.id, second.id].sort());
  });

  it('serializes concurrent guest-list merges without losing or duplicating selections', async () => {
    const user = await makeUser('guest-merge-race@example.com');
    const [a, b, c] = await Promise.all([makeCollege('guest-race-a'), makeCollege('guest-race-b'), makeCollege('guest-race-c')]);
    session.current = { id: user.id, role: 'USER' };
    const post = (collegeKeys: string[]) => savedRoute.POST(req('/api/saved', { method: 'POST', body: JSON.stringify({ collegeKeys }) }));
    const responses = await Promise.all([post([a.id, b.id]), post([b.id, c.id])]);
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(await db.savedCollege.count({ where: { userId: user.id } })).toBe(3);
  });

  it('concurrent saves of the same college create only one row', async () => {
    const user = await makeUser('race@example.com');
    const college = await makeCollege('race');
    session.current = { id: user.id, role: 'USER' };
    const body = { method: 'POST', body: JSON.stringify({ collegeId: college.id }) };
    const results = await Promise.all([1, 2, 3, 4].map(() => savedRoute.POST(req('/api/saved', body))));
    expect(results.every((r) => r.status < 400)).toBe(true);
    expect(await db.savedCollege.count()).toBe(1);
  });

  it('rejects saving a college that does not exist', async () => {
    const user = await makeUser('ghost@example.com');
    session.current = { id: user.id, role: 'USER' };
    const res = await json(await savedRoute.POST(req('/api/saved', { method: 'POST', body: JSON.stringify({ collegeId: 'doesnotexist' }) })));
    expect(res.status).toBe(404);
  });

  it('comparisons need 2–3 distinct, existing colleges', async () => {
    const user = await makeUser('cmp@example.com');
    const a = await makeCollege('cmp-a');
    session.current = { id: user.id, role: 'USER' };
    const bad = await json(await comparisonsRoute.POST(req('/api/comparisons', { method: 'POST', body: JSON.stringify({ collegeIds: [a.id] }) })));
    expect(bad.status).toBe(400);
    const missing = await json(await comparisonsRoute.POST(req('/api/comparisons', { method: 'POST', body: JSON.stringify({ collegeIds: [a.id, 'nope'] }) })));
    expect(missing.status).toBe(404);
  });

  it('creates canonical saved comparisons and restores current server records while omitting deleted IDs', async () => {
    const user = await makeUser('comparison-restore@example.com');
    const [a, b] = await Promise.all([makeCollege('restore-a'), makeCollege('restore-b')]);
    session.current = { id: user.id, role: 'USER' };

    const stale = await db.savedComparison.create({
      data: { userId: user.id, signature: 'deleted|restore-a', collegeIds: [a.id, 'deleted-college-id'] },
    });
    const saved = await json(await comparisonsRoute.POST(req('/api/comparisons', {
      method: 'POST', body: JSON.stringify({ collegeIds: [b.id, a.id] }),
    })));
    expect(saved.status).toBe(201);
    expect(await db.savedComparison.findUniqueOrThrow({ where: { id: saved.body.comparison.id }, select: { signature: true } }))
      .toEqual({ signature: [a.id, b.id].sort().join('|') });

    const restored = await json(await comparisonsRoute.GET());
    const restoredStale = restored.body.comparisons.find((entry: { id: string }) => entry.id === stale.id);
    const restoredNew = restored.body.comparisons.find((entry: { id: string }) => entry.id === saved.body.comparison.id);
    expect(restoredStale.colleges.map((college: { id: string }) => college.id)).toEqual([a.id]);
    expect(restoredNew.colleges.map((college: { id: string }) => college.id)).toEqual([b.id, a.id]);
    expect(restoredNew.colleges.map((college: { name: string }) => college.name)).toEqual([`College restore-b`, `College restore-a`]);
  });

  it('rejects duplicate saved comparison signatures and enforces the per-user cap', async () => {
    const user = await makeUser('comparison-limit@example.com');
    const [a, b] = await Promise.all([makeCollege('limit-a'), makeCollege('limit-b')]);
    session.current = { id: user.id, role: 'USER' };
    const body = { method: 'POST', body: JSON.stringify({ collegeIds: [a.id, b.id] }) };
    expect((await comparisonsRoute.POST(req('/api/comparisons', body))).status).toBe(201);
    expect((await comparisonsRoute.POST(req('/api/comparisons', body))).status).toBe(409);

    await db.savedComparison.createMany({ data: Array.from({ length: 49 }, (_, i) => ({
      userId: user.id, signature: `limit-${i}`, collegeIds: [a.id, b.id],
    })) });
    expect((await json(await comparisonsRoute.POST(req('/api/comparisons', body)))).status).toBe(409);
  });
});

describe('colleges listing', () => {
  it('searches official historical aliases and campus labels, and resolves guest shortlist slugs in requested order', async () => {
    const first = await makeCollege('alias-search-a');
    const second = await makeCollege('alias-search-b');
    await db.institutionAlias.create({ data: { collegeId: first.id, namespace: 'OFFICIAL', value: 'North Institute', campus: 'Riverside campus', sourceUrl: 'https://example.edu/about' } });
    const alias = await json(await collegesRoute.GET(req('/api/colleges?search=Riverside')));
    expect(alias.body.colleges.map((college: { slug: string }) => college.slug)).toEqual(['alias-search-a']);
    const guest = await json(await collegesRoute.GET(req('/api/colleges?slugs=alias-search-b,alias-search-a,deleted-college')));
    expect(guest.status).toBe(200);
    expect(guest.body.colleges.map((college: { id: string }) => college.id)).toEqual([second.id, first.id]);
    expect(guest.body.missingSlugs).toEqual(['deleted-college']);
  });

  it('matches exam filters only against currently approved, source-backed cutoff evidence', async () => {
    const approvedCollege = await makeCollege('approved-cutoff-search');
    const stagedCollege = await makeCollege('unreviewed-cutoff-search');
    const source = await db.source.create({ data: { name: 'Cutoff authority', publisher: 'Official Authority', url: 'https://example.gov.in/cutoffs', retrievedAt: new Date() } });
    const approvedProgram = await db.program.create({ data: { collegeId: approvedCollege.id, name: 'B.Tech' } });
    const stagedProgram = await db.program.create({ data: { collegeId: stagedCollege.id, name: 'B.Tech' } });
    const common = { exam: 'JEE_MAIN' as const, year: 2025, round: 1, quota: 'AI', category: 'OPEN' as const, seatPool: 'GENDER_NEUTRAL' as const, sourceId: source.id, metric: 'RANK' as const, counsellingSystem: 'JOSAA' as const, rankType: 'CRL' as const, openingValue: 1, closingValue: 100 };
    const approvedCutoff = await db.cutoffRecord.create({ data: { ...common, programId: approvedProgram.id } });
    await db.cutoffRecord.create({ data: { ...common, programId: stagedProgram.id } });
    const reviewer = await makeUser('cutoff-search-reviewer@example.test', 'ADMIN');
    await db.evidenceDecision.create({ data: { cutoffId: approvedCutoff.id, reviewerId: reviewer.id, status: 'APPROVED', reason: 'Synthetic route test approval' } });
    const result = await json(await collegesRoute.GET(req('/api/colleges?exams=JEE_MAIN')));
    expect(result.body.colleges.map((college: { slug: string }) => college.slug)).toEqual(['approved-cutoff-search']);
  });

  it('returns distinct states without applying list pagination', async () => {
    await makeCollege('state-kerala');
    await db.college.create({ data: { slug: 'state-tamil-nadu', name: 'Tamil Nadu Fixture', shortName: 'TN', city: 'Chennai', state: 'Tamil Nadu', type: 'GOVERNMENT' } });
    const response = await json(await collegesRoute.GET(req('/api/colleges?distinct=states&limit=1')));
    expect(response.status).toBe(200);
    expect(response.body.states).toEqual(['Kerala', 'Tamil Nadu']);
  });

  it('handles malformed query parameters with 400, not 500', async () => {
    for (const qs of ['minFees=abc', 'page=abc', 'limit=99999', 'exams=DROP', 'naac=Z', 'minFees=900&maxFees=100', 'slugs=college-a,college-a']) {
      const res = await json(await collegesRoute.GET(req(`/api/colleges?${qs}`)));
      expect(res.status, qs).toBe(400);
    }
  });

  it('is not injectable through filter strings', async () => {
    await makeCollege('safe-one');
    const res = await json(await collegesRoute.GET(req(`/api/colleges?search=${encodeURIComponent("'; DROP TABLE \"College\"; --")}`)));
    expect(res.status).toBe(200);
    expect(res.body.colleges).toEqual([]);
    expect(await db.college.count()).toBe(1);
  });

  it('paginates deterministically with no duplicates across pages', async () => {
    for (let i = 0; i < 7; i++) await makeCollege(`page-${i}`);
    const p1 = await json(await collegesRoute.GET(req('/api/colleges?limit=3&page=1')));
    const p2 = await json(await collegesRoute.GET(req('/api/colleges?limit=3&page=2')));
    expect(p1.body.total).toBe(7);
    expect(p1.body.totalPages).toBe(3);
    const ids = [...p1.body.colleges, ...p2.body.colleges].map((c: { id: string }) => c.id);
    expect(new Set(ids).size).toBe(6);
  });
});

describe('public college endpoints', () => {
  it('loads a detail record by slug and ID and distinguishes invalid and missing identifiers', async () => {
    const college = await makeCollege('detail-fixture');
    expect((await json(await collegeDetailRoute.GET(req('/api/colleges/detail-fixture'), { params: Promise.resolve({ id: 'detail-fixture' }) }))).body.college.id).toBe(college.id);
    expect((await json(await collegeDetailRoute.GET(req(`/api/colleges/${college.id}`), { params: Promise.resolve({ id: college.id }) }))).body.college.slug).toBe('detail-fixture');
    expect((await json(await collegeDetailRoute.GET(req('/api/colleges/nope'), { params: Promise.resolve({ id: 'nope' }) }))).status).toBe(404);
    expect((await json(await collegeDetailRoute.GET(req('/api/colleges/bad%2Fkey'), { params: Promise.resolve({ id: 'bad/key' }) }))).status).toBe(400);
  });

  it('returns all approved historical cutoff rounds and dimensions without demo rows', async () => {
    const college = await makeCollege('cutoff-fixture');
    const source = await db.source.create({ data: { name: 'Fixture source', publisher: 'Authority', url: 'https://example.gov.in/data', retrievedAt: new Date('2026-01-01') } });
    const program = await db.program.create({ data: { collegeId: college.id, name: 'Course', branch: 'Course' } });
    const common = { programId: program.id, exam: 'JEE_MAIN' as const, year: 2025, quota: 'AI', category: 'OPEN' as const, seatPool: 'GENDER_NEUTRAL' as const, sourceId: source.id, metric: 'RANK' as const, counsellingSystem: 'JOSAA' as const, rankType: 'CRL' as const };
    const rows = await Promise.all([
      db.cutoffRecord.create({ data: { ...common, round: 1, openingValue: 1, closingValue: 100 } }),
      db.cutoffRecord.create({ data: { ...common, round: 2, openingValue: 2, closingValue: 90 } }),
      db.cutoffRecord.create({ data: { ...common, round: 3, isPwd: true, rankType: 'PWD_CATEGORY', openingValue: 3, closingValue: 80 } }),
      db.cutoffRecord.create({ data: { ...common, counsellingSystem: 'CSAB', round: 1, openingValue: 4, closingValue: 70 } }),
    ]);
    const demo = await db.college.create({ data: { slug: 'cutoff-demo-fixture', name: 'Demo cutoff fixture', shortName: 'Demo cutoff', city: 'C', state: 'Kerala', type: 'GOVERNMENT', dataStatus: 'DEMO' } });
    const demoProgram = await db.program.create({ data: { collegeId: demo.id, name: 'Demo course' } });
    const demoRow = await db.cutoffRecord.create({ data: { ...common, programId: demoProgram.id, round: 1, openingValue: 5, closingValue: 60 } });
    const admin = await makeUser('cutoff-reviewer@example.test', 'ADMIN');
    await db.evidenceDecision.createMany({ data: [...rows, demoRow].map((row) => ({ cutoffId: row.id, reviewerId: admin.id, status: 'APPROVED' as const, reason: 'Synthetic route test approval' })) });
    const result = await json(await cutoffsRoute.GET(req('/api/colleges/cutoff-fixture/cutoffs'), { params: Promise.resolve({ id: college.id }) }));
    expect(result.status).toBe(200);
    expect(result.body.cutoffs).toHaveLength(4);
    expect(result.body.cutoffs.map((row: { round: number }) => row.round).sort()).toEqual([1, 1, 2, 3]);
    expect(result.body.cutoffs.some((row: { isPwd: boolean }) => row.isPwd)).toBe(true);
    expect(new Set(result.body.cutoffs.map((row: { counsellingSystem: string }) => row.counsellingSystem))).toEqual(new Set(['JOSAA', 'CSAB']));
    const filtered = await json(await cutoffsRoute.GET(req('/api/colleges/cutoff-fixture/cutoffs?counsellingSystem=JOSAA&category=OPEN&isPwd=false'), { params: Promise.resolve({ id: college.id }) }));
    expect(filtered.body.total).toBe(2);
    expect(filtered.body.cutoffs.map((row: { round: number }) => row.round).sort()).toEqual([1, 2]);
    expect((await json(await cutoffsRoute.GET(req('/api/colleges/cutoff-demo-fixture/cutoffs'), { params: Promise.resolve({ id: demo.id }) }))).body.total).toBe(0);
    expect((await json(await cutoffsRoute.GET(req('/api/colleges/missing/cutoffs'), { params: Promise.resolve({ id: 'missing' }) }))).status).toBe(404);
  });

  it('serves neutral featured and similar lists and returns empty/current ranking and stats responses', async () => {
    const primary = await makeCollege('primary-similar');
    await makeCollege('same-state-similar');
    await db.college.create({ data: { slug: 'other-state-similar', name: 'Other State Fixture', shortName: 'OS', city: 'Chennai', state: 'Tamil Nadu', type: 'GOVERNMENT' } });
    const featured = await json(await featuredRoute.GET());
    expect(featured.status).toBe(200);
    expect(featured.body.colleges.length).toBeGreaterThan(0);
    const similar = await json(await similarRoute.GET(req(`/api/colleges/similar/${primary.id}`), { params: Promise.resolve({ id: primary.id }) }));
    expect(similar.status).toBe(200);
    expect(similar.body.colleges.map((college: { id: string }) => college.id)).not.toContain(primary.id);
    expect((await json(await similarRoute.GET(req('/api/colleges/similar/missing'), { params: Promise.resolve({ id: 'missing' }) }))).status).toBe(404);
    const rankings = await json(await rankingsRoute.GET(req('/api/rankings?category=Unpublished')));
    expect(rankings).toMatchObject({ status: 200, body: { year: null, rankings: [], available: [] } });
    const stats = await json(await statsRoute.GET());
    expect(stats).toMatchObject({ status: 200, body: { colleges: 3, demoColleges: 0, verifiedColleges: 0 } });
  });

  it('selects the newest available ranking year or an explicitly requested year', async () => {
    const college = await makeCollege('nirf-fixture');
    const source = await db.source.create({ data: { name: 'NIRF fixture', publisher: 'NIRF', url: 'https://nirfindia.org/fixture', retrievedAt: new Date('2026-01-01') } });
    await db.nirfRanking.createMany({ data: [
      { collegeId: college.id, sourceId: source.id, category: 'Overall', year: 2025, rank: 10, score: 50 },
      { collegeId: college.id, sourceId: source.id, category: 'Overall', year: 2026, rank: 8, score: 55 },
      { collegeId: college.id, sourceId: source.id, category: 'Engineering', year: 2024, rank: 3, score: 60 },
    ] });
    const latest = await json(await rankingsRoute.GET(req('/api/rankings')));
    expect(latest).toMatchObject({ status: 200, body: { category: 'Overall', year: 2026, rankings: [{ year: 2026, rank: 8 }] } });
    const explicit = await json(await rankingsRoute.GET(req('/api/rankings?category=Engineering&year=2024')));
    expect(explicit).toMatchObject({ status: 200, body: { category: 'Engineering', year: 2024, rankings: [{ year: 2024, rank: 3 }] } });
    expect((await json(await rankingsRoute.GET(req('/api/rankings?year=2010')))).status).toBe(400);
  });
});

describe('community content', () => {
  it('stores user text verbatim (escaped at render) and never executes it', async () => {
    const user = await makeUser('asker@example.com');
    const college = await makeCollege('xss-college');
    session.current = { id: user.id, role: 'USER' };
    const payload = '<img src=x onerror="alert(1)"> is the hostel ok?';
    const res = await json(await questionsRoute.POST(req('/api/questions', { method: 'POST', body: JSON.stringify({ collegeId: college.id, text: payload }) })));
    expect(res.status).toBe(201);
    const stored = await db.question.findFirst();
    expect(stored?.text).toBe(payload); // React escapes this on render
  });

  it('rate limits question spam from one account', async () => {
    const user = await makeUser('spammer@example.com');
    const college = await makeCollege('spam-college');
    session.current = { id: user.id, role: 'USER' };
    const post = () => questionsRoute.POST(req('/api/questions', { method: 'POST', body: JSON.stringify({ collegeId: college.id, text: 'A perfectly valid question?' }) }));
    for (let i = 0; i < 10; i++) await post();
    expect((await post()).status).toBe(429);
  });

  it('hidden questions disappear from the public list and are audit-logged', async () => {
    const [user, admin] = [await makeUser('u@example.com'), await makeUser('admin@example.com', 'ADMIN')];
    const college = await makeCollege('mod-college');
    const q = await db.question.create({ data: { text: 'Spam content here', userId: user.id, collegeId: college.id } });

    session.current = { id: user.id, role: 'USER' };
    const forbidden = await json(await moderationRoute.POST(req('/api/admin/moderation', { method: 'POST', body: JSON.stringify({ type: 'question', id: q.id, status: 'HIDDEN' }) })));
    expect(forbidden.status).toBe(403);

    session.current = { id: admin.id, role: 'ADMIN' };
    const ok = await json(await moderationRoute.POST(req('/api/admin/moderation', { method: 'POST', body: JSON.stringify({ type: 'question', id: q.id, status: 'HIDDEN', reason: 'spam' }) })));
    expect(ok.status).toBe(200);

    const list = await json(await questionsByCollege.GET(req(`/api/questions/${college.id}`), { params: Promise.resolve({ collegeId: college.id }) }));
    expect(list.body.questions).toHaveLength(0);
    expect(await db.auditLog.count({ where: { action: 'question.hide' } })).toBe(1);
  });

  it('moderates answers through hide and restore with transactional audit records', async () => {
    const [user, admin] = [await makeUser('answer-author@example.com'), await makeUser('answer-admin@example.com', 'ADMIN')];
    const college = await makeCollege('answer-moderation');
    const question = await db.question.create({ data: { text: 'Question for moderation?', userId: user.id, collegeId: college.id } });
    const answer = await db.answer.create({ data: { text: 'Answer for moderation.', userId: user.id, questionId: question.id } });
    session.current = { id: admin.id, role: 'ADMIN' };

    const badOrigin = await json(await moderationRoute.POST(req('/api/admin/moderation', {
      method: 'POST', origin: 'https://attacker.test', body: JSON.stringify({ type: 'answer', id: answer.id, status: 'HIDDEN' }),
    })));
    expect(badOrigin.status).toBe(403);
    const invalid = await json(await moderationRoute.POST(req('/api/admin/moderation', {
      method: 'POST', body: JSON.stringify({ type: 'answer', id: answer.id, status: 'DELETED' }),
    })));
    expect(invalid.status).toBe(400);

    expect((await moderationRoute.POST(req('/api/admin/moderation', {
      method: 'POST', body: JSON.stringify({ type: 'answer', id: answer.id, status: 'HIDDEN' }),
    }))).status).toBe(200);
    expect((await db.answer.findUniqueOrThrow({ where: { id: answer.id } })).status).toBe('HIDDEN');
    expect((await moderationRoute.POST(req('/api/admin/moderation', {
      method: 'POST', body: JSON.stringify({ type: 'answer', id: answer.id, status: 'VISIBLE', reason: 'Review completed' }),
    }))).status).toBe(200);
    expect((await db.answer.findUniqueOrThrow({ where: { id: answer.id } })).status).toBe('VISIBLE');
    expect(await db.auditLog.count({ where: { action: { in: ['answer.hide', 'answer.restore'] } } })).toBe(2);
  });
});

it('denies a demoted admin even when the session still carries ADMIN', async () => {
 const admin=await makeUser('demoted@example.com','ADMIN');
 session.current={id:admin.id,role:'ADMIN'};
 await db.user.update({where:{id:admin.id},data:{role:'USER'}});
 const response=await moderationRoute.POST(req('/api/admin/moderation',{method:'POST',body:JSON.stringify({type:'question',id:'not-used',status:'HIDDEN'})}));
 expect(response.status).toBe(403);
 expect(await db.auditLog.count()).toBe(0);
});

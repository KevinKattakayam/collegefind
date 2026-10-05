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
});

describe('colleges listing', () => {
  it('handles malformed query parameters with 400, not 500', async () => {
    for (const qs of ['minFees=abc', 'page=abc', 'limit=99999', 'exams=DROP', 'naac=Z', 'minFees=900&maxFees=100']) {
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
});

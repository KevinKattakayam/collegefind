import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb, testDb } from './db';

const db = testDb();
const session = vi.hoisted(() => ({ current: null as null | { id: string; role: 'USER' | 'ADMIN' } }));
vi.mock('@/lib/prisma', async () => { const { testDb } = await import('./db'); return { prisma: testDb() }; });
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current ? { user: session.current } : null) }));
const collection = await import('@/app/api/plans/[id]/applications/route');
const single = await import('@/app/api/plans/[id]/applications/[applicationId]/route');
const request = (body?: unknown, method = 'POST') => new Request('https://collegefind.test', {
  method,
  headers: { origin: 'https://collegefind.test', host: 'collegefind.test', 'content-type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const json = async (response: Response) => ({ status: response.status, body: await response.json() });
const context = (id: string) => ({ params: Promise.resolve({ id }) });
const detailContext = (id: string, applicationId: string) => ({ params: Promise.resolve({ id, applicationId }) });
const personalApplication = (overrides: Record<string, unknown> = {}) => ({
  institutionName: 'Personal Institution', programName: 'Preferred programme', counsellingDetails: 'Personal counselling note',
  cycle: '2026', status: 'INTERESTED', submittedAt: null, nextAction: null, reference: null, note: null,
  collegeId: null, ...overrides,
});

beforeEach(async () => { await resetDb(); session.current = null; });
afterAll(async () => { await resetDb(); await db.$disconnect(); });

describe('private application tracking', () => {
  it('authenticates, validates input, creates catalogue and personal applications, and restores them to the owner', async () => {
    expect((await json(await collection.GET(request(undefined, 'GET'), context('missing')))).status).toBe(401);
    const owner = await db.user.create({ data: { name: 'Application owner', email: 'application-owner@example.test', password: 'unused' } });
    const other = await db.user.create({ data: { name: 'Other user', email: 'application-other@example.test', password: 'unused' } });
    const college = await db.college.create({ data: { slug: 'application-college', name: 'Application College', shortName: 'AC', city: 'Pune', state: 'Maharashtra', type: 'GOVERNMENT' } });
    const plan = await db.admissionPlan.create({ data: { userId: owner.id, name: 'Applications', cycle: '2026' } });
    session.current = { id: owner.id, role: 'USER' };
    const invalidDate = await json(await collection.POST(request(personalApplication({ submittedAt: 'tomorrow' })), context(plan.id)));
    expect(invalidDate.status).toBe(400);
    const invalidStatus = await json(await collection.POST(request(personalApplication({ status: 'MAYBE' })), context(plan.id)));
    expect(invalidStatus.status).toBe(400);
    const missingIdentity = await json(await collection.POST(request(personalApplication({ institutionName: null })), context(plan.id)));
    expect(missingIdentity.status).toBe(400);

    const createdPersonal = await json(await collection.POST(request(personalApplication({ submittedAt: '2026-07-04', status: 'APPLIED', reference: 'REF-PRIVATE-1' })), context(plan.id)));
    expect(createdPersonal.status).toBe(201);
    expect(createdPersonal.body.application.submittedAt).toBe('2026-07-04T00:00:00.000Z');
    expect(createdPersonal.body.application.status).toBe('APPLIED');
    const createdCatalogue = await json(await collection.POST(request(personalApplication({
      collegeId: college.id, institutionName: null, status: 'PREPARING', submittedAt: null,
    })), context(plan.id)));
    expect(createdCatalogue.status).toBe(201);
    expect(createdCatalogue.body.application.college.name).toBe('Application College');
    expect((await json(await collection.GET(request(undefined, 'GET'), context(plan.id)))).body.applications).toHaveLength(2);

    session.current = { id: other.id, role: 'USER' };
    expect((await json(await collection.GET(request(undefined, 'GET'), context(plan.id)))).status).toBe(404);
    expect((await json(await single.PATCH(request({ expectedVersion: 0, ...personalApplication({ status: 'ACCEPTED', collegeId: null }) }), detailContext(plan.id, createdPersonal.body.application.id)))).status).toBe(404);
    expect((await json(await single.DELETE(request({ expectedVersion: 0 }, 'DELETE'), detailContext(plan.id, createdPersonal.body.application.id)))).status).toBe(404);

    session.current = { id: owner.id, role: 'USER' };
    const item = createdPersonal.body.application;
    const edited = await json(await single.PATCH(request({
      expectedVersion: item.version, ...personalApplication({ status: 'OFFERED', nextAction: 'Review offer', note: 'Private update' }),
    }), detailContext(plan.id, item.id)));
    expect(edited.status).toBe(200);
    expect(edited.body.application.version).toBe(item.version + 1);
    expect(edited.body.application.nextAction).toBe('Review offer');
    expect(edited.body.application.note).toBe('Private update');
    const staleDelete = await json(await single.DELETE(request({ expectedVersion: item.version }, 'DELETE'), detailContext(plan.id, item.id)));
    expect(staleDelete.status).toBe(409);
    expect(await db.planApplication.findUnique({ where: { id: item.id } })).not.toBeNull();
    expect((await json(await single.DELETE(request({ expectedVersion: edited.body.application.version }, 'DELETE'), detailContext(plan.id, item.id)))).body.deleted).toBe(true);
  });

  it('accepts exactly the supported application status vocabulary', async () => {
    const user = await db.user.create({ data: { name: 'Statuses', email: 'application-statuses@example.test', password: 'unused' } });
    const plan = await db.admissionPlan.create({ data: { userId: user.id, name: 'Status plan', cycle: '2026' } });
    session.current = { id: user.id, role: 'USER' };
    const statuses = ['INTERESTED', 'PREPARING', 'APPLIED', 'AWAITING_RESULT', 'OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'];
    for (const [index, status] of statuses.entries()) {
      const result = await json(await collection.POST(request(personalApplication({ institutionName: `Status Institution ${index}`, status })), context(plan.id)));
      expect(result.status).toBe(201);
      expect(result.body.application.status).toBe(status);
    }
    const stored = await db.planApplication.findMany({ where: { planId: plan.id }, select: { status: true }, orderBy: { status: 'asc' } });
    expect(stored.map((application) => application.status).sort()).toEqual([...statuses].sort());
  });

  it('rejects a stale concurrent application edit rather than losing an update', async () => {
    const user = await db.user.create({ data: { name: 'Concurrent owner', email: 'application-concurrent@example.test', password: 'unused' } });
    const plan = await db.admissionPlan.create({ data: { userId: user.id, name: 'Concurrent applications', cycle: '2026' } });
    const application = await db.planApplication.create({ data: { planId: plan.id, institutionName: 'Personal College', cycle: '2026' } });
    session.current = { id: user.id, role: 'USER' };
    const ctx = detailContext(plan.id, application.id);
    const makeUpdate = (status: string, note: string) => request({ expectedVersion: 0, ...personalApplication({ status, note }) }, 'PATCH');
    const results = await Promise.all([
      single.PATCH(makeUpdate('APPLIED', 'first session'), ctx),
      single.PATCH(makeUpdate('PREPARING', 'second session'), ctx),
    ]);
    expect(results.map((response) => response.status).sort()).toEqual([200, 409]);
    const stored = await db.planApplication.findUniqueOrThrow({ where: { id: application.id } });
    expect(stored.version).toBe(1);
    expect(['APPLIED', 'PREPARING']).toContain(stored.status);
    expect(['first session', 'second session']).toContain(stored.note);
  });
});

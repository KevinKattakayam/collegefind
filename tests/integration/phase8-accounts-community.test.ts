import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb, testDb } from './db';

const db = testDb();
const session = vi.hoisted(() => ({ current: null as null | { id: string; role: 'USER' | 'ADMIN'; } }));
vi.mock('@/lib/prisma', async () => { const { testDb } = await import('./db'); return { prisma: testDb() }; });
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current ? { user: session.current } : null) }));
const account = await import('@/app/api/account/route');
const exportAccount = await import('@/app/api/account/export/route');
const questions = await import('@/app/api/questions/route');
const questionList = await import('@/app/api/questions/[collegeId]/route');
const questionItem = await import('@/app/api/questions/[collegeId]/[questionId]/route');
const answers = await import('@/app/api/answers/route');
const answerItem = await import('@/app/api/answers/[questionId]/[answerId]/route');
const reports = await import('@/app/api/community/reports/route');
const moderation = await import('@/app/api/admin/moderation/route');
const evidenceReview = await import('@/app/api/admin/evidence/route');

const req = (body?: unknown, method = 'POST') => new Request('https://collegefind.test', {
  method,
  headers: { origin: 'https://collegefind.test', host: 'collegefind.test', 'content-type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const json = async (response: Response) => ({ status: response.status, body: await response.json() });
const collegeContext = (collegeId: string) => ({ params: Promise.resolve({ collegeId }) });
const questionContext = (collegeId: string, questionId: string) => ({ params: Promise.resolve({ collegeId, questionId }) });
const answerContext = (questionId: string, answerId: string) => ({ params: Promise.resolve({ questionId, answerId }) });

beforeEach(async () => { await resetDb(); session.current = null; });
afterAll(async () => { await resetDb(); await db.$disconnect(); });

async function fixtures() {
  const owner = await db.user.create({ data: { name: 'Owner', email: 'phase8-owner@example.test', password: 'unused' } });
  const other = await db.user.create({ data: { name: 'Other', email: 'phase8-other@example.test', password: 'unused' } });
  const admin = await db.user.create({ data: { name: 'Admin', email: 'phase8-admin@example.test', password: 'unused', role: 'ADMIN' } });
  const college = await db.college.create({ data: { slug: 'phase8-community-college', name: 'Phase 8 College', shortName: 'P8C', city: 'Pune', state: 'Maharashtra', type: 'GOVERNMENT' } });
  return { owner, other, admin, college };
}

describe('Phase 8 account and community privacy', () => {
  it('updates only safe account fields, exports owned data without credentials, and deactivates with private-data cleanup', async () => {
    const { owner, other, college } = await fixtures();
    const plan = await db.admissionPlan.create({ data: { userId: owner.id, name: 'Private plan', cycle: '2027' } });
    session.current = { id: owner.id, role: 'USER' };
    expect((await json(await account.PATCH(req({ name: 'Updated Owner', timeZone: 'Asia/Kolkata' }, 'PATCH')))).status).toBe(200);
    expect((await json(await account.PATCH(req({ name: 'name', email: other.email, role: 'ADMIN' }, 'PATCH')))).status).toBe(400);
    expect((await json(await account.PATCH(req({ name: 'Updated Owner', timeZone: 'Mars/Somewhere' }, 'PATCH')))).status).toBe(400);
    const createdQuestion = await json(await questions.POST(req({ collegeId: college.id, text: 'How does the admissions process work?' })));
    expect(createdQuestion.status).toBe(201);
    const exported = await exportAccount.GET();
    const exportedPayload = JSON.parse(await exported.text());
    expect(exported.headers.get('cache-control')).toContain('no-store');
    expect(exportedPayload.admissionPlans).toHaveLength(1);
    expect(exportedPayload.questions).toHaveLength(1);
    expect(JSON.stringify(exportedPayload)).not.toContain('password');
    expect(JSON.stringify(exportedPayload)).not.toContain('session');
    session.current = { id: other.id, role: 'USER' };
    const otherExport = JSON.parse(await (await exportAccount.GET()).text());
    expect(otherExport.admissionPlans).toHaveLength(0);
    expect(otherExport.questions).toHaveLength(0);
    session.current = { id: owner.id, role: 'USER' };
    expect((await json(await account.DELETE(req({ confirmation: 'NO' }, 'DELETE')))).status).toBe(400);
    expect((await json(await account.DELETE(req({ confirmation: 'DELETE' }, 'DELETE')))).status).toBe(200);
    expect(await db.user.findUniqueOrThrow({ where: { id: owner.id }, select: { deactivatedAt: true, role: true, email: true, password: true } })).toMatchObject({ role: 'USER', email: `deleted+${owner.id}@account.invalid`, password: '' });
    expect(await db.admissionPlan.count({ where: { id: plan.id } })).toBe(0);
    expect(await db.question.findFirstOrThrow({ where: { userId: owner.id } })).toMatchObject({ status: 'HIDDEN', text: '[Removed after account deactivation]' });
    expect((await json(await account.GET())).status).toBe(401);
  });

  it('supports author edits/removals and rejects duplicates and cross-owner changes', async () => {
    const { owner, other, college } = await fixtures();
    session.current = { id: owner.id, role: 'USER' };
    const created = await json(await questions.POST(req({ collegeId: college.id, text: 'What programmes are offered?' })));
    const questionId = created.body.question.id as string;
    expect((await json(await questions.POST(req({ collegeId: college.id, text: ' What programmes are offered? ' })))).status).toBe(409);
    const listed = await json(await questionList.GET(new Request(`https://collegefind.test/api/questions/${college.id}?page=1`), collegeContext(college.id)));
    expect(listed.status).toBe(200);
    session.current = { id: other.id, role: 'USER' };
    expect((await json(await questionItem.PATCH(req({ collegeId: college.id, text: 'Changed by other' }, 'PATCH'), questionContext(college.id, questionId)))).status).toBe(404);
    expect((await json(await questionItem.DELETE(req(undefined, 'DELETE'), questionContext(college.id, questionId)))).status).toBe(404);
    session.current = { id: owner.id, role: 'USER' };
    expect((await json(await questionItem.PATCH(req({ collegeId: college.id, text: 'Updated by author' }, 'PATCH'), questionContext(college.id, questionId)))).body.question.text).toBe('Updated by author');
    const answer = await json(await answers.POST(req({ questionId, text: 'Check the official admissions notice.' })));
    expect(answer.status).toBe(201);
    expect((await json(await answerItem.PATCH(req({ questionId, text: 'Updated answer.' }, 'PATCH'), answerContext(questionId, answer.body.answer.id)))).status).toBe(200);
    session.current = { id: other.id, role: 'USER' };
    expect((await json(await answerItem.DELETE(req(undefined, 'DELETE'), answerContext(questionId, answer.body.answer.id)))).status).toBe(404);
  });

  it('makes report submissions idempotent and protects moderation queue and audit actions', async () => {
    const { owner, other, admin, college } = await fixtures();
    const question = await db.question.create({ data: { userId: owner.id, collegeId: college.id, text: 'Unsafe claim?', status: 'VISIBLE' } });
    session.current = { id: owner.id, role: 'USER' };
    const reportResponses = await Promise.all([
      reports.POST(req({ questionId: question.id, reason: 'MISLEADING' })),
      reports.POST(req({ questionId: question.id, reason: 'SPAM' })),
    ]);
    expect(reportResponses.map(response => response.status)).toEqual([201, 201]);
    expect(await db.communityReport.count({ where: { questionId: question.id } })).toBe(1);
    expect((await json(await moderation.GET(new Request('https://collegefind.test/api/admin/moderation')))).status).toBe(403);
    expect((await json(await moderation.POST(req({ type: 'question', id: question.id, status: 'HIDDEN', expectedStatus: 'VISIBLE', reason: 'moderated' })))).status).toBe(403);
    session.current = { id: other.id, role: 'USER' };
    expect((await json(await moderation.GET(new Request('https://collegefind.test/api/admin/moderation')))).status).toBe(403);
    session.current = { id: admin.id, role: 'ADMIN' };
    const queue = await json(await moderation.GET(new Request('https://collegefind.test/api/admin/moderation?status=OPEN&page=1&limit=10')));
    expect(queue.status).toBe(200);
    expect(queue.body).not.toHaveProperty('reporter');
    expect(queue.body.reports).toHaveLength(1);
    expect(queue.body.reports[0]).not.toHaveProperty('reporterId');
    const reportId = queue.body.reports[0].id as string;
    expect((await json(await moderation.POST(req({ type: 'question', id: question.id, status: 'HIDDEN', expectedStatus: 'VISIBLE', reason: 'Reviewed by admin', reportId })))).status).toBe(200);
    expect(await db.question.findUniqueOrThrow({ where: { id: question.id }, select: { status: true } })).toEqual({ status: 'HIDDEN' });
    expect(await db.communityReport.findUniqueOrThrow({ where: { id: reportId }, select: { status: true, resolvedById: true } })).toEqual({ status: 'RESOLVED', resolvedById: admin.id });
    expect(await db.auditLog.count({ where: { targetId: { in: [question.id, reportId] } } })).toBeGreaterThanOrEqual(2);
    expect((await json(await moderation.POST(req({ reportId, reportStatus: 'DISMISSED', reason: 'Repeated action' })))).status).toBe(409);
    expect((await json(await moderation.POST(req({ type: 'question', id: question.id, status: 'VISIBLE', expectedStatus: 'VISIBLE', reason: 'Stale restore' })))).status).toBe(409);

    const concurrentQuestion = await db.question.create({ data: { userId: owner.id, collegeId: college.id, text: 'Concurrent moderation target?', status: 'VISIBLE' } });
    const actions = await Promise.all([
      moderation.POST(req({ type: 'question', id: concurrentQuestion.id, status: 'HIDDEN', expectedStatus: 'VISIBLE', reason: 'Concurrent action one' })),
      moderation.POST(req({ type: 'question', id: concurrentQuestion.id, status: 'HIDDEN', expectedStatus: 'VISIBLE', reason: 'Concurrent action two' })),
    ]);
    expect(actions.map(response => response.status).sort()).toEqual([200, 409]);
    expect(await db.auditLog.count({ where: { targetId: concurrentQuestion.id, action: 'question.hide' } })).toBe(1);
  });

  it('does not allow concurrent account deactivation to remove the last active admin', async () => {
    const { admin } = await fixtures();
    const secondAdmin = await db.user.create({ data: { name: 'Second admin', email: 'phase8-admin-2@example.test', password: 'unused', role: 'ADMIN' } });
    const deactivate = async (id: string) => { session.current = { id, role: 'ADMIN' }; return json(await account.DELETE(req({ confirmation: 'DELETE' }, 'DELETE'))); };
    const results = await Promise.all([deactivate(admin.id), deactivate(secondAdmin.id)]);
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    expect(await db.user.count({ where: { role: 'ADMIN', deactivatedAt: null } })).toBe(1);
  });

  it('rejects stale reviewer decisions and records one append-only decision and audit event', async () => {
    const { admin, college } = await fixtures();
    const source = await db.source.create({ data: { name: 'Phase 8 test source', publisher: 'Synthetic integration test', url: 'https://example.test/source', retrievedAt: new Date() } });
    const claim = await db.fieldEvidence.create({ data: { collegeId: college.id, sourceId: source.id, field: 'description', value: 'Fixture claim for route test', identityKey: `phase8-${college.id}` } });
    session.current = { id: admin.id, role: 'ADMIN' };
    const body = { kind: 'field', id: claim.id, status: 'REJECTED', reason: 'Synthetic test decision', expectedDecisionId: null };
    expect((await json(await evidenceReview.POST(req(body)))).status).toBe(200);
    const stale = await json(await evidenceReview.POST(req(body)));
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('REVIEW_CHANGED');
    expect(await db.evidenceDecision.count({ where: { evidenceId: claim.id } })).toBe(1);
    expect(await db.auditLog.count({ where: { targetId: claim.id, action: 'evidence.review' } })).toBe(1);
  });
});

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb, testDb } from './db';

const db = testDb();
const session = vi.hoisted(() => ({ current: null as null | { id: string; role: 'USER' | 'ADMIN' } }));
vi.mock('@/lib/prisma', async () => { const { testDb } = await import('./db'); return { prisma: testDb() }; });
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current ? { user: session.current } : null) }));
const collection = await import('@/app/api/plans/[id]/choices/route');
const single = await import('@/app/api/plans/[id]/choices/[choiceId]/route');
const request = (url: string, body: unknown, method = 'POST') => new Request(`https://collegefind.test${url}`, { method, headers: { origin: 'https://collegefind.test', host: 'collegefind.test', 'content-type': 'application/json' }, body: JSON.stringify(body) });
const json = async (response: Response) => ({ status: response.status, body: await response.json() });
beforeEach(async () => { await resetDb(); session.current = null; });
afterAll(async () => { await resetDb(); await db.$disconnect(); });

describe('private counselling choices', () => {
 it('validates, prevents duplicates, orders transactionally and isolates owners', async () => {
  const a = await db.user.create({ data: { name: 'A', email: 'choice-a@example.test', password: 'unused' } });
  const b = await db.user.create({ data: { name: 'B', email: 'choice-b@example.test', password: 'unused' } });
  const ca = await db.college.create({ data: { slug: 'choice-a', name: 'College A', shortName: 'A', city: 'X', state: 'Y', type: 'GOVERNMENT' } });
  const cb = await db.college.create({ data: { slug: 'choice-b', name: 'College B', shortName: 'B', city: 'X', state: 'Y', type: 'GOVERNMENT' } });
  const plan = await db.admissionPlan.create({ data: { userId: a.id, name: 'My plan', cycle: '2026' } });
  session.current = { id: a.id, role: 'USER' };
  const ctx = { params: Promise.resolve({ id: plan.id }) };
  expect((await json(await collection.POST(request(`/api/plans/${plan.id}/choices`, { label: 'No college', programId: 'bad' }), ctx))).status).toBe(400);
  expect((await json(await collection.POST(request('', { collegeId: 'missing-college', label: 'No such college' }), ctx))).status).toBe(404);
  const first = await json(await collection.POST(request('', { collegeId: ca.id, label: 'Computer science', note: 'My preference' }), ctx));
  const duplicate = await json(await collection.POST(request('', { collegeId: ca.id, label: 'computer science' }), ctx));
  expect(first.status).toBe(201);
  expect(duplicate.status).toBe(409);
  const second = await json(await collection.POST(request('', { collegeId: cb.id, label: 'Civil engineering' }), ctx));
  const ids = [second.body.choice.id, first.body.choice.id];
  expect((await json(await collection.PATCH(request('', { ids }, 'PATCH'), ctx))).body.order).toEqual(ids);
  expect((await db.planChoice.findMany({ where: { planId: plan.id }, orderBy: { position: 'asc' } })).map((choice) => choice.id)).toEqual(ids);
  expect((await json(await collection.PATCH(request('', { ids: [ids[0], ids[0]] }, 'PATCH'), ctx))).status).toBe(400);
  session.current = { id: b.id, role: 'USER' };
  expect((await json(await collection.PATCH(request('', { ids }, 'PATCH'), ctx))).status).toBe(404);
  const firstContext = { params: Promise.resolve({ id: plan.id, choiceId: first.body.choice.id }) };
  expect((await json(await single.DELETE(request('', {}, 'DELETE'), firstContext))).status).toBe(404);
  expect((await json(await single.PATCH(request('', { label: 'Takeover', collegeId: ca.id }, 'PATCH'), firstContext))).status).toBe(404);
  session.current = { id: a.id, role: 'USER' };
  expect((await json(await single.PATCH(request('', { label: 'Civil engineering', collegeId: ca.id }, 'PATCH'), firstContext))).status).toBe(409);
  const edited = await json(await single.PATCH(request('', { label: 'Renamed choice', collegeId: ca.id, note: 'Edited note' }, 'PATCH'), firstContext));
  expect(edited.body.choice.label).toBe('Renamed choice');
  expect(edited.body.choice.note).toBe('Edited note');
  expect((await json(await single.DELETE(request('', {}, 'DELETE'), firstContext))).body.deleted).toBe(true);
 });

 it('serializes concurrent appends without duplicate positions', async () => {
  const user = await db.user.create({ data: { name: 'C', email: 'choice-c@example.test', password: 'unused' } });
  const plan = await db.admissionPlan.create({ data: { userId: user.id, name: 'Concurrent', cycle: '2026' } });
  session.current = { id: user.id, role: 'USER' };
  const ctx = { params: Promise.resolve({ id: plan.id }) };
  const results = await Promise.all(['One', 'Two'].map((label) => collection.POST(request('', { label }), ctx)));
  expect(results.map((response) => response.status).sort()).toEqual([201, 201]);
  expect(await db.planChoice.count({ where: { planId: plan.id } })).toBe(2);
  expect(new Set((await db.planChoice.findMany({ where: { planId: plan.id } })).map((choice) => choice.position)).size).toBe(2);
 });
});

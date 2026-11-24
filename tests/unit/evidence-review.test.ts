import { expect, it, vi } from 'vitest';
import { reviewFieldEvidence } from '@/server/ingest/field-evidence';
it('denies a demoted reviewer before recording a decision or audit', async () => {
 const tx = {$executeRaw:vi.fn(),user:{findUniqueOrThrow:vi.fn().mockResolvedValue({role:'USER'})},evidenceDecision:{create:vi.fn()},auditLog:{create:vi.fn()}};
 const db = {$transaction:async (fn:(t:typeof tx)=>unknown)=>fn(tx)};
 await expect(reviewFieldEvidence(db as never,{evidenceId:'e',reviewerId:'u',status:'APPROVED',reason:'Checked'})).rejects.toThrow(/Reviewer access/);
 expect(tx.evidenceDecision.create).not.toHaveBeenCalled();
 expect(tx.auditLog.create).not.toHaveBeenCalled();
});
it('records an authorized reviewer decision and audit inside one transaction', async () => {
 const tx = {$executeRaw:vi.fn(),fieldEvidence:{findUniqueOrThrow:vi.fn().mockResolvedValue({isFixture:false})},user:{findUniqueOrThrow:vi.fn().mockResolvedValue({id:'admin',role:'ADMIN'})},evidenceDecision:{create:vi.fn().mockResolvedValue({id:'decision'})},auditLog:{create:vi.fn()}};
 const db = {$transaction:vi.fn(async (fn:(t:typeof tx)=>unknown)=>fn(tx))};
 await reviewFieldEvidence(db as never,{evidenceId:'e',reviewerId:'admin',status:'REJECTED',reason:'Conflicting source'});
 expect(db.$transaction).toHaveBeenCalledTimes(1);
 expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({actorId:'admin',action:'evidence.review',targetId:'e'})}));
});

it.each([
 ['expired', { validUntil: new Date('2020-01-01') }, /Expired evidence/],
 ['not yet valid', { validFrom: new Date('2099-01-01') }, /Future-valid evidence/],
 ['fixture', { isFixture: true }, /Fixture evidence/],
 ['IIT Kanpur hold', { id: 'cmwlwwvdr0002zitvryebz8z9', isFixture: false }, /DoAA Manual/],
])('blocks approval of %s claims before creating a decision', async (_label, claim, error) => {
 const tx = {
  $executeRaw: vi.fn(), $queryRaw: vi.fn(),
  user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'admin', role: 'ADMIN' }) },
  fieldEvidence: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'e', isFixture: false, ...claim }) },
  evidenceDecision: { create: vi.fn() }, auditLog: { create: vi.fn() },
 };
 const db = { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) };
 await expect(reviewFieldEvidence(db as never, { evidenceId: 'e', reviewerId: 'admin', status: 'APPROVED', reason: 'Check claim' })).rejects.toThrow(error);
 expect(tx.evidenceDecision.create).not.toHaveBeenCalled();
 expect(tx.auditLog.create).not.toHaveBeenCalled();
});

it('blocks approval while conflicting same-scope evidence is unresolved', async () => {
 const tx = {
  $executeRaw: vi.fn(), $queryRaw: vi.fn().mockResolvedValue([{ id: 'peer' }]),
  user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'admin', role: 'ADMIN' }) },
  fieldEvidence: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'e', isFixture: false, collegeId: 'college', field: 'description', value: 'new' }) },
  evidenceDecision: { create: vi.fn() }, auditLog: { create: vi.fn() },
 };
 const db = { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) };
 await expect(reviewFieldEvidence(db as never, { evidenceId: 'e', reviewerId: 'admin', status: 'APPROVED', reason: 'Check claim' })).rejects.toThrow(/Conflicting evidence remains unresolved/);
 expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
 expect(tx.evidenceDecision.create).not.toHaveBeenCalled();
});

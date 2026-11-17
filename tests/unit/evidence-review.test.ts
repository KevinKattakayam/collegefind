import { expect, it, vi } from 'vitest';
import { reviewFieldEvidence } from '@/server/ingest/field-evidence';
it('denies a demoted reviewer before recording a decision or audit', async () => {
 const tx = {user:{findUniqueOrThrow:vi.fn().mockResolvedValue({role:'USER'})},evidenceDecision:{create:vi.fn()},auditLog:{create:vi.fn()}};
 const db = {$transaction:async (fn:(t:typeof tx)=>unknown)=>fn(tx)};
 await expect(reviewFieldEvidence(db as never,{evidenceId:'e',reviewerId:'u',status:'APPROVED',reason:'Checked'})).rejects.toThrow(/Reviewer access/);
 expect(tx.evidenceDecision.create).not.toHaveBeenCalled();
 expect(tx.auditLog.create).not.toHaveBeenCalled();
});
it('records an authorized reviewer decision and audit inside one transaction', async () => {
 const tx = {user:{findUniqueOrThrow:vi.fn().mockResolvedValue({id:'admin',role:'ADMIN'})},evidenceDecision:{create:vi.fn().mockResolvedValue({id:'decision'})},auditLog:{create:vi.fn()}};
 const db = {$transaction:vi.fn(async (fn:(t:typeof tx)=>unknown)=>fn(tx))};
 await reviewFieldEvidence(db as never,{evidenceId:'e',reviewerId:'admin',status:'REJECTED',reason:'Conflicting source'});
 expect(db.$transaction).toHaveBeenCalledTimes(1);
 expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({actorId:'admin',action:'evidence.review',targetId:'e'})}));
});

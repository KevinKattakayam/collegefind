import { describe, expect, it, vi } from 'vitest';
import { reviewTypedRecord, stageFieldEvidence } from '@/server/ingest/field-evidence';

const retrievedAt = new Date('2026-01-10T00:00:00.000Z');
const source = { id: 'source-1', url: 'https://official.example.edu/report', publisher: 'Official Institution', retrievedAt };
const draft = {
  field: 'description', value: 'Published description', publisher: source.publisher,
  sourceUrl: source.url, retrievedAt: retrievedAt.toISOString(), reviewState: 'UNREVIEWED' as const,
};

describe('field evidence staging and typed reviewer audit', () => {
  it('rejects unsupported fields, reviewed import claims, and reversed validity without touching persistence', async () => {
    const db = { source: { findUniqueOrThrow: vi.fn() }, fieldEvidence: { upsert: vi.fn() } };
    await expect(stageFieldEvidence(db as never, { collegeId: 'college-1', sourceId: source.id, draft: { ...draft, field: 'rating' } })).rejects.toThrow(/Invalid unreviewed/);
    await expect(stageFieldEvidence(db as never, { collegeId: 'college-1', sourceId: source.id, draft: { ...draft, reviewState: 'APPROVED' as never } })).rejects.toThrow(/Invalid unreviewed/);
    await expect(stageFieldEvidence(db as never, { collegeId: 'college-1', sourceId: source.id, draft, validFrom: new Date('2027-01-01'), validUntil: new Date('2026-01-01') })).rejects.toThrow(/Invalid validity period/);
    expect(db.source.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(db.fieldEvidence.upsert).not.toHaveBeenCalled();
  });

  it('rejects an exact-URL/publisher/retrieval mismatch and a cross-field supersession', async () => {
    const db = {
      source: { findUniqueOrThrow: vi.fn().mockResolvedValue(source) },
      fieldEvidence: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ collegeId: 'college-1', field: 'about' }),
        upsert: vi.fn(),
      },
    };
    await expect(stageFieldEvidence(db as never, { collegeId: 'college-1', sourceId: source.id, draft: { ...draft, sourceUrl: 'https://other.example.edu' } })).rejects.toThrow(/Source metadata mismatch/);
    await expect(stageFieldEvidence(db as never, { collegeId: 'college-1', sourceId: source.id, draft, supersedesId: 'old-claim' })).rejects.toThrow(/Supersession scope mismatch/);
    expect(db.fieldEvidence.upsert).not.toHaveBeenCalled();
  });

  it('stages a valid claim idempotently using the content identity key', async () => {
    const db = {
      source: { findUniqueOrThrow: vi.fn().mockResolvedValue(source) },
      fieldEvidence: { upsert: vi.fn().mockResolvedValue({ id: 'claim-1' }) },
    };
    await expect(stageFieldEvidence(db as never, { collegeId: 'college-1', sourceId: source.id, draft })).resolves.toEqual({ id: 'claim-1' });
    const upsert = db.fieldEvidence.upsert.mock.calls[0][0];
    expect(upsert.where.identityKey).toMatch(/^[a-f0-9]{64}$/);
    expect(upsert.create).toMatchObject({ collegeId: 'college-1', sourceId: source.id, field: 'description', value: 'Published description' });
    expect(upsert.update).toEqual({});
  });

  it('links typed review decisions to the existing record and audit in one transaction', async () => {
    const tx = {
      $queryRaw: vi.fn(async () => [{ locked: true }]),
      user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'admin-1', role: 'ADMIN' }) },
      evidenceDecision: { create: vi.fn().mockResolvedValue({ id: 'decision-1' }) },
      auditLog: { create: vi.fn() },
    };
    const db = { $transaction: vi.fn(async (work: (client: typeof tx) => unknown) => work(tx)) };
    await reviewTypedRecord(db as never, { kind: 'fees', recordId: 'fee-1', reviewerId: 'admin-1', status: 'APPROVED', reason: 'Official fee schedule' });
    expect(tx.evidenceDecision.create).toHaveBeenCalledWith({
      data: {
        feesId: 'fee-1', reviewerId: 'admin-1', status: 'APPROVED', reason: 'Official fee schedule',
      }
    });
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'admin-1', action: 'record.review', targetType: 'fees', targetId: 'fee-1',
      })
    });
  });

  it('rejects stale typed evidence review decisions before writing an audit record', async () => {
    const tx = {
      $queryRaw: vi.fn(async () => [{ locked: true }]),
      user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'admin-1', role: 'ADMIN' }) },
      evidenceDecision: { findFirst: vi.fn().mockResolvedValue({ id: 'newer-decision' }), create: vi.fn() },
      auditLog: { create: vi.fn() },
    };
    const db = { $transaction: vi.fn(async (work: (client: typeof tx) => unknown) => work(tx)) };
    await expect(reviewTypedRecord(db as never, { kind: 'fees', recordId: 'fee-1', reviewerId: 'admin-1', status: 'APPROVED', reason: 'Current schedule', expectedDecisionId: null }))
      .rejects.toMatchObject({ status: 409, code: 'REVIEW_CHANGED' });
    expect(tx.evidenceDecision.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});

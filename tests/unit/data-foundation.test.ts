import { describe, expect, it } from 'vitest';
import { checksum, sourceIdentity } from '@/server/ingest/identity';
import { hideDemoMetrics } from '@/lib/data-visibility';

describe('data foundation', () => {
  it('reconciles identical source artifacts and differentiates changed contents', () => {
    const source = { url: 'https://example.edu/report', publisher: 'Institution' };
    expect(sourceIdentity(source, checksum('a'))).toBe(sourceIdentity(source, checksum('a')));
    expect(sourceIdentity(source, checksum('a'))).not.toBe(sourceIdentity(source, checksum('b')));
    expect(() => sourceIdentity({ ...source, url: 'https://user:secret@example.edu' }, 'a')).toThrow();
  });
  it('masks nested demo values while preserving stored inputs and verified numbers', () => {
    const demo = { id: 'keep', slug: 'keep', dataStatus: 'DEMO', annualFees: 50, naacGrade: 'A', topRecruiters: ['demo'] };
    const result = hideDemoMetrics({ saved: [{ college: demo }], verified: { dataStatus: 'VERIFIED', annualFees: 50 } });
    expect(result.saved[0].college).toMatchObject({ id: 'keep', slug: 'keep', annualFees: null, naacGrade: null, topRecruiters: [] });
    expect(result.verified.annualFees).toBe(50);
    expect(demo.annualFees).toBe(50);
  });
});

// Real DB behavior is separately covered by the disposable-only integration suite.
describe('durable import retry contract', () => {
  it('returns a published summary without replaying writes on a repeated import', async () => {
    const { importJosaaRows } = await import('@/server/ingest/josaa');
    const { vi } = await import('vitest');
    const summary = { upserted: 3, unmatchedInstitutes: [], colleges: 1, programs: 1 };
    const tx = { importRun: { update: vi.fn().mockResolvedValue({ status: 'PUBLISHED', summary }) } };
    const db = {
      source: { upsert: vi.fn().mockResolvedValue({ id: 'source' }) },
      importRun: { upsert: vi.fn().mockResolvedValue({ id: 'run' }) },
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const result = await importJosaaRows(db as never, [], {
      year: 2025, round: 6, institutes: new Map(),
      source: { name: 'Fixture', publisher: 'Fixture', url: 'https://example.edu/cutoffs', retrievedAt: new Date('2026-01-01') },
    });
    expect(result).toEqual(summary);
    expect(tx.importRun.update).toHaveBeenCalledTimes(1);
  });
});

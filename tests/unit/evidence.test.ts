import { describe, expect, it } from 'vitest';
import { canTransitionImportRun, evidenceIdentity, validateEvidenceDraft, type EvidenceDraft } from '@/server/ingest/evidence';

const valid: EvidenceDraft = {
  field: 'annualFees', value: '120000', unit: 'INR/year', publisher: 'Official institution',
  sourceUrl: 'https://example.edu/fees.pdf', publishedAt: '2026-04-01', academicYear: 2026,
  retrievedAt: '2026-11-01T00:00:00.000Z', reviewState: 'UNREVIEWED',
};

describe('staged evidence validation', () => {
  it('accepts a source-backed unreviewed claim without treating it as verified', () => {
    expect(validateEvidenceDraft(valid, new Date('2026-11-17'))).toEqual([]);
    expect(valid.reviewState).toBe('UNREVIEWED');
  });
  it('rejects insecure/malformed sources and impossible dates', () => {
    expect(validateEvidenceDraft({ ...valid, sourceUrl: 'http://example.edu', academicYear: 2200, retrievedAt: 'invalid' }, new Date('2026-11-17'))).toEqual(expect.arrayContaining(['sourceUrl', 'academicYear', 'retrievedAt']));
  });
  it('uses stable source and value identity for repeat-import reconciliation', () => {
    expect(evidenceIdentity(valid)).toBe(evidenceIdentity({ ...valid, value: '120000' }));
    expect(evidenceIdentity(valid)).not.toBe(evidenceIdentity({ ...valid, value: '120001' }));
  });
  it('allows only explicit import-run state transitions', () => {
    const allowed = {
      STAGED: ['VALIDATED', 'FAILED'],
      VALIDATED: ['PUBLISHED', 'PARTIAL', 'FAILED'],
      PUBLISHED: [],
      PARTIAL: ['VALIDATED', 'FAILED'],
      FAILED: ['STAGED'],
    } as const;
    for (const from of Object.keys(allowed) as (keyof typeof allowed)[]) {
      for (const to of Object.keys(allowed) as (keyof typeof allowed)[]) {
        expect(canTransitionImportRun(from, to)).toBe((allowed[from] as readonly string[]).includes(to));
      }
    }
  });

  it('rejects invalid optional dates and reversed validity windows', () => {
    const errors = validateEvidenceDraft({
      ...valid, publishedAt: 'not-a-date', validFrom: 'not-a-date', validUntil: 'also-not-a-date',
    }, new Date('2026-11-17'));
    expect(errors).toEqual(expect.arrayContaining(['publishedAt', 'validFrom', 'validUntil']));
    expect(validateEvidenceDraft({ ...valid, validFrom: '2026-12-01', validUntil: '2026-11-30' }, new Date('2026-11-17')))
      .toContain('validityPeriod');
  });

  it('keeps future-valid and not-yet-approved evidence unavailable', async () => {
    const { resolveReviewedField } = await import('@/server/ingest/evidence');
    const now = new Date('2026-11-17T00:00:00.000Z');
    const approved = [{ status: 'APPROVED', createdAt: new Date('2026-01-01') }];
    expect(resolveReviewedField([{ id: 'future', value: 'New', decisions: approved, validFrom: new Date('2026-12-01') }], now))
      .toEqual({ status: 'UNKNOWN', value: null });
    expect(resolveReviewedField([{ id: 'staged', value: 'Pending', decisions: [{ status: 'UNREVIEWED', createdAt: now }] }], now))
      .toEqual({ status: 'UNKNOWN', value: null });
  });

  it('withholds an approval tied with rejection or superseded by a later rejection', async () => {
    const { resolveReviewedField } = await import('@/server/ingest/evidence');
    const tied = new Date('2026-01-01');
    expect(resolveReviewedField([{ id: 'tie', value: 'Ambiguous', decisions: [
      { status: 'APPROVED', createdAt: tied }, { status: 'REJECTED', createdAt: tied },
    ] }])).toEqual({ status: 'UNKNOWN', value: null });
    expect(resolveReviewedField([{ id: 'rejected', value: 'Old approval', decisions: [
      { status: 'APPROVED', createdAt: new Date('2026-01-01') },
      { status: 'REJECTED', createdAt: new Date('2026-02-01') },
    ] }])).toEqual({ status: 'UNKNOWN', value: null });
  });
});

it('withholds conflicting or expired approved claims and preserves unknown values', async () => {
  const { resolveReviewedField } = await import('@/server/ingest/evidence');
  const decisions = [{ status: 'APPROVED', createdAt: new Date('2026-01-01') }];
  expect(resolveReviewedField([])).toEqual({ status: 'UNKNOWN', value: null });
  expect(resolveReviewedField([{ id: 'a', value: 'one', decisions }, { id: 'b', value: 'two', decisions }]).status).toBe('CONFLICT');
  expect(resolveReviewedField([{ id: 'a', value: 'one', decisions, validUntil: new Date('2020-01-01') }]).status).toBe('UNKNOWN');
  expect(resolveReviewedField([{ id: 'a', value: 'one', decisions }, { id: 'b', value: 'two', decisions, supersedesId: 'a' }]).value).toBe('two');
});

it('does not resurrect superseded values when their replacement expires', async () => {
 const { resolveReviewedField } = await import('@/server/ingest/evidence');
 const decisions = [{status:'APPROVED',createdAt:new Date('2026-01-01')}];
 expect(resolveReviewedField([{id:'a',value:'Old',decisions},{id:'b',value:'New',decisions,supersedesId:'a',validUntil:new Date('2020-01-01')}]).status).toBe('UNKNOWN');
});

it('withdraws a previously approved replacement under a catalogue hold without reviving its predecessor', async () => {
  const { resolveReviewedField } = await import('@/server/ingest/evidence');
  const decisions = [{ status: 'APPROVED', createdAt: new Date('2026-01-01') }];
  expect(resolveReviewedField([
    { id: 'prior-fixture', value: 'Previous value', decisions },
    { id: 'cmwlpjrzh001syttvn05nz1d4', value: 'Held replacement', supersedesId: 'prior-fixture', decisions },
  ])).toEqual({ status: 'UNKNOWN', value: null });
});

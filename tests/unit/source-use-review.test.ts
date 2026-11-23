import { describe, expect, it } from 'vitest';
import { sourceRequiresExplicitUseAssessment, sourceUseReviewSchema } from '@/server/source-use-review';
import { projectPublicCollege } from '@/server/public-evidence';

describe('source-use clearance', () => {
  it('recognizes explicit unresolved reuse warnings without inferring a restriction for every source', () => {
    expect(sourceRequiresExplicitUseAssessment({ license: 'Factual extraction; explicit bulk reuse permission not established', notes: null })).toBe(true);
    expect(sourceRequiresExplicitUseAssessment({ license: 'GODL-India', notes: 'Attribution required' })).toBe(false);
    expect(sourceRequiresExplicitUseAssessment({ license: null, notes: null })).toBe(false);
  });

  it('requires an HTTPS terms or license basis for clearance and a reason for every assessment', () => {
    expect(sourceUseReviewSchema.safeParse({ sourceId: 'source-1', status: 'CLEARED', reason: 'Verified license' }).success).toBe(false);
    expect(sourceUseReviewSchema.safeParse({ sourceId: 'source-1', status: 'CLEARED', reason: 'Terms allow attributed factual summaries', basisUrl: 'https://example.edu/terms' }).success).toBe(true);
    expect(sourceUseReviewSchema.safeParse({ sourceId: 'source-1', status: 'CLEARED', reason: 'Terms allow it', basisUrl: 'http://example.edu/terms' }).success).toBe(false);
  });

  it('keeps claim-specific held facts out of public projection even if an older approval exists', () => {
    const projected = projectPublicCollege({
      slug: 'nit-trichy', dataStatus: 'UNVERIFIED', description: null,
      evidence: [{
        id: 'cmwthl2rj007a7etvt5e1xc96', field: 'description', programScope: 'B.Tech fee summary',
        value: 'A held source-derived claim', academicYear: 2026, publishedAt: null, validFrom: null, validUntil: null,
        supersedesId: null, decisions: [{ status: 'APPROVED', createdAt: new Date('2026-11-23T00:00:00Z') }],
        source: { url: 'https://www.nitt.edu/fees', publisher: 'NIT Tiruchirappalli', retrievedAt: new Date('2026-11-23T00:00:00Z'), license: null, notes: null },
      }], reviews: [], feesRecords: [],
    }, new Date('2026-11-23T00:00:00Z'));
    expect(projected.description).toBeNull();
  });
});

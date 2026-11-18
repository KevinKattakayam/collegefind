import { describe, expect, it } from 'vitest';
import ledger from '../../docs/DATA_COVERAGE.json';
import packet from '../../data/pilot/first-human-review-batch.json';

describe('owner review packet', () => {
  it('matches the coverage ledger and contains no holds or synthetic decisions', () => {
    const canonical = ledger.humanReviewManifest.firstHumanReviewBatch;
    expect(packet).toEqual(canonical);
    expect(packet.claims).toHaveLength(25);
    expect(packet.syntheticApprovalsCountedAsHuman).toBe(false);
    expect(packet.claims.every((claim) => claim.reviewStatus === 'STAGED_UNREVIEWED' && claim.holdReason === null)).toBe(true);
    expect(packet.claims.every((claim) => claim.sourceUrl.startsWith('https://') && claim.evidenceLocation && claim.recommendedQuestion)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import ledger from '../../docs/DATA_COVERAGE.json';
import packet from '../../data/pilot/first-human-review-batch.json';

describe('owner review packet', () => {
  it('matches the coverage ledger and contains no holds or synthetic decisions', () => {
    const canonical = ledger.humanReviewManifest.firstHumanReviewBatch;
    expect(packet).toMatchObject({ ...canonical, claims: expect.any(Array) });
    expect(packet.claims).toHaveLength(25);
    expect(packet.claimIds).toEqual(canonical.claimIds);
    expect(packet.syntheticApprovalsCountedAsHuman).toBe(false);
    expect(packet.claims.every((claim) => claim.reviewStatus === 'STAGED_UNREVIEWED' && claim.holdReason === null)).toBe(true);
    expect(packet.claims.every((claim) => claim.sourceUrl.startsWith('https://') && claim.evidenceLocation && claim.recommendedQuestion)).toBe(true);
    expect(packet.claims.every((claim) => claim.collegeId && claim.collegeCity && claim.collegeState && claim.sourceLicense && claim.sourceNotes && claim.sourceUseWarning && claim.campusReviewQuestion)).toBe(true);
    expect(packet.claims.every((claim) => claim.sourceRetrievedAt && 'sourcePublishedAt' in claim && 'conflictPeerIds' in claim && 'conflictWarning' in claim)).toBe(true);
    expect(packet.sourceSnapshotSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});

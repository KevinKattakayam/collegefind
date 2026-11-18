import { readFileSync, writeFileSync } from 'node:fs';

const ledger = JSON.parse(readFileSync('docs/DATA_COVERAGE.json', 'utf8')) as {
  humanReviewManifest?: { firstHumanReviewBatch?: { claims?: Array<{ evidenceId: string; reviewStatus: string; holdReason: string | null }>; claimIds?: string[] } };
};
const batch = ledger.humanReviewManifest?.firstHumanReviewBatch;
if (!batch || batch.claims?.length !== 25 || batch.claimIds?.length !== 25 ||
    batch.claims.some((claim, index) => claim.evidenceId !== batch.claimIds?.[index] || claim.reviewStatus !== 'STAGED_UNREVIEWED' || claim.holdReason !== null)) {
  throw new Error('Expected exactly 25 individually staged, unheld review claims in the coverage ledger');
}
writeFileSync('data/pilot/first-human-review-batch.json', `${JSON.stringify(batch, null, 2)}\n`);
console.log('Exported 25 staged, unheld claims for owner inspection; no review decisions were created.');

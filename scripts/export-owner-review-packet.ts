import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';

type PacketClaim = {
  order: number; evidenceId: string; institutionSlug: string; institutionName: string; field: string; value: unknown;
  unit: string | null; programScope: string | null; academicYear: number | null; sourcePublisher: string; sourceUrl: string;
  evidenceLocation: string | null; reviewStatus: string; holdReason: string | null;
};
const ledger = JSON.parse(readFileSync('docs/DATA_COVERAGE.json', 'utf8')) as {
  humanReviewManifest?: { firstHumanReviewBatch?: { claims?: PacketClaim[]; claimIds?: string[]; [key: string]: unknown } };
};
const batch = ledger.humanReviewManifest?.firstHumanReviewBatch;
if (!batch || batch.claims?.length !== 25 || batch.claimIds?.length !== 25 ||
    batch.claims.some((claim, index) => claim.evidenceId !== batch.claimIds?.[index] || claim.reviewStatus !== 'STAGED_UNREVIEWED' || claim.holdReason !== null)) {
  throw new Error('Expected exactly 25 individually staged, unheld review claims in the coverage ledger');
}

const snapshotPath = 'data/pilot/staged-evidence-after-batch-027.json';
const snapshotBytes = readFileSync(snapshotPath);
const snapshotHash = createHash('sha256').update(snapshotBytes).digest('hex');
const snapshotManifest = JSON.parse(readFileSync('data/pilot/staged-evidence-after-batch-027-manifest.json', 'utf8')) as { sha256: string };
if (snapshotHash !== snapshotManifest.sha256) throw new Error('Latest staged evidence snapshot checksum does not match its manifest');
const snapshot = JSON.parse(snapshotBytes.toString('utf8')) as {
  collegeIdentity: Array<{ id: string; slug: string }>;
  sources: Array<{ id: string; publisher: string; url: string; license: string | null; notes: string | null; publishedAt: string | null; retrievedAt: string }>;
  claims: Array<{ id: string; collegeId: string; sourceId: string; field: string; value: unknown; programScope: string | null; academicYear: number | null; validFrom: string | null; validUntil: string | null; evidenceLocator: string | null; supersedesId: string | null; isFixture: boolean }>;
};
const identities = new Map(snapshot.collegeIdentity.map((row) => [row.id, row.slug]));
const sources = new Map(snapshot.sources.map((row) => [row.id, row]));
const sourceClaims = new Map(snapshot.claims.map((row) => [row.id, row]));
if (snapshot.collegeIdentity.length !== 205 || identities.size !== 205 || sourceClaims.size !== snapshot.claims.length) {
  throw new Error('Latest snapshot catalogue or claim identities are incomplete');
}
const seed = JSON.parse(readFileSync('src/server/seed/demo-colleges.json', 'utf8')) as Array<{ id?: string; slug: string; city: string; state: string }>;
const seedBySlug = new Map(seed.map((row) => [row.slug, row]));

const enriched = batch.claims.map((item) => {
  const claim = sourceClaims.get(item.evidenceId);
  if (!claim || claim.isFixture || identities.get(claim.collegeId) !== item.institutionSlug || claim.field !== item.field ||
      !isDeepStrictEqual(claim.value, item.value) || claim.academicYear !== item.academicYear || claim.evidenceLocator !== item.evidenceLocation) {
    throw new Error(`Review packet claim ${item.evidenceId} does not reconcile with the archived evidence`);
  }
  const source = sources.get(claim.sourceId);
  if (!source || source.url !== item.sourceUrl || source.publisher !== item.sourcePublisher || !source.url.startsWith('https://')) {
    throw new Error(`Review packet source ${item.evidenceId} does not reconcile with the archived source`);
  }
  const college = seedBySlug.get(item.institutionSlug);
  if (!college) throw new Error(`Review packet institution ${item.institutionSlug} is not in the catalogue seed`);
  const now = new Date().toISOString();
  const conflictPeers = snapshot.claims.filter((peer) => peer.id !== claim.id && !peer.isFixture && peer.collegeId === claim.collegeId &&
    peer.field === claim.field && peer.programScope === claim.programScope && peer.academicYear === claim.academicYear &&
    !isDeepStrictEqual(peer.value, claim.value) && (!peer.validUntil || peer.validUntil >= now) &&
    (!peer.validFrom || peer.validFrom <= now));
  return {
    ...item,
    collegeId: claim.collegeId,
    collegeCity: college.city,
    collegeState: college.state,
    sourcePublishedAt: source.publishedAt,
    sourceRetrievedAt: source.retrievedAt,
    sourceLicense: source.license,
    sourceNotes: source.notes,
    freshnessWarning: source.publishedAt ? null : 'Source publication date is not recorded; verify the source and current applicability before deciding.',
    campusReviewQuestion: 'Confirm the official source applies to this catalogue institution and campus; use the queue’s recorded campus aliases and hold if scope is unclear.',
    conflictPeerIds: conflictPeers.map((peer) => peer.id).sort(),
    conflictWarning: conflictPeers.length ? 'Different evidence with the same institution, field, programme scope and academic year exists; inspect every peer before deciding.' : null,
    sourceUseWarning: source.license ?? 'Source-use conditions are not recorded; do not approve public display until the intended use is resolved.',
  };
});
const packet = { ...batch, claims: enriched, sourceSnapshot: snapshotPath, sourceSnapshotSha256: snapshotHash };
writeFileSync('data/pilot/first-human-review-batch.json', `${JSON.stringify(packet, null, 2)}\n`);
console.log('Exported 25 staged, unheld claims for owner inspection; no review decisions were created.');

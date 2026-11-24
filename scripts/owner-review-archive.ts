import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

export type OwnerReviewRow = Record<string, unknown>;
export type OwnerReviewSnapshot = {
  scope: string;
  collegeIdentity: Array<{ id: string; slug: string }>;
  sources: OwnerReviewRow[];
  claims: OwnerReviewRow[];
  runs: OwnerReviewRow[];
  audits: OwnerReviewRow[];
};
export type OwnerReviewManifest = { sha256: string; counts: Record<string, number>; collegeIdentitySha256: string; collegeSlugsSha256: string };

const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const expectedSeedSha256 = 'a9321b82b6f390790e09a647dfaf589b90c5736819aed6b9a5908922bfcc1637';

/** Validate every archived identity/reference before a database client is made. */
export function validateOwnerReviewArchive(payload: Buffer, manifest: OwnerReviewManifest, snapshot: OwnerReviewSnapshot, seedPayload: Buffer) {
  if (sha256(payload) !== manifest.sha256 || snapshot.scope !== 'COLLEGEFIND_DISPOSABLE_STAGED_EVIDENCE_V1') throw new Error('Snapshot checksum or supported format check failed.');
  if (sha256(seedPayload) !== expectedSeedSha256) throw new Error('Original catalogue seed checksum changed; refusing restore.');
  const seed = JSON.parse(seedPayload.toString('utf8')) as Array<OwnerReviewRow & { slug: string }>;
  const identity = snapshot.collegeIdentity;
  const identityIds = new Set(identity.map((row) => row.id));
  const identitySlugs = new Set(identity.map((row) => row.slug));
  const seedSlugs = new Set(seed.map((row) => row.slug));
  if (identity.length !== 205 || identityIds.size !== 205 || identitySlugs.size !== 205 || seed.length !== 205 || seedSlugs.size !== 205 ||
      manifest.counts.decisions !== 0 || manifest.counts.users !== 0 || manifest.counts.fixtures !== 0 ||
      sha256(JSON.stringify(identity)) !== manifest.collegeIdentitySha256 ||
      sha256(identity.map((row) => row.slug).join('\n')) !== manifest.collegeSlugsSha256 ||
      identity.some((row) => !seedSlugs.has(row.slug))) throw new Error('Stable 205-college identity mapping is invalid.');
  const ids = (rows: OwnerReviewRow[], key: string) => {
    const values = rows.map((row) => row.id);
    if (values.some((id) => typeof id !== 'string') || new Set(values).size !== values.length || manifest.counts[key] !== rows.length) throw new Error(`Snapshot ${key} IDs/count do not reconcile.`);
    return new Set(values as string[]);
  };
  const sourceIds = ids(snapshot.sources, 'sources');
  const claimIds = ids(snapshot.claims, 'claims');
  const runIds = ids(snapshot.runs, 'runs');
  ids(snapshot.audits, 'audits');
  const referencedSources = new Set([...snapshot.claims.map((row) => String(row.sourceId)), ...snapshot.runs.map((row) => String(row.sourceId))]);
  if (manifest.counts.colleges !== 205 || snapshot.claims.some((row) => row.isFixture !== false || !sourceIds.has(String(row.sourceId)) || !identityIds.has(String(row.collegeId))) ||
      snapshot.runs.some((row) => !sourceIds.has(String(row.sourceId))) || snapshot.audits.length !== snapshot.claims.length ||
      snapshot.sources.some((row) => !referencedSources.has(String(row.id))) ||
      snapshot.audits.some((row) => row.actorId !== null || row.targetType !== 'FieldEvidence' || !claimIds.has(String(row.targetId)))) {
    throw new Error('Snapshot contains fixture, orphaned, incomplete or reviewer-authored records.');
  }
  const countsByTarget = new Map<string, number>();
  for (const audit of snapshot.audits) countsByTarget.set(String(audit.targetId), (countsByTarget.get(String(audit.targetId)) ?? 0) + 1);
  const claimsById = new Map(snapshot.claims.map((row) => [String(row.id), row]));
  const runsById = new Map(snapshot.runs.map((row) => [String(row.id), row]));
  const badAuditRun = snapshot.audits.some((row) => {
    const metadata = row.metadata as { importRunId?: string } | null;
    if (!metadata?.importRunId) return false;
    const claim = claimsById.get(String(row.targetId));
    const run = runsById.get(metadata.importRunId);
    return !claim || !run || run.sourceId !== claim.sourceId;
  });
  if (snapshot.claims.some((row) => countsByTarget.get(String(row.id)) !== 1) || runIds.size !== snapshot.runs.length ||
      badAuditRun ||
      new Set(snapshot.sources.map((row) => row.identityKey)).size !== snapshot.sources.length ||
      new Set(snapshot.claims.map((row) => row.identityKey)).size !== snapshot.claims.length ||
      new Set(snapshot.runs.map((row) => row.identityKey)).size !== snapshot.runs.length) {
    throw new Error('Snapshot has repeated natural identities, a missing staging audit, or an audit/import-run source mismatch.');
  }
  return seed;
}

export function exactJsonEqual(left: unknown, right: unknown) {
  const canonical = (value: unknown): unknown => {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
    }
    return value;
  };
  return isDeepStrictEqual(canonical(left), canonical(right));
}

/** Normalize legacy archive rows to nullable/defaulted columns added by later migrations. */
export function normalizeArchivedRowForSchema(table: 'Source' | 'FieldEvidence' | 'ImportRun' | 'AuditLog', row: Record<string, unknown>) {
  if (table !== 'FieldEvidence') return row;
  return {
    campusScope: null,
    applicablePeriod: null,
    publisherPeriod: null,
    historical: false,
    sourceReportedRef: null,
    ...row,
  };
}

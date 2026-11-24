import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { exactJsonEqual, normalizeArchivedRowForSchema, validateOwnerReviewArchive, type OwnerReviewManifest, type OwnerReviewSnapshot } from '../../scripts/owner-review-archive';

const snapshotBytes = readFileSync('data/pilot/staged-evidence-after-batch-027.json');
const snapshot = JSON.parse(snapshotBytes.toString('utf8')) as OwnerReviewSnapshot;
const manifest = JSON.parse(readFileSync('data/pilot/staged-evidence-after-batch-027-manifest.json', 'utf8')) as OwnerReviewManifest;
const seed = readFileSync('src/server/seed/demo-colleges.json');
const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const rehash = (candidate: OwnerReviewSnapshot) => {
  const bytes = Buffer.from(JSON.stringify(candidate));
  return { bytes, manifest: { ...manifest, sha256: hash(bytes) } };
};

describe('persistent owner-review archive validation', () => {
  it('validates the checksummed snapshot, 205 identities and staged audit provenance', () => {
    expect(validateOwnerReviewArchive(snapshotBytes, manifest, snapshot, seed)).toHaveLength(205);
    expect(snapshot.collegeIdentity).toHaveLength(205);
    expect(snapshot.claims).toHaveLength(377);
    expect(snapshot.audits).toHaveLength(377);
    expect(manifest.counts.decisions).toBe(0);
    expect(manifest.counts.users).toBe(0);
  });

  it('rejects a changed payload and orphaned source references before database access', () => {
    const tampered = Buffer.from(snapshotBytes);
    tampered[0] = tampered[0] ^ 1;
    expect(() => validateOwnerReviewArchive(tampered, manifest, snapshot, seed)).toThrow(/checksum/);
    const candidate = structuredClone(snapshot);
    candidate.claims[0].sourceId = 'missing-source';
    const changed = rehash(candidate);
    expect(() => validateOwnerReviewArchive(changed.bytes, changed.manifest, candidate, seed)).toThrow(/orphaned/);
    const orphan = structuredClone(snapshot);
    orphan.sources[0].id = 'unreferenced-source';
    const changedOrphan = rehash(orphan);
    expect(() => validateOwnerReviewArchive(changedOrphan.bytes, changedOrphan.manifest, orphan, seed)).toThrow(/orphaned/);
    const auditMismatch = structuredClone(snapshot);
    const audit = auditMismatch.audits.find((row) => typeof (row.metadata as { importRunId?: unknown } | null)?.importRunId === 'string');
    expect(audit).toBeDefined();
    (audit!.metadata as { importRunId: string }).importRunId = 'missing-import-run';
    const changedAudit = rehash(auditMismatch);
    expect(() => validateOwnerReviewArchive(changedAudit.bytes, changedAudit.manifest, auditMismatch, seed)).toThrow(/audit\/import-run source mismatch/);
  });

  it('rejects fixture rows and archives containing reviewer decisions', () => {
    const fixture = structuredClone(snapshot);
    fixture.claims[0].isFixture = true;
    const changedFixture = rehash(fixture);
    expect(() => validateOwnerReviewArchive(changedFixture.bytes, changedFixture.manifest, fixture, seed)).toThrow(/fixture/);
    expect(() => validateOwnerReviewArchive(snapshotBytes, { ...manifest, counts: { ...manifest.counts, decisions: 1 } }, snapshot, seed)).toThrow(/identity mapping/);
  });

  it('compares archived structured rows independent of object reference identity', () => {
    expect(exactJsonEqual({ id: 'x', date: new Date('2026-01-01'), value: { amount: 3, currency: 'INR' } },
      { value: { currency: 'INR', amount: 3 }, date: '2026-01-01T00:00:00.000Z', id: 'x' })).toBe(true);
  });

  it('normalizes only additive FieldEvidence defaults when reading older snapshots through the current schema', () => {
    const archived = snapshot.claims[0];
    const normalized = normalizeArchivedRowForSchema('FieldEvidence', archived as unknown as Record<string, unknown>);
    expect(normalized).toMatchObject({ campusScope: null, applicablePeriod: null, publisherPeriod: null,
      historical: false, sourceReportedRef: null });
    expect(exactJsonEqual(normalized, { ...archived, campusScope: null, applicablePeriod: null,
      publisherPeriod: null, historical: false, sourceReportedRef: null })).toBe(true);
    expect(normalizeArchivedRowForSchema('Source', { id: 'source' })).toEqual({ id: 'source' });
  });
});

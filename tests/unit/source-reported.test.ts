import { describe, expect, it } from 'vitest';
import policy from '../../data/pilot/source-reported-release.json';
import archive from '../../data/pilot/staged-evidence-after-batch-027.json';
import ledger from '../../docs/DATA_COVERAGE.json';
import { eligibleSourceReported, sourceReportedFingerprint, suppressSourceReported } from '../../src/server/source-reported';
import { projectPublicCollege } from '../../src/server/public-evidence';

const now = new Date('2026-11-21T00:00:00Z');
const record = {
  ...policy.records.find(({ slug }) => slug === 'dit-university')!,
  basis: 'ATTRIBUTED_INDIVIDUAL_FACT' as const, status: 'PUBLISH' as const,
};
const college = { slug: record.slug, id: record.collegeId };
const facts = eligibleSourceReported(college, now);

describe('source-reported profile eligibility', () => {
  it('reconciles source, value, college and provenance for every published record', () => {
    expect(new Set(policy.records.map(({ slug }) => slug)).size).toBe(103);
    for (const row of policy.records) {
      const projected = suppressSourceReported(eligibleSourceReported({ id: row.collegeId, slug: row.slug }, now), [], [], now);
      expect(projected.find(({ ref }) => ref === row.ref)).toMatchObject({
        url: row.sourceUrl, campus: row.campus, status: 'OFFICIAL_SOURCE_REPORTED', evidenceLocation: expect.any(String),
      });
    }
  });

  it('refuses mismatched identities, changed provenance, duplicate decisions and stale checks', () => {
    expect(eligibleSourceReported({ ...college, id: 'wrong-campus' }, now)).toEqual([]);
    expect(eligibleSourceReported(college, now, [{ ...record, sourceUrl: 'https://example.org/fake' }])).toEqual([]);
    expect(eligibleSourceReported(college, now, [{ ...record, fingerprint: '0'.repeat(64) }])).toEqual([]);
    expect(eligibleSourceReported(college, now, [record, record])).toEqual([]);
    expect(eligibleSourceReported(college, new Date(record.expiresAt))).toEqual([]);
    expect(eligibleSourceReported(college, new Date('2026-11-19'))).toEqual([]);
  });

  it('keeps held and decision-critical claims outside the release', () => {
    const checks = [
      ['batch-31:0', 'ashoka-university', 'https://www.ashoka.edu.in/admissions/undergraduate-students/'],
      ['batch-31:5', 'nirma-university', 'https://law.nirmauni.ac.in/admission-aid/frequently-asked-questions/'],
      ['cmwlwwvdr0002zitvryebz8z9', 'indian-institute-of-technology-kanpur', 'https://iitk.ac.in/doaa/data/UG_Manual.pdf'],
    ];
    for (const [ref, slug, sourceUrl] of checks) {
      const collegeId = archive.collegeIdentity.find((identity) => identity.slug === slug)!.id;
      const fingerprint = sourceReportedFingerprint(ref);
      expect(fingerprint).not.toBeNull();
      expect(eligibleSourceReported({ id: collegeId, slug }, now, [{ ...record, ref, collegeId, slug, sourceUrl, fingerprint: fingerprint! }])).toEqual([]);
    }
    expect(policy.records.some(({ ref }) => ledger.humanReviewManifest.heldClaims.some(({ evidenceId }) => evidenceId === ref))).toBe(false);
  });

  it('publishes only period-scoped admission summaries and retains historical labels', () => {
    const item = policy.records.find(({ ref }) => ref === 'cmwln2r0c0013setvw8chejkh')!;
    const identity = { id: item.collegeId, slug: item.slug };
    const scoped = { ...item, basis: 'ATTRIBUTED_INDIVIDUAL_FACT' as const, status: 'PUBLISH' as const };
    expect(eligibleSourceReported(identity, now, [scoped])).toMatchObject([
      { value: { kind: 'admission', exam: 'CLAT 2026' }, historical: true, publisherPeriod: 'CLAT 2026' },
    ]);
    expect(eligibleSourceReported(identity, now, [{ ...scoped, publisherPeriod: undefined }])).toEqual([]);
    const ref = 'cmwm3rj7r000khxtv48tci1x7';
    const collegeId = archive.claims.find((claim) => claim.id === ref)!.collegeId;
    const slug = 'indian-institute-of-management-calcutta';
    expect(eligibleSourceReported({ id: collegeId, slug }, now, [{ ...scoped, ref, slug, collegeId,
      sourceUrl: 'https://www.iimcal.ac.in/programs/pgp/admission/admission-policy/admission-procedure-for-domestic-candidates',
      publisherPeriod: '2027–29', fingerprint: sourceReportedFingerprint(ref)! }])).toEqual([]);
  });

  it('retains the publisher period for a historical listing and compares staged evidence within that year', () => {
    const item = policy.records.find(({ slug }) => slug === 'college-of-engineering-pune')!;
    const [fact] = eligibleSourceReported({ id: item.collegeId, slug: item.slug }, now);
    expect(fact).toMatchObject({ academicYear: '2026-27', historical: true, publisherPeriod: 'Closed 2026–27 admission cycle' });
    const row = { id: 'different-reference', field: 'structured.programme', value: fact.value, isFixture: false,
      academicYear: 2026, validFrom: null, validUntil: null, supersedesId: null, decisions: [] };
    expect(suppressSourceReported([fact], [row], [], now)).toEqual([fact]);
    expect(suppressSourceReported([fact], [{ ...row, decisions: [{ status: 'REJECTED' }] }], [], now)).toEqual([]);
    expect(suppressSourceReported([fact], [{ ...row, academicYear: 2025, decisions: [{ status: 'REJECTED' }] }], [], now)).toEqual([fact]);
  });

  it('blocks duplicate releases when the same fact is withdrawn', () => {
    const published = policy.records.find(({ slug }) => slug === 'kasturba-medical-college')!;
    const identity = { id: published.collegeId, slug: published.slug };
    const proposed = { ...published, status: 'PUBLISH' as const, basis: 'ATTRIBUTED_INDIVIDUAL_FACT' as const };
    const ref = 'cmwlqtg820024gvtvkagz2fo7';
    expect(eligibleSourceReported(identity, now, [proposed])).toHaveLength(1);
    expect(eligibleSourceReported(identity, now, [proposed, { ...proposed, ref,
      fingerprint: sourceReportedFingerprint(ref)!, status: 'WITHDRAWN' }])).toEqual([]);
  });

  it('withdraws a release and does not modify verified-only projection', () => {
    expect(eligibleSourceReported(college, now, [{ ...record, status: 'WITHDRAWN', reason: 'Institution removed programme' }])).toEqual([]);
    const out = projectPublicCollege({ ...college, dataStatus: 'DEMO', courses: ['Legacy fictional course'] }, now);
    expect(out).toMatchObject({ courses: [], structuredFacts: [] });
    expect(out).not.toHaveProperty('sourceReported');
  });

  it('suppresses rejection, conflicts and approved duplicates but ignores fixtures', () => {
    expect(facts).toHaveLength(1);
    const baseline = { id: 'staged-record', field: 'structured.programme', value: facts[0].value,
      isFixture: false, academicYear: null, validFrom: null, validUntil: null, supersedesId: null, decisions: [] };
    expect(suppressSourceReported(facts, [baseline], [], now)).toEqual(facts);
    const legacy = { ...baseline, field: 'courses', value: ['B.Tech — Civil Engineering (4 years)'] };
    expect(suppressSourceReported(facts, [legacy], [], now)).toEqual(facts);
    expect(suppressSourceReported(facts, [{ ...legacy, decisions: [{ status: 'REJECTED' }] }], [], now)).toEqual([]);
    expect(suppressSourceReported(facts, [{ ...baseline, value: { kind: 'programme',
      programme: 'B.Tech in Civil Engineering', level: 'UG' } }], [], now)).toEqual(facts);
    expect(suppressSourceReported(facts, [{ ...baseline, value: { ...facts[0].value, durationMonths: 36 },
      validUntil: new Date('2026-01-01') }], [], now)).toEqual(facts);
    expect(suppressSourceReported(facts, [{ ...baseline, supersedesId: facts[0].ref,
      value: { ...facts[0].value, programme: 'Renamed programme' } }], [], now)).toEqual([]);
    expect(suppressSourceReported(facts, [{ ...baseline, decisions: [{ status: 'REJECTED' }] }], [], now)).toEqual([]);
    expect(suppressSourceReported(facts, [{ ...baseline, decisions: [{ status: 'PENDING' }] }], [], now)).toEqual([]);
    expect(suppressSourceReported(facts, [{ ...baseline, value: { ...facts[0].value, durationMonths: 36 } }], [], now)).toEqual([]);
    expect(suppressSourceReported(facts, [], [{ value: facts[0].value }], now)).toEqual([]);
    expect(suppressSourceReported(facts, [{ ...baseline, isFixture: true, decisions: [{ status: 'REJECTED' }] }], [], now)).toEqual(facts);
  });
});

import { describe, expect, it } from 'vitest';
import policy from '../../data/pilot/source-reported-release.json';
import archive from '../../data/pilot/staged-evidence-after-batch-027.json';
import ledger from '../../docs/DATA_COVERAGE.json';
import { eligibleSourceReported, sourceReportedFingerprint, suppressSourceReported } from '../../src/server/source-reported';
import { projectPublicCollege } from '../../src/server/public-evidence';

const now = new Date('2026-11-21T18:00:00Z');
const record = {
  ...policy.records.find(({ slug }) => slug === 'dit-university')!,
  basis: 'ATTRIBUTED_INDIVIDUAL_FACT' as const, status: 'PUBLISH' as const,
};
const college = { slug: record.slug, id: record.collegeId };
const facts = eligibleSourceReported(college, now);

describe('source-reported profile eligibility', () => {
  it('reconciles source, value, college and provenance for every published record', () => {
    expect(new Set(policy.records.map(({ slug }) => slug)).size).toBe(127);
    for (const row of policy.records) {
      const projected = suppressSourceReported(eligibleSourceReported({ id: row.collegeId, slug: row.slug }, now), [], [], now);
      expect(projected.find(({ ref }) => ref === row.ref)).toMatchObject({
        url: row.sourceUrl, campus: row.campus, status: 'OFFICIAL_SOURCE_REPORTED', evidenceLocation: expect.any(String),
      });
    }
  });

  it('publishes new degree listings with their exact period without implying human verification', () => {
    const vjti = policy.records.filter(({ slug }) => slug === 'vjti-mumbai');
    expect(vjti).toHaveLength(10);
    const identity = { id: vjti[0].collegeId, slug: vjti[0].slug };
    const facts = eligibleSourceReported(identity, now);
    expect(facts[0]).toMatchObject({ publicationDate: '2025-06-27' });
    expect(facts[0].evidenceLocation).toContain('updated timestamp 22 October 2026');
    expect(facts.filter(({ value }) => value.kind === 'programme')).toHaveLength(9);
    expect(facts.find(({ value }) => value.kind === 'admission')).toMatchObject({
      academicYear: '2026-27', publisherPeriod: 'VJTI source describes the process for admissions 2026-27 only',
      status: 'OFFICIAL_SOURCE_REPORTED',
    });
    expect(facts.every(({ status }) => status === 'OFFICIAL_SOURCE_REPORTED')).toBe(true);
    const pec = policy.records.filter(({ slug }) => slug === 'pec-chandigarh');
    expect(eligibleSourceReported({ id: pec[0].collegeId, slug: pec[0].slug }, now)).toHaveLength(4);
    const dtu = policy.records.filter(({ slug }) => slug === 'delhi-technological-university');
    expect(eligibleSourceReported({ id: dtu[0].collegeId, slug: dtu[0].slug }, now)).toHaveLength(14);
    const dtuFacts = eligibleSourceReported({ id: dtu[0].collegeId, slug: dtu[0].slug }, now);
    expect(dtuFacts.every(({ publicationDate }) => publicationDate === null)).toBe(true);
    expect(dtuFacts[0].sourceTitle).toContain('last updated 01 September 2026');
    const iitgn = policy.records.filter(({ slug }) => slug === 'iit-gandhinagar');
    expect(eligibleSourceReported({ id: iitgn[0].collegeId, slug: iitgn[0].slug }, now)).toHaveLength(10);
  });

  it('adds Batch 038 details only for previously basic colleges and preserves historical and campus scope', () => {
    const batchRows = policy.records.filter(({ ref }) => ref.startsWith('batch-38:'));
    expect(batchRows).toHaveLength(22);
    const bySlug = (slug: string) => batchRows.filter((row) => row.slug === slug);
    const aiims = bySlug('all-india-institute-of-medical-sciences');
    expect(aiims).toHaveLength(10);
    expect(aiims.every((row) => row.historical === true && row.publisherPeriod?.includes('21 Nov 2023'))).toBe(true);
    const aiimsFacts = eligibleSourceReported({ id: aiims[0].collegeId, slug: aiims[0].slug }, now);
    expect(aiimsFacts.filter(({ ref }) => ref.startsWith('batch-38:'))).toHaveLength(10);
    expect(aiimsFacts.filter(({ historical }) => historical)).toHaveLength(10);

    const delhi = bySlug('university-of-delhi');
    expect(delhi).toHaveLength(3);
    expect(delhi.find(({ ref }) => ref.startsWith('batch-38:') && ref === 'batch-38:10')?.historical).toBe(true);
    const delhiAdmission = eligibleSourceReported({ id: delhi[0].collegeId, slug: delhi[0].slug }, now)
      .find(({ ref }) => ref === 'batch-38:10');
    expect(delhiAdmission).toMatchObject({
      value: { kind: 'admission', programme: 'Undergraduate programmes other than B.Tech (regular students)' },
      academicYear: '2026-27', historical: true, publisherPeriod: expect.stringContaining('historical cycle'),
    });

    const amity = bySlug('amity-university');
    expect(amity).toHaveLength(5);
    expect(amity.filter(({ ref }) => ref.startsWith('batch-38:'))).toHaveLength(5);
    const madras = bySlug('madras-university');
    expect(madras).toHaveLength(4);
    const madrasFacts = eligibleSourceReported({ id: madras[0].collegeId, slug: madras[0].slug }, now)
      .filter(({ ref }) => ref.startsWith('batch-38:'));
    expect(madrasFacts).toHaveLength(4);
    expect(madrasFacts.every(({ historical, academicYear }) => historical && academicYear === '2026-27')).toBe(true);
    expect(batchRows.every(({ status }) => status === 'PUBLISH')).toBe(true);
    expect(batchRows.some(({ status }) => status === 'VERIFIED')).toBe(false);
    expect(batchRows.some(({ slug }) => slug === 'indian-institute-of-technology-kanpur')).toBe(false);
  });

  it('adds Batch 039 facts with explicit campus and historical scope while withholding Jadavpur after a fetch failure', () => {
    const rows = policy.records.filter(({ ref }) => ref.startsWith('batch-39:'));
    expect(rows).toHaveLength(16);
    const bySlug = (slug: string) => rows.filter((row) => row.slug === slug);

    const lpu = bySlug('lovely-professional-university');
    expect(lpu).toHaveLength(6);
    expect(lpu.every(({ historical, campus }) => historical && campus.includes('LPU School of Civil Engineering'))).toBe(true);
    const lpuFacts = eligibleSourceReported({ id: lpu[0].collegeId, slug: lpu[0].slug }, now)
      .filter(({ ref }) => ref.startsWith('batch-39:'));
    expect(lpuFacts.filter(({ value }) => value.kind === 'programme')).toHaveLength(2);
    expect(lpuFacts.filter(({ value }) => value.kind === 'facility')).toHaveLength(4);

    const jipmer = bySlug('jipmer-puducherry');
    expect(jipmer).toHaveLength(2);
    const route = eligibleSourceReported({ id: jipmer[0].collegeId, slug: jipmer[0].slug }, now)
      .find(({ ref }) => ref === 'batch-39:7');
    expect(route).toMatchObject({
      value: { kind: 'admission', exam: 'NTA NEET 2025', counselling: 'Medical Counselling Committee (MCC)' },
      academicYear: '2025-26', historical: true, status: 'OFFICIAL_SOURCE_REPORTED',
    });
    expect(route?.value.kind === 'admission' ? route.value.eligibility : 'unexpected').toBeUndefined();

    const mumbai = bySlug('university-of-mumbai');
    expect(mumbai).toHaveLength(4);
    expect(mumbai.every(({ campus }) => campus.includes('physical teaching campus'))).toBe(true);
    const mumbaiFacts = eligibleSourceReported({ id: mumbai[0].collegeId, slug: mumbai[0].slug }, now)
      .filter(({ ref }) => ref.startsWith('batch-39:'));
    expect(mumbaiFacts).toHaveLength(4);
    expect(mumbaiFacts.every(({ academicYear }) => academicYear === null)).toBe(true);

    const srm = bySlug('srm-institute-of-science-and-technology');
    expect(srm).toHaveLength(4);
    expect(srm.every(({ campus }) => campus.includes('Kattankulathur'))).toBe(true);
    const srmFacts = eligibleSourceReported({ id: srm[0].collegeId, slug: srm[0].slug }, now)
      .filter(({ ref }) => ref.startsWith('batch-39:'));
    expect(srmFacts.map(({ value }) => value.kind === 'programme' ? value.durationMonths : null)).toEqual([60, 60, 60, 36]);
    expect(srmFacts.every(({ scopeVerification }) => scopeVerification?.url === 'https://law.srmist.edu.in/faculties/')).toBe(true);
    expect(rows.some(({ slug }) => slug === 'jadavpur-university')).toBe(false);
  });

  it('adds the Batch 040 breadth slice with distinct categories, source attribution and historical labels', () => {
    const rows = policy.records.filter(({ ref }) => ref.startsWith('batch-40:'));
    expect(rows).toHaveLength(36);
    for (const row of rows) expect(sourceReportedFingerprint(row.ref), row.ref).toBe(row.fingerprint);
    expect(new Set(rows.map(({ slug }) => slug)).size).toBe(8);
    expect(rows.every(({ status }) => status === 'PUBLISH')).toBe(true);

    const facts = rows.flatMap((row) => eligibleSourceReported({ id: row.collegeId, slug: row.slug }, now)
      .filter(({ ref }) => ref === row.ref));
    const factsFor = (slug: string) => rows.filter((row) => row.slug === slug).flatMap((row) =>
      eligibleSourceReported({ id: row.collegeId, slug }, now).filter((fact) => fact.ref === row.ref));
    expect(facts).toHaveLength(36);
    expect(facts.every(({ status, url, evidenceLocation }) => status === 'OFFICIAL_SOURCE_REPORTED' &&
      url.startsWith('https://') && evidenceLocation.length > 0)).toBe(true);
    expect(facts.filter(({ value }) => value.kind === 'programme')).toHaveLength(19);
    expect(facts.filter(({ value }) => value.kind === 'admission')).toHaveLength(5);
    expect(facts.filter(({ value }) => value.kind === 'facility')).toHaveLength(6);
    expect(facts.filter(({ value }) => value.kind === 'contact')).toHaveLength(6);

    const archivedRows = archive.claims.map((claim) => ({
      collegeId: claim.collegeId,
      id: claim.id, field: claim.field, value: claim.value, isFixture: claim.isFixture,
      academicYear: typeof claim.academicYear === 'number' ? claim.academicYear : null,
      validFrom: claim.validFrom ? new Date(claim.validFrom) : null,
      validUntil: claim.validUntil ? new Date(claim.validUntil) : null,
      supersedesId: claim.supersedesId, decisions: [],
    }));
    const surviving = [...new Set(rows.map(({ slug }) => slug))].flatMap((slug) => {
      const collegeRows = rows.filter((row) => row.slug === slug);
      const collegeFacts = collegeRows.flatMap((row) => eligibleSourceReported({ id: row.collegeId, slug }, now)
        .filter((fact) => fact.ref === row.ref));
      return suppressSourceReported(collegeFacts, archivedRows.filter((row) => row.collegeId === collegeRows[0].collegeId), [], now);
    });
    expect(surviving.map(({ ref }) => ref).sort()).toEqual(facts.map(({ ref }) => ref).sort());

    const andhra = factsFor('andhra-university');
    expect(andhra).toHaveLength(6);
    expect(andhra.every(({ historical, academicYear, publisherPeriod }) => historical && academicYear === '2026-27' &&
      publisherPeriod?.includes('13 October 2026'))).toBe(true);
    expect(andhra.filter(({ value }) => value.kind === 'admission').every(({ publisherPeriod }) =>
      publisherPeriod?.includes('cycle closed'))).toBe(true);
    const ailet = facts.find(({ ref }) => ref === 'batch-40:19');
    expect(ailet).toMatchObject({ historical: true, academicYear: '2026-27', status: 'OFFICIAL_SOURCE_REPORTED' });

    const srcc = factsFor('shri-ram-college-of-commerce');
    expect(srcc).toHaveLength(6);
    expect(srcc.some(({ value }) => value.kind === 'programme' && value.programme.includes('B.Com'))).toBe(false);

    const loyola = policy.records.filter(({ ref }) => ['batch-31:3', 'batch-31:4'].includes(ref));
    expect(loyola).toHaveLength(2);
    expect(loyola.every(({ slug }) => slug === 'loyola-college')).toBe(true);
    expect(loyola.flatMap(({ collegeId, slug, ref }) => eligibleSourceReported({ id: collegeId, slug }, now)
      .filter((fact) => fact.ref === ref))).toHaveLength(2);
  });

  it('adds Batch 041 facts from three previously basic profiles and retains scope/date warnings', () => {
    const rows = policy.records.filter(({ ref }) => ref.startsWith('batch-41:'));
    expect(rows).toHaveLength(10);
    expect(new Set(rows.map(({ slug }) => slug))).toEqual(new Set([
      'nit-kurukshetra', 'madras-medical-college', 'stanley-medical-college',
    ]));
    for (const row of rows) expect(sourceReportedFingerprint(row.ref), row.ref).toBe(row.fingerprint);
    const facts = rows.flatMap((row) => eligibleSourceReported({ id: row.collegeId, slug: row.slug }, now)
      .filter(({ ref }) => ref === row.ref));
    expect(facts).toHaveLength(10);
    expect(facts.every(({ status, url, evidenceLocation }) => status === 'OFFICIAL_SOURCE_REPORTED' &&
      url.startsWith('https://') && evidenceLocation.length > 0)).toBe(true);
    expect(facts.filter(({ value }) => value.kind === 'programme')).toHaveLength(6);
    expect(facts.filter(({ value }) => value.kind === 'contact')).toHaveLength(4);
    expect(rows.some(({ ref }) => ref === 'batch-41:3')).toBe(false);
    const kkrProgrammes = facts.filter(({ ref }) => ['batch-41:0', 'batch-41:1', 'batch-41:2'].includes(ref));
    expect(kkrProgrammes).toHaveLength(3);
    expect(kkrProgrammes.every(({ historical, academicYear, publisherPeriod }) => historical && academicYear === '2024-25' &&
      publisherPeriod?.includes('current intake not established'))).toBe(true);
    const stanleyProgramme = facts.find(({ ref }) => ref === 'batch-41:8');
    expect(stanleyProgramme).toMatchObject({ historical: true, academicYear: '2026-27' });
    const mmc = facts.filter(({ ref }) => ref === 'batch-41:6' || ref === 'batch-41:7');
    expect(mmc.map(({ value }) => value.kind === 'programme' ? value.durationMonths : null)).toEqual([66, 36]);
    expect(mmc.every(({ publisherPeriod }) => publisherPeriod?.includes('intake year not stated'))).toBe(true);
    expect(policy.records.some(({ ref }) => ref === 'batch-41:3')).toBe(false);
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

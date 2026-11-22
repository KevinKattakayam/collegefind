import { describe, expect, it } from 'vitest';
import policy from '../../data/pilot/source-reported-release.json';
import archive from '../../data/pilot/staged-evidence-after-batch-027.json';
import ledger from '../../docs/DATA_COVERAGE.json';
import batch43 from '../../data/pilot/substantive-research-batch-043.json';
import batch44 from '../../data/pilot/substantive-research-batch-044.json';
import batch45 from '../../data/pilot/substantive-research-batch-045.json';
import batch46 from '../../data/pilot/substantive-research-batch-046.json';
import batch47 from '../../data/pilot/substantive-research-batch-047.json';
import batch48 from '../../data/pilot/substantive-research-batch-048.json';
import batch49 from '../../data/pilot/substantive-research-batch-049.json';
import batch50 from '../../data/pilot/substantive-research-batch-050.json';
import batch51 from '../../data/pilot/substantive-research-batch-051.json';
import batch52 from '../../data/pilot/substantive-research-batch-052.json';
import batch56 from '../../data/pilot/substantive-research-batch-056.json';
import batch57 from '../../data/pilot/substantive-research-batch-057.json';
import { eligibleSourceReported, sourceReportedFingerprint, suppressSourceReported } from '../../src/server/source-reported';
import { projectPublicCollege } from '../../src/server/public-evidence';
import { structuredFact } from '../../src/server/ingest/structured-facts';

const now = new Date('2026-11-22T23:02:00Z');
const record = {
  ...policy.records.find(({ slug }) => slug === 'dit-university')!,
  basis: 'ATTRIBUTED_INDIVIDUAL_FACT' as const, status: 'PUBLISH' as const,
};
const college = { slug: record.slug, id: record.collegeId };
const facts = eligibleSourceReported(college, now);

describe('source-reported profile eligibility', () => {
  it('reconciles source, value, college and provenance for every published record', () => {
    expect(new Set(policy.records.map(({ slug }) => slug)).size).toBe(205);
    for (const row of policy.records) {
      const projected = suppressSourceReported(eligibleSourceReported({ id: row.collegeId, slug: row.slug }, now), [], [], now);
      expect(projected.find(({ ref }) => ref === row.ref)).toMatchObject({
        url: row.sourceUrl, campus: row.campus, status: 'OFFICIAL_SOURCE_REPORTED', evidenceLocation: expect.any(String),
      });
    }
  });

  it('publishes Batch 043 with year/campus provenance and keeps the unsupported historical route held', () => {
    const rows = policy.records.filter(({ ref }) => ref.startsWith('batch-43:'));
    expect(rows).toHaveLength(27);
    expect(rows.every(({ status }) => status === 'PUBLISH')).toBe(true);
    expect(rows.every(({ basis, usageAssessment, expiresAt }) =>
      basis === 'ATTRIBUTED_INDIVIDUAL_FACT' && usageAssessment.length > 20 && Date.parse(expiresAt) > +now)).toBe(true);
    expect(rows.some(({ status }) => status === 'VERIFIED')).toBe(false);
    expect(rows.some(({ ref }) => ref === 'batch-43:23')).toBe(false);
    expect(batch43.researchHolds.some(({ candidateIndex, reason }) =>
      candidateIndex === 23 && reason.includes('does not establish a precise admission academic cycle'))).toBe(true);

    const bySlug = (slug: string) => rows.filter((row) => row.slug === slug);
    expect(bySlug('jamia-millia-islamia')).toHaveLength(6);
    expect(bySlug('symbiosis-international-university')).toHaveLength(3);
    expect(bySlug('symbiosis-law-school')).toHaveLength(5);
    expect(bySlug('iiit-jabalpur')).toHaveLength(5);
    expect(bySlug('gnlu-gandhinagar')).toHaveLength(3);
    expect(bySlug('lady-hardinge-medical-college')).toHaveLength(2);
    expect(bySlug('nit-arunachal-pradesh')).toHaveLength(3);

    const gnlu = bySlug('gnlu-gandhinagar');
    expect(gnlu.every(({ historical, publisherPeriod }) =>
      historical && publisherPeriod?.includes('academic year is not stated'))).toBe(true);
    const gnluFacts = eligibleSourceReported({ id: gnlu[0].collegeId, slug: gnlu[0].slug }, now)
      .filter(({ ref }) => ref.startsWith('batch-43:'));
    expect(gnluFacts.every(({ academicYear, historical }) => academicYear === null && historical)).toBe(true);
    const lhmc = bySlug('lady-hardinge-medical-college');
    expect(lhmc.every(({ historical }) => historical)).toBe(true);
    const lhmcFacts = eligibleSourceReported({ id: lhmc[0].collegeId, slug: lhmc[0].slug }, now)
      .filter(({ ref }) => ref.startsWith('batch-43:'));
    expect(lhmcFacts.every(({ academicYear, historical }) => academicYear === null && historical)).toBe(true);
    const jmiRows = bySlug('jamia-millia-islamia');
    const jmiAdmission = eligibleSourceReported({ id: jmiRows[0].collegeId, slug: jmiRows[0].slug }, now)
      .find(({ ref }) => ref === 'batch-43:3');
    expect(jmiAdmission).toMatchObject({ academicYear: '2026-27', historical: true, status: 'OFFICIAL_SOURCE_REPORTED' });
    expect(rows.every(({ status }) => status === 'PUBLISH')).toBe(true);
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
    expect(eligibleSourceReported({ id: pec[0].collegeId, slug: pec[0].slug }, now).filter(({ ref }) => !ref.startsWith('batch-55:'))).toHaveLength(4);
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

  it('publishes Batch 044 facts across 20 previously basic colleges with source and period provenance', () => {
    const rows = policy.records.filter(({ ref }) => ref.startsWith('batch-44:'));
    expect(rows).toHaveLength(31);
    expect(new Set(rows.map(({ slug }) => slug)).size).toBe(19);
    expect(rows.every(({ status, basis, usageAssessment, fingerprint, ref }) =>
      status === 'PUBLISH' && basis === 'ATTRIBUTED_INDIVIDUAL_FACT' && usageAssessment.length > 20 &&
      sourceReportedFingerprint(ref) === fingerprint)).toBe(true);
    expect(rows.some(({ status }) => status === 'VERIFIED')).toBe(false);

    const bySlug = (slug: string) => rows.filter((row) => row.slug === slug);
    expect(bySlug('iit-jodhpur')).toHaveLength(0);
    expect(bySlug('indian-institute-of-technology-kanpur')).toHaveLength(0);
    expect(bySlug('grant-medical-college')).toHaveLength(2);
    expect(bySlug('grant-medical-college').some(({ sourceUrl }) => sourceUrl === 'https://gmcjjh.edu.in/courses/')).toBe(true);
    expect(bySlug('vel-tech-university')[0]).toMatchObject({ publisherPeriod: 'B.Tech admissions open 2027.' });
    expect(eligibleSourceReported({ id: bySlug('vel-tech-university')[0].collegeId, slug: 'vel-tech-university' }, now)
      .find(({ ref }) => ref === 'batch-44:30')).toMatchObject({ academicYear: '2027', historical: false });
    expect(bySlug('jntu-hyderabad')[0].campus).toContain('institutional postal address');
    expect(bySlug('north-eastern-hill-university')).toHaveLength(2);
    expect(bySlug('central-university-of-haryana').filter(({ ref }) => ref.startsWith('batch-44:')))
      .toHaveLength(4);

    const admitted = rows.filter(({ slug }) => ['nit-andhra-pradesh', 'siksha-o-anusandhan'].includes(slug));
    expect(admitted.every(({ historical, publisherPeriod }) => historical && publisherPeriod)).toBe(true);
    const facts = rows.flatMap((row) => eligibleSourceReported({ id: row.collegeId, slug: row.slug }, now)
      .filter(({ ref }) => ref === row.ref));
    expect(facts.every(({ status, url, evidenceLocation }) => status === 'OFFICIAL_SOURCE_REPORTED' &&
      url.startsWith('https://') && evidenceLocation.length > 0)).toBe(true);
    expect(facts).toHaveLength(31);
    expect(batch44.candidateClaims.find(({ institutionSlug }) => institutionSlug === 'iit-jodhpur'))
      .toMatchObject({ stageable: false, status: 'RESEARCH_HOLD_SOURCE_UNAVAILABLE' });
    expect(batch44.candidateClaims.find(({ institutionSlug }) => institutionSlug === 'indian-institute-of-technology-kanpur'))
      .toMatchObject({ stageable: false, status: 'RESEARCH_HOLD_ARCHIVED_SOURCE_CONFLICT' });
    expect(batch44.candidateClaims.find(({ institutionSlug, value }) =>
      institutionSlug === 'iiit-gwalior' && value.kind === 'admission'))
      .toMatchObject({ stageable: false, status: 'RESEARCH_HOLD_DUPLICATE_ARCHIVED_EVIDENCE' });
  });

  it('publishes Batch 045 across five formerly basic colleges with explicit scope and holds access-blocked sources', () => {
    const rows = policy.records.filter(({ ref }) => ref.startsWith('batch-45:'));
    expect(rows).toHaveLength(15);
    expect(new Set(rows.map(({ slug }) => slug)).size).toBe(5);
    expect(rows.every(({ status, basis, usageAssessment, fingerprint, ref }) =>
      status === 'PUBLISH' && basis === 'ATTRIBUTED_INDIVIDUAL_FACT' && usageAssessment.length > 30 &&
      sourceReportedFingerprint(ref) === fingerprint)).toBe(true);
    expect(rows.some(({ status }) => status === 'VERIFIED')).toBe(false);

    const bySlug = (slug: string) => rows.filter((row) => row.slug === slug);
    expect(bySlug('nit-manipur')).toHaveLength(3);
    expect(bySlug('iit-bhilai')).toHaveLength(4);
    expect(bySlug('iiit-delhi')).toHaveLength(1);
    expect(bySlug('birla-institute-of-technology-mesra')).toHaveLength(2);
    expect(bySlug('woxsen-university')).toHaveLength(5);

    const facts = rows.flatMap((row) => eligibleSourceReported({ id: row.collegeId, slug: row.slug }, now)
      .filter(({ ref }) => ref === row.ref));
    expect(facts).toHaveLength(15);
    expect(facts.filter(({ value }) => value.kind === 'programme')).toHaveLength(4);
    expect(facts.filter(({ value }) => value.kind === 'facility')).toHaveLength(6);
    expect(facts.filter(({ value }) => value.kind === 'admission')).toHaveLength(1);
    expect(facts.filter(({ value }) => value.kind === 'contact')).toHaveLength(4);
    expect(facts.find(({ ref }) => ref === 'batch-45:4')).toMatchObject({
      academicYear: '2026-27', historical: true, publisherPeriod: '2026-27', status: 'OFFICIAL_SOURCE_REPORTED',
    });
    expect(facts.find(({ ref }) => ref === 'batch-45:8')).toMatchObject({
      campus: expect.stringContaining('main campus, Ranchi'), value: { kind: 'programme', durationMonths: 48 },
    });
    expect(facts.find(({ ref }) => ref === 'batch-45:11')?.value).toMatchObject({ kind: 'facility' });
    expect(batch45.candidateClaims).toHaveLength(15);
    expect(batch45.candidateClaims.every(({ stageable, reviewState, status }) =>
      stageable && reviewState === 'UNREVIEWED' && status === 'UNREVIEWED')).toBe(true);
    for (const slug of ['indian-institute-of-management-bangalore', 'osmania-university', 'iiit-sri-city', 'ict-mumbai', 'iit-dharwad', 'nit-srinagar', 'punjab-technical-university']) {
      expect(batch45.researchHolds.some((hold) => hold.institutionSlug === slug)).toBe(true);
      expect(rows.some((row) => row.slug === slug)).toBe(false);
    }
    expect(rows.every(({ slug }) => !['indian-institute-of-management-bangalore', 'osmania-university', 'iiit-sri-city', 'ict-mumbai', 'iit-dharwad', 'nit-srinagar', 'punjab-technical-university'].includes(slug))).toBe(true);
  });

  it('adds Batch 046 scoped programme, facility, contact and historical facts across nine colleges', () => {
    const rows = policy.records.filter(({ ref }) => ref.startsWith('batch-46:'));
    expect(rows).toHaveLength(22);
    expect(new Set(rows.map(({ slug }) => slug)).size).toBe(9);
    for (const { status, basis, fingerprint, ref } of rows) {
      expect(status, ref).toBe('PUBLISH');
      expect(basis, ref).toBe('ATTRIBUTED_INDIVIDUAL_FACT');
      expect(sourceReportedFingerprint(ref), ref).toBe(fingerprint);
    }

    const counts: Record<string, number> = {};
    const facts = rows.flatMap((row) => eligibleSourceReported({ id: row.collegeId, slug: row.slug }, now)
      .filter(({ ref }) => ref === row.ref));
    expect(facts).toHaveLength(22);
    for (const { value } of facts) counts[value.kind] = (counts[value.kind] ?? 0) + 1;
    expect(counts).toEqual({ programme: 10, facility: 6, contact: 4, admission: 2 });

    for (const ref of ['batch-46:10', 'batch-46:11', 'batch-46:12', 'batch-46:13',
      'batch-46:17', 'batch-46:19', 'batch-46:20', 'batch-46:21']) {
      expect(facts.find((fact) => fact.ref === ref)?.historical, ref).toBe(true);
    }
    expect(facts.find(({ ref }) => ref === 'batch-46:12')).toMatchObject({
      academicYear: '2026-27', publisherPeriod: '2026-27', value: { kind: 'admission' },
    });
    expect(facts.find(({ ref }) => ref === 'batch-46:20')).toMatchObject({
      academicYear: '2024-25', publisherPeriod: '2024-25', value: { kind: 'admission' },
    });
    expect(batch46.candidateClaims.every(({ stageable, reviewState, status }) =>
      stageable && reviewState === 'UNREVIEWED' && status === 'UNREVIEWED')).toBe(true);
    expect(batch46.researchHolds.some(({ institutionSlug }) => institutionSlug === 'iiit-hyderabad')).toBe(true);
  });

  it('adds Batch 047 facts from directly inspected official pages with historical-cycle labeling', () => {
    const rows = policy.records.filter(({ ref }) => ref.startsWith('batch-47:'));
    expect(rows).toHaveLength(9);
    expect(new Set(rows.map(({ slug }) => slug)).size).toBe(4);
    for (const { status, basis, fingerprint, ref } of rows) {
      expect(status, ref).toBe('PUBLISH');
      expect(basis, ref).toBe('ATTRIBUTED_INDIVIDUAL_FACT');
      expect(sourceReportedFingerprint(ref), ref).toBe(fingerprint);
    }
    const facts = rows.flatMap((row) => eligibleSourceReported({ id: row.collegeId, slug: row.slug }, now)
      .filter(({ ref }) => ref === row.ref));
    expect(facts).toHaveLength(9);
    expect(facts.filter(({ value }) => value.kind === 'programme')).toHaveLength(2);
    expect(facts.filter(({ value }) => value.kind === 'facility')).toHaveLength(3);
    expect(facts.filter(({ value }) => value.kind === 'contact')).toHaveLength(3);
    expect(facts.filter(({ value }) => value.kind === 'admission')).toHaveLength(1);
    expect(facts.every(({ status }) => status === 'OFFICIAL_SOURCE_REPORTED')).toBe(true);
    expect(facts.find(({ ref }) => ref === 'batch-47:8')).toMatchObject({
      academicYear: '2026-27', historical: true, status: 'OFFICIAL_SOURCE_REPORTED',
    });
    expect(facts.find(({ ref }) => ref === 'batch-47:8')?.value).toMatchObject({
      kind: 'admission', exam: 'CUET-UG 2026', category: 'Undergraduate',
    });
    expect(facts.find(({ ref }) => ref === 'batch-47:8')?.publisherPeriod).not.toContain('elapsed..');
    expect(batch47.candidateClaims).toHaveLength(9);
    expect(batch47.candidateClaims.every(({ stageable, reviewState, status }) =>
      stageable && reviewState === 'UNREVIEWED' && status === 'UNREVIEWED')).toBe(true);
    for (const slug of ['cochin-university', 'iit-jodhpur', 'jadavpur-university', 'nit-puducherry', 'indian-institute-of-management-lucknow']) {
      expect(batch47.researchHolds.some((hold) => hold.institutionSlug === slug)).toBe(true);
      expect(rows.some((row) => row.slug === slug)).toBe(false);
    }
  });

  it('adds Batch 048 programme, cycle-route and official contact facts across three previously basic colleges', () => {
    const rows = policy.records.filter(({ ref }) => ref.startsWith('batch-48:'));
    expect(rows).toHaveLength(7);
    expect(new Set(rows.map(({ slug }) => slug))).toEqual(new Set(['central-university-of-rajasthan', 'mysore-university', 'jain-university']));
    for (const { status, basis, fingerprint, ref } of rows) {
      expect(status, ref).toBe('PUBLISH');
      expect(basis, ref).toBe('ATTRIBUTED_INDIVIDUAL_FACT');
      expect(sourceReportedFingerprint(ref), ref).toBe(fingerprint);
    }
    const facts = rows.flatMap((row) => eligibleSourceReported({ id: row.collegeId, slug: row.slug }, now)
      .filter(({ ref }) => ref === row.ref));
    expect(facts).toHaveLength(7);
    expect(facts.filter(({ value }) => value.kind === 'programme')).toHaveLength(2);
    expect(facts.filter(({ value }) => value.kind === 'admission')).toHaveLength(2);
    expect(facts.filter(({ value }) => value.kind === 'contact')).toHaveLength(3);
    expect(facts.every(({ status }) => status === 'OFFICIAL_SOURCE_REPORTED')).toBe(true);
    expect(facts.find(({ ref }) => ref === 'batch-48:0')).toMatchObject({
      academicYear: '2026-27', historical: true, value: { kind: 'programme', durationMonths: 48 },
    });
    expect(facts.find(({ ref }) => ref === 'batch-48:1')).toMatchObject({
      academicYear: '2026-27', historical: true, value: { kind: 'admission', exam: 'CUET (UG)/CUET (PG) 2026' },
    });
    expect(facts.find(({ ref }) => ref === 'batch-48:3')).toMatchObject({
      academicYear: '2026-27', historical: false, campus: expect.stringContaining('School of Planning and Architecture'),
      value: { kind: 'programme', durationMonths: 60 },
    });
    expect(facts.find(({ ref }) => ref === 'batch-48:5')).toMatchObject({
      academicYear: '2026-27', historical: true, value: { kind: 'admission' },
    });
    expect(batch48.candidateClaims).toHaveLength(7);
    expect(batch48.candidateClaims.every(({ stageable, reviewState, status }) =>
      stageable && reviewState === 'UNREVIEWED' && status === 'UNREVIEWED')).toBe(true);
    expect(batch48.candidateHolds.some(({ field, status }) => field === 'contact.email' && status === 'RESEARCH_HOLD_CONTACT_FORMAT')).toBe(true);
    for (const slug of ['nit-jamshedpur', 'mizoram-university']) {
      expect(batch48.researchHolds.some(({ institutionSlug }) => institutionSlug === slug)).toBe(true);
      expect(rows.some(({ slug: published }) => published === slug)).toBe(false);
    }
  });

  it('reconciles Batch 049 source-reported facts, temporal labels and institution scope', () => {
    const rows = policy.records.filter(({ ref }) => ref.startsWith('batch-49:'));
    expect(batch49.candidateClaims).toHaveLength(20);
    expect(rows).toHaveLength(20);
    expect(new Set(rows.map(({ slug }) => slug)).size).toBe(8);
    expect(rows.every(({ status, basis, fingerprint, ref }) => status === 'PUBLISH' &&
      basis === 'ATTRIBUTED_INDIVIDUAL_FACT' && sourceReportedFingerprint(ref) === fingerprint)).toBe(true);
    expect(rows.every(({ status }) => status !== 'VERIFIED')).toBe(true);

    const facts = rows.flatMap((row) => eligibleSourceReported({ id: row.collegeId, slug: row.slug }, now)
      .filter(({ ref }) => ref === row.ref));
    expect(facts).toHaveLength(20);
    expect(facts.filter(({ value }) => value.kind === 'programme')).toHaveLength(9);
    expect(facts.filter(({ value }) => value.kind === 'admission')).toHaveLength(1);
    expect(facts.filter(({ value }) => value.kind === 'facility')).toHaveLength(3);
    expect(facts.filter(({ value }) => value.kind === 'contact')).toHaveLength(7);
    expect(facts.every(({ status, evidenceLocation, url }) => status === 'OFFICIAL_SOURCE_REPORTED' &&
      evidenceLocation.length > 0 && url.startsWith('https://'))).toBe(true);

    expect(facts.find(({ ref }) => ref === 'batch-49:2')).toMatchObject({
      academicYear: '2027', historical: false, value: { kind: 'admission', category: 'Domestic applicants, 2027–31 cohort' },
      publisherPeriod: expect.stringContaining('test held 15 Nov 2026'),
    });
    expect(facts.find(({ ref }) => ref === 'batch-49:5')).toMatchObject({
      academicYear: '2024-25', historical: true,
      publisherPeriod: expect.stringContaining('Historical 2024–25'),
    });
    expect(facts.find(({ ref }) => ref === 'batch-49:8')).toMatchObject({
      academicYear: '2026-27', campus: expect.stringContaining('Amritsar constituent campus'),
    });
    expect(facts.find(({ ref }) => ref === 'batch-49:11')).toMatchObject({
      value: { kind: 'programme', durationMonths: 24 }, campus: expect.stringContaining('Kohima Campus'),
    });
    expect(facts.find(({ ref }) => ref === 'batch-49:13')).toMatchObject({
      value: { kind: 'programme', durationMonths: 24 }, campus: expect.stringContaining('campus not stated'),
    });
    expect(facts.find(({ ref }) => ref === 'batch-49:17')).toMatchObject({
      academicYear: '2026-27', campus: expect.stringContaining('Mumbai campus'),
    });
    expect(batch49.candidateClaims.every(({ status, reviewState, stageable }) =>
      status === 'UNREVIEWED' && reviewState === 'UNREVIEWED' && stageable)).toBe(true);
    expect(batch49.researchHolds.some(({ institutionSlug, status }) =>
      institutionSlug === 'st-johns-college' && status === 'RESEARCH_HOLD_IDENTITY_MISMATCH')).toBe(true);
    expect(batch49.researchHolds.some(({ institutionSlug, status }) =>
      institutionSlug === 'op-jindal-university' && status === 'RESEARCH_HOLD_IDENTITY_MISMATCH')).toBe(true);
    expect(rows.some(({ slug }) => ['st-johns-college', 'op-jindal-university', 'ict-mumbai'].includes(slug))).toBe(false);
  });

  it('reconciles Batch 050 direct-source facts, cycle scope and previously held evidence', () => {
    const rows = policy.records.filter(({ ref }) => ref.startsWith('batch-50:'));
    expect(batch50.candidateClaims).toHaveLength(6);
    expect(rows).toHaveLength(6);
    expect(new Set(rows.map(({ slug }) => slug)).size).toBe(4);
    expect(rows.every(({ status, basis, fingerprint, ref }) => status === 'PUBLISH' &&
      basis === 'ATTRIBUTED_INDIVIDUAL_FACT' && sourceReportedFingerprint(ref) === fingerprint)).toBe(true);

    const facts = rows.flatMap((row) => eligibleSourceReported({ id: row.collegeId, slug: row.slug }, now)
      .filter(({ ref }) => ref === row.ref));
    expect(facts).toHaveLength(6);
    expect(facts.filter(({ value }) => value.kind === 'programme')).toHaveLength(2);
    expect(facts.filter(({ value }) => value.kind === 'admission')).toHaveLength(3);
    expect(facts.filter(({ value }) => value.kind === 'facility')).toHaveLength(1);
    expect(facts.every(({ status, evidenceLocation, url }) => status === 'OFFICIAL_SOURCE_REPORTED' &&
      evidenceLocation.length > 0 && url.startsWith('https://'))).toBe(true);

    expect(facts.find(({ ref }) => ref === 'batch-50:0')).toMatchObject({
      value: { kind: 'facility', facility: 'P. K. Kelkar Library' },
      campus: expect.stringContaining('IIT Kanpur'),
    });
    expect(facts.find(({ ref }) => ref === 'batch-50:1')).toMatchObject({
      value: { kind: 'programme', durationMonths: 12 },
      campus: expect.stringContaining('Hyderabad and Mohali'),
    });
    expect(facts.find(({ ref }) => ref === 'batch-50:2')).toMatchObject({
      academicYear: '2027', historical: false, validUntil: '2026-12-07T00:00:00.000Z',
      value: { kind: 'admission', category: 'Class of 2027 application cycle' },
    });
    expect(facts.find(({ ref }) => ref === 'batch-50:3')).toMatchObject({
      academicYear: '2026-27', historical: false,
      publisherPeriod: expect.stringContaining('page title still says 2025–26'),
      value: { kind: 'admission' },
    });
    expect(facts.find(({ ref }) => ref === 'batch-50:4')).toMatchObject({
      academicYear: '2026', historical: true,
      publisherPeriod: expect.stringContaining('Historical 2026'),
      value: { kind: 'admission' },
    });
    expect(facts.find(({ ref }) => ref === 'batch-50:5')).toMatchObject({
      value: { kind: 'programme', programme: 'Bachelor of Arts', level: 'UG' },
      publisherPeriod: expect.stringContaining('no explicit academic year'),
    });

    // Existing IIT Kanpur B.Tech/B.S and admission evidence remains held; the new release does not revive it.
    const iitKanpur = archive.collegeIdentity.find(({ slug }) => slug === 'indian-institute-of-technology-kanpur')!;
    const archivedRows = archive.claims.map((claim) => ({
      id: claim.id, field: claim.field, value: claim.value, isFixture: claim.isFixture,
      academicYear: claim.academicYear, validFrom: claim.validFrom ? new Date(claim.validFrom) : null,
      validUntil: claim.validUntil ? new Date(claim.validUntil) : null, supersedesId: claim.supersedesId,
      decisions: [],
    }));
    const projected = suppressSourceReported(eligibleSourceReported(iitKanpur, now), archivedRows, [], now);
    expect(projected.some(({ ref }) => ref === 'batch-50:0')).toBe(true);
    expect(batch50.candidateClaims.every(({ status, reviewState, stageable }) =>
      status === 'UNREVIEWED' && reviewState === 'UNREVIEWED' && stageable)).toBe(true);
    expect(batch50.reviewerSummary.ownerDatabaseWrites).toBe(0);
    expect(batch50.reviewerSummary.genuineApprovals).toBe(0);
    expect(batch50.researchHolds.some(({ institutionSlug, reason }) =>
      institutionSlug === 'op-jindal-university' && reason.includes('Raigarh'))).toBe(true);
  });

  it('publishes Batch 051 only with exact institution/campus scopes and source-reported status', () => {
    const rows = policy.records.filter(({ ref }) => ref.startsWith('batch-51:'));
    expect(batch51.candidateClaims).toHaveLength(8);
    expect(rows).toHaveLength(8);
    expect(new Set(rows.map(({ slug }) => slug))).toEqual(new Set([
      'psg-college-of-technology', 'rajiv-gandhi-university', 'centurion-university', 'op-jindal-university',
    ]));
    expect(rows.every(({ status, basis, fingerprint, ref }) => status === 'PUBLISH' &&
      basis === 'ATTRIBUTED_INDIVIDUAL_FACT' && sourceReportedFingerprint(ref) === fingerprint)).toBe(true);

    const facts = rows.flatMap((row) => eligibleSourceReported({ id: row.collegeId, slug: row.slug }, now)
      .filter(({ ref }) => ref === row.ref));
    expect(facts).toHaveLength(8);
    expect(facts.every(({ status, academicYear, url, evidenceLocation }) => status === 'OFFICIAL_SOURCE_REPORTED' &&
      academicYear === null && url.startsWith('https://') && evidenceLocation.length > 0)).toBe(true);
    const byRef = (ref: string) => facts.find((fact) => fact.ref === ref)!;
    expect(byRef('batch-51:0')).toMatchObject({
      value: { kind: 'facility', facility: 'College library' }, historical: true,
      campus: expect.stringContaining('Coimbatore'), publisherPeriod: expect.stringContaining('1951'),
    });
    expect(byRef('batch-51:1')).toMatchObject({ value: { kind: 'facility', facility: 'Hostel' }, historical: false });
    expect(byRef('batch-51:2')).toMatchObject({ value: { kind: 'contact', channel: 'ADDRESS' }, campus: expect.stringContaining('Peelamedu') });
    expect(byRef('batch-51:3')).toMatchObject({ value: { kind: 'contact', channel: 'PHONE', contact: '0422-2572177' } });
    expect(byRef('batch-51:4')).toMatchObject({
      value: { kind: 'programme', level: 'PG', durationSemesters: 4 },
      campus: expect.stringContaining('does not specify the programme\'s physical campus'),
    });
    expect(byRef('batch-51:5')).toMatchObject({
      value: { kind: 'programme', programme: 'BBA Healthcare Management', level: 'UG' },
      campus: expect.stringContaining('Bhubaneswar campus only'),
    });
    expect(byRef('batch-51:6')).toMatchObject({
      value: { kind: 'programme', programme: 'BBA (Hons.) Marketing/HR/Finance', level: 'UG' },
      campus: expect.stringContaining('Sonipat'),
    });
    expect(byRef('batch-51:7')).toMatchObject({
      value: { kind: 'contact', channel: 'EMAIL', contact: 'admissions@jgu.edu.in' },
      campus: expect.stringContaining('Sonipat'),
    });
    expect(batch51.candidateClaims.every(({ status, reviewState, stageable }) =>
      status === 'UNREVIEWED' && reviewState === 'UNREVIEWED' && stageable)).toBe(true);
    expect(batch51.reviewerSummary.ownerDatabaseWrites).toBe(0);
    expect(batch51.reviewerSummary.genuineApprovals).toBe(0);
    expect(batch51.researchHolds).toHaveLength(16);

    const archivedRows = archive.claims.map((claim) => ({
      id: claim.id, field: claim.field, value: claim.value, isFixture: claim.isFixture,
      academicYear: claim.academicYear, validFrom: claim.validFrom ? new Date(claim.validFrom) : null,
      validUntil: claim.validUntil ? new Date(claim.validUntil) : null, supersedesId: claim.supersedesId,
      decisions: [],
    }));
    const visibleCandidates = rows.flatMap((row) => {
      const identity = archive.collegeIdentity.find(({ slug }) => slug === row.slug)!;
      return suppressSourceReported(eligibleSourceReported(identity, now), archivedRows, [], now)
        .filter(({ ref }) => ref === row.ref);
    });
    expect(visibleCandidates.map(({ ref }) => ref).sort()).toEqual(rows.map(({ ref }) => ref).sort());
  });

  it('suppresses archived evidence only within its own college identity', () => {
    const archivedRows = archive.claims.map((claim) => ({
      collegeId: claim.collegeId,
      id: claim.id, field: claim.field, value: claim.value, isFixture: claim.isFixture,
      academicYear: typeof claim.academicYear === 'number' ? claim.academicYear : null,
      validFrom: claim.validFrom ? new Date(claim.validFrom) : null,
      validUntil: claim.validUntil ? new Date(claim.validUntil) : null,
      supersedesId: claim.supersedesId, decisions: [],
    }));
    const visible = archive.collegeIdentity.flatMap((identity) =>
      suppressSourceReported(
        eligibleSourceReported(identity, now),
        archivedRows.filter((row) => row.collegeId === identity.id),
        [], now,
      ));
    const eligible = archive.collegeIdentity.flatMap((identity) => eligibleSourceReported(identity, now));
    const preBatch052 = eligible.filter(({ ref }) => !ref.startsWith('batch-52:') && !ref.startsWith('batch-53:') &&
      !ref.startsWith('batch-54:') && !ref.startsWith('batch-55:') && !ref.startsWith('batch-56:') && !ref.startsWith('batch-57:'));
    const unscopedSimulation = archive.collegeIdentity.flatMap((identity) =>
      suppressSourceReported(preBatch052.filter((fact) =>
        policy.records.find((row) => row.ref === fact.ref)?.collegeId === identity.id), archivedRows, [], now));
    const falseSuppressedRefs = new Set(preBatch052.map(({ ref }) => ref)
      .filter((ref) => !unscopedSimulation.some((fact) => fact.ref === ref)));
    const identityBySlug = new Map(archive.collegeIdentity.map(({ id, slug }) => [slug, id]));
    const foreignSuppressorsByRef = new Map([...falseSuppressedRefs].map((ref) => {
      const fact = preBatch052.find((row) => row.ref === ref)!;
      const ownerCollegeId = identityBySlug.get(policy.records.find((row) => row.ref === ref)!.slug);
      return [ref, archivedRows.filter((row) => row.collegeId !== ownerCollegeId &&
        suppressSourceReported([fact], [row], [], now).length === 0)];
    }));
    const correctlyScopedPreBatch052 = archive.collegeIdentity.flatMap((identity) =>
      suppressSourceReported(preBatch052.filter((fact) =>
        policy.records.find((row) => row.ref === fact.ref)?.collegeId === identity.id),
      archivedRows.filter((row) => row.collegeId === identity.id), [], now));

    expect(eligible).toHaveLength(503);
    expect(visible).toHaveLength(503);
    expect(new Set(visible.map(({ ref }) => ref)).size).toBe(503);
    expect(visible.every(({ status }) => status === 'OFFICIAL_SOURCE_REPORTED')).toBe(true);
    expect(visible.some(({ ref }) => ref === 'batch-50:0')).toBe(true);
    expect(preBatch052).toHaveLength(414);
    expect(unscopedSimulation).toHaveLength(360);
    expect(falseSuppressedRefs).toHaveLength(54);
    expect(foreignSuppressorsByRef.size).toBe(54);
    expect([...foreignSuppressorsByRef.values()].every((rows) => rows.length > 0)).toBe(true);
    expect(new Set([...foreignSuppressorsByRef.values()].flat().map(({ id }) => id))).toEqual(new Set([
      'cmwlwwvdr0002zitvryebz8z9',
      'cmwlrawje0007fhtvqqvjgda6',
      'cmwlrawjq000afhtvue218xes',
      'cmwlshl7l000ow7tvb5hejcu8',
      'cmwlrawjw000dfhtv7eh9z0vu',
      'cmwlpjrxo0018yttvxlruoj99',
    ]));
    expect(correctlyScopedPreBatch052).toHaveLength(414);
  });

  it('publishes the Osmania University brochure facts only with named campus scope and attribution', () => {
    const rows = policy.records.filter(({ ref }) => ref.startsWith('batch-52:'));
    expect(batch52.candidateClaims).toHaveLength(10);
    expect(rows).toHaveLength(10);
    expect(rows.every(({ status, fingerprint, ref }) => status === 'PUBLISH' &&
      sourceReportedFingerprint(ref) === fingerprint)).toBe(true);
    const facts = eligibleSourceReported({ id: rows[0].collegeId, slug: 'osmania-university' }, now)
      .filter(({ ref }) => ref.startsWith('batch-52:'));
    expect(facts).toHaveLength(10);
    expect(facts.filter(({ value }) => value.kind === 'programme')).toHaveLength(8);
    expect(facts.filter(({ value }) => value.kind === 'facility')).toHaveLength(2);
    expect(facts.every(({ academicYear, status, url, evidenceLocation, publisherPeriod }) =>
      academicYear === null && status === 'OFFICIAL_SOURCE_REPORTED' &&
      url === 'https://www.osmania.ac.in/OU%20Brochure%202026.pdf' &&
      evidenceLocation.length > 0 && !!publisherPeriod)).toBe(true);
    expect(facts.filter(({ value }) => value.kind === 'programme').every(({ publisherPeriod }) =>
      publisherPeriod?.includes('does not state an applicable intake year'))).toBe(true);
    expect(facts.filter(({ value }) => value.kind === 'programme').every(({ campus }) =>
      campus.includes('University College of Engineering') && campus.includes('not mapped to every'))).toBe(true);
    expect(facts.filter(({ value }) => value.kind === 'facility').every(({ campus }) =>
      campus.includes('main campus'))).toBe(true);
    expect(batch52.researchHolds.some(({ field, reason }) => field === 'contact' && reason.includes('not independently corroborated'))).toBe(true);
  });

  it('preserves source-reported semester duration without silently converting units', () => {
    expect(structuredFact.parse({ kind: 'programme', programme: 'Example M.Tech', level: 'PG', durationSemesters: 4 }))
      .toMatchObject({ durationSemesters: 4 });
    expect(structuredFact.safeParse({ kind: 'programme', programme: 'Example M.Tech', level: 'PG', durationMonths: 24, durationSemesters: 4 }).success)
      .toBe(false);
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

  it('supports official two-year cohort periods without losing historical or expiry scope', () => {
    const spj = policy.records.find(({ ref }) => ref === 'batch-56:1')!;
    const spjCollege = { id: spj.collegeId, slug: spj.slug };
    expect(eligibleSourceReported(spjCollege, now).find(({ ref }) => ref === spj.ref)).toMatchObject({
      academicYear: '2027-29', status: 'OFFICIAL_SOURCE_REPORTED', historical: false,
    });
    expect(eligibleSourceReported(spjCollege, new Date('2026-11-29T00:00:00Z'))).not.toContainEqual(
      expect.objectContaining({ ref: spj.ref }),
    );
    const fms = policy.records.find(({ ref }) => ref === 'batch-56:2')!;
    expect(eligibleSourceReported({ id: fms.collegeId, slug: fms.slug }, now).find(({ ref }) => ref === fms.ref)).toMatchObject({
      ref: fms.ref, academicYear: '2026-28', historical: true, status: 'OFFICIAL_SOURCE_REPORTED',
    });
  });

  it('publishes Batch 056 as attributed, low-risk source-reported facts across one-category profiles', () => {
    const rows = policy.records.filter(({ ref }) => ref.startsWith('batch-56:'));
    expect(rows).toHaveLength(22);
    expect(batch56.candidateClaims).toHaveLength(22);
    expect(new Set(rows.map(({ slug }) => slug)).size).toBe(20);
    expect(rows.every(({ status, basis, usageAssessment, fingerprint, ref }) =>
      status === 'PUBLISH' && basis === 'ATTRIBUTED_INDIVIDUAL_FACT' && usageAssessment.length > 30 &&
      fingerprint === sourceReportedFingerprint(ref))).toBe(true);
    expect(rows.some(({ status }) => status === 'VERIFIED')).toBe(false);
    expect(batch56.candidateClaims.every(({ status, reviewState, stageable }) =>
      status === 'UNREVIEWED' && reviewState === 'UNREVIEWED' && stageable)).toBe(true);
    expect(batch56.sources.every(({ url, retrievedAt, reuseConditions }) =>
      url.startsWith('https://') && retrievedAt === batch56.researchedAt && reuseConditions.length > 30)).toBe(true);

    const facts = rows.flatMap((row) => eligibleSourceReported({ id: row.collegeId, slug: row.slug }, now)
      .filter(({ ref }) => ref === row.ref));
    expect(facts).toHaveLength(22);
    expect(facts.every(({ status, url, evidenceLocation, publisher, sourceTitle }) =>
      status === 'OFFICIAL_SOURCE_REPORTED' && url.startsWith('https://') && evidenceLocation.length > 0 &&
      publisher.length > 0 && sourceTitle.length > 0)).toBe(true);
    expect(facts.filter(({ value }) => value.kind === 'admission')).toHaveLength(4);
    expect(facts.filter(({ value }) => value.kind === 'facility')).toHaveLength(13);
    expect(facts.filter(({ value }) => value.kind === 'contact')).toHaveLength(5);
    expect(facts.filter(({ value }) => value.kind === 'programme')).toHaveLength(0);
    expect(facts.every(({ value }) => !['fee', 'placement', 'recognition', 'nirfRanking', 'scholarship'].includes(value.kind))).toBe(true);

    const archiveRows = archive.claims.map((claim) => ({
      collegeId: claim.collegeId,
      id: claim.id, field: claim.field, value: claim.value, isFixture: claim.isFixture,
      academicYear: typeof claim.academicYear === 'number' ? claim.academicYear : null,
      validFrom: claim.validFrom ? new Date(claim.validFrom) : null,
      validUntil: claim.validUntil ? new Date(claim.validUntil) : null,
      supersedesId: claim.supersedesId, decisions: [],
    }));
    const surviving = rows.flatMap((row) => suppressSourceReported(
      eligibleSourceReported({ id: row.collegeId, slug: row.slug }, now).filter(({ ref }) => ref.startsWith('batch-56:')),
      archiveRows.filter((archived) => archived.collegeId === row.collegeId), [], now,
    ).filter(({ ref }) => ref === row.ref));
    expect(surviving.map(({ ref }) => ref).sort()).toEqual(facts.map(({ ref }) => ref).sort());
  });

  it('publishes only nonduplicate claims from the five-college structured admissions slice', () => {
    const rows = policy.records.filter(({ ref }) => ref.startsWith('batch-57:'));
    expect(rows).toHaveLength(3);
    expect(batch57.candidateClaims).toHaveLength(4);
    expect(new Set(rows.map(({ slug }) => slug)).size).toBe(3);
    expect(rows.every(({ status, basis, fingerprint, ref }) =>
      status === 'PUBLISH' && basis === 'ATTRIBUTED_INDIVIDUAL_FACT' && fingerprint === sourceReportedFingerprint(ref))).toBe(true);
    expect(batch57.candidateClaims.filter(({ institutionSlug }) => institutionSlug !== 'christian-medical-college').every(({ status, reviewState, stageable }) =>
      status === 'UNREVIEWED' && reviewState === 'UNREVIEWED' && stageable)).toBe(true);
    expect(batch57.candidateClaims.find(({ institutionSlug }) => institutionSlug === 'christian-medical-college'))
      .toMatchObject({ status: 'HELD', reviewState: 'HELD', stageable: false });
    expect(batch57.heldFindings.some(({ institutionSlug, reason }) => institutionSlug === 'christian-medical-college' &&
      reason.includes('cmwm4trcw00053otvyei1v0kf'))).toBe(true);

    const facts = rows.flatMap((row) => eligibleSourceReported({ id: row.collegeId, slug: row.slug }, now)
      .filter(({ ref }) => ref === row.ref));
    expect(facts).toHaveLength(3);
    expect(rows.map(({ slug }) => slug).sort()).toEqual([
      'indian-institute-of-management-ahmedabad',
      'indian-institute-of-technology-bombay',
      'national-law-school-of-india-university',
    ]);
    expect(facts.every(({ status, evidenceLocation, url, academicYear }) =>
      status === 'OFFICIAL_SOURCE_REPORTED' && evidenceLocation.length > 0 && url.startsWith('https://') && academicYear)).toBe(true);
    expect(facts.find(({ ref }) => ref === 'batch-57:0')).toMatchObject({
      historical: true, academicYear: '2026-27', value: {
        kind: 'admission',
        programme: 'Undergraduate programmes (route varies by programme)',
        exam: 'JEE (Advanced) 2026; Preparatory 2025; INMO 2026; UCEED 2026',
      },
    });
    expect(facts.find(({ ref }) => ref === 'batch-57:1')).toMatchObject({
      historical: false, academicYear: '2027-29', value: { kind: 'admission', exam: 'CAT 2026' },
    });
    expect(facts.some(({ ref }) => ref === 'batch-57:2')).toBe(false);
    expect(rows.some(({ ref }) => ref === 'batch-57:2')).toBe(false);
    expect(facts.find(({ ref }) => ref === 'batch-57:3')).toMatchObject({
      academicYear: '2027-28', value: { kind: 'admission', exam: 'CLAT' },
    });
    expect(facts.every(({ value }) => value.kind === 'admission' && value.eligibility === undefined && value.applicationUrl === undefined)).toBe(true);
    expect(facts.find(({ ref }) => ref === 'batch-57:0')?.evidenceLocation)
      .toContain('Information for UG New Entrants 2026–27');
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

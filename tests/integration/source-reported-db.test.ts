import { beforeEach, expect, it } from 'vitest';
import archive from '../../data/pilot/staged-evidence-after-batch-027.json';
import batch058 from '../../data/pilot/substantive-research-batch-058.json';
import type { College } from '@/types';
import { sourceReportedImportManifest } from '@/server/source-reported';
import { publicSourceReportedFacts } from '@/server/source-reported-public';
import { importOfficialFacts, validateOfficialFacts } from '@/server/ingest/official-facts';
import { resetDb, testDb } from './db';

const db = testDb();
const bombay = archive.collegeIdentity.find(({ slug }) => slug === 'indian-institute-of-technology-bombay')!;

beforeEach(resetDb);

it('imports a release-eligible structured fact and projects the persisted value with source-reported status only', async () => {
  const college = await db.college.create({ data: {
    id: bombay.id, slug: bombay.slug, name: 'Indian Institute of Technology Bombay', shortName: 'IIT Bombay',
    city: 'Mumbai', state: 'Maharashtra', type: 'GOVERNMENT', dataStatus: 'DEMO',
  } });
  const manifest = sourceReportedImportManifest([bombay]);
  const candidate = manifest.candidateClaims[0];
  const sourceIds = new Set(candidate.sourceIds as string[]);
  const bounded = { ...manifest, candidateClaims: [candidate], sources: manifest.sources.filter(({ id }) => sourceIds.has(id as string)) };
  const imported = await importOfficialFacts(db, bounded, false);
  expect(imported).toMatchObject({ staged: 1, reviewState: 'UNREVIEWED' });
  expect(await db.evidenceDecision.count()).toBe(0);

  const row = await db.fieldEvidence.findFirstOrThrow({ where: { sourceReportedRef: candidate.sourceReportedRef as string }, include: { source: true } });
  expect(row.collegeId).toBe(college.id);
  expect(row.isFixture).toBe(false);
  expect(row.source.url).toMatch(/^https:\/\//);
  expect(row.evidenceLocator).toBe(candidate.evidenceLocation);
  expect(row.campusScope).toBeTruthy();
  expect(row.applicablePeriod).toBeTruthy();
  const registeredAudit = await db.auditLog.findFirstOrThrow({ where: { targetId: row.id } });
  expect(registeredAudit.metadata).toMatchObject({ reviewState: 'UNREVIEWED', publicationStatus: 'SOURCE_REPORTED_REGISTERED' });

  const projectionInput = { id: college.id, slug: college.slug, structuredFacts: [] } as unknown as College;
  const projected = await publicSourceReportedFacts(projectionInput);
  expect(projected.some((fact) => fact.ref === candidate.sourceReportedRef)).toBe(true);
  expect(projected.find((fact) => fact.ref === candidate.sourceReportedRef)?.status).toBe('OFFICIAL_SOURCE_REPORTED');

  // Imported rows are checked against the release-register allow-list and the
  // exact persisted value; a changed DB value fails closed instead of leaking.
  await db.fieldEvidence.update({ where: { id: row.id }, data: { value: { kind: 'programme', programme: 'Fabricated', level: 'UG' } } });
  const afterTamper = await publicSourceReportedFacts(projectionInput);
  expect(afterTamper.some((fact) => fact.ref === candidate.sourceReportedRef)).toBe(false);
  expect(await db.evidenceDecision.count()).toBe(0);
});

it('keeps newly collected non-register facts as unreviewed candidates, never release-registered', async () => {
  const bombayDemo = (await import('../../src/server/seed/demo-colleges.json')).default.find(({ slug }) => slug === 'indian-institute-of-technology-bombay')!;
  await db.college.create({ data: {
    id: bombay.id, slug: bombay.slug, name: bombayDemo.name, shortName: bombayDemo.shortName,
    city: bombayDemo.city, state: bombayDemo.state, type: bombayDemo.type as 'GOVERNMENT' | 'PRIVATE', dataStatus: 'UNVERIFIED',
  } });
  const source = batch058.sources[0];
  const candidate = batch058.candidateClaims[0];
  const result = await importOfficialFacts(db, { ...batch058, sources: [source], candidateClaims: [candidate] }, false);
  expect(result).toMatchObject({ staged: 1, reviewState: 'UNREVIEWED' });
  const staged = await db.fieldEvidence.findFirstOrThrow({ include: { decisions: true } });
  expect(staged.decisions).toEqual([]);
  expect(staged.sourceReportedRef).toBeNull();
  expect(await db.auditLog.findFirstOrThrow({ where: { targetId: staged.id } })).toMatchObject({
    metadata: { reviewState: 'UNREVIEWED', publicationStatus: 'UNREVIEWED_CANDIDATE', sourceReportedRef: null },
  });
  const publicFacts = await publicSourceReportedFacts({ id: bombay.id, slug: bombay.slug, structuredFacts: [] } as unknown as College);
  expect(publicFacts.some((fact) => JSON.stringify(fact.value) === JSON.stringify(candidate.value))).toBe(false);
});

it('reuses an exact archived claim without duplicating it or reviving its rejection', async () => {
  const amu = archive.collegeIdentity.find(({ slug }) => slug === 'aligarh-muslim-university')!;
  const demo = (await import('../../src/server/seed/demo-colleges.json')).default.find(({ slug }) => slug === amu.slug)!;
  const college = await db.college.create({ data: {
    id: amu.id, slug: amu.slug, name: demo.name, shortName: demo.shortName,
    city: demo.city, state: demo.state, type: demo.type as 'GOVERNMENT' | 'PRIVATE', dataStatus: 'UNVERIFIED',
  } });
  const manifest = sourceReportedImportManifest([amu]);
  const rawClaim = manifest.candidateClaims[0];
  const sourceId = (rawClaim.sourceIds as string[])[0];
  const source = manifest.sources.find(({ id }) => id === sourceId)!;
  const validated = validateOfficialFacts({ ...manifest, sources: [source], candidateClaims: [rawClaim] })[0];
  const oldSource = await db.source.create({ data: {
    name: String(source.title), publisher: String(source.publisher), url: String(source.url),
    retrievedAt: new Date(String(source.retrievedAt)),
  } });
  const old = await db.fieldEvidence.create({ data: {
    collegeId: college.id, field: validated.field, value: validated.claim.value,
    academicYear: validated.academicYear ?? null, programScope: validated.scope,
    sourceId: oldSource.id, identityKey: 'archive-exact-claim', isFixture: false,
    evidenceLocator: validated.claim.evidenceLocation,
  } });
  const reviewer = await db.user.create({ data: { email: 'reviewer@example.test', name: 'Reviewer', password: 'fixture', role: 'ADMIN' } });
  await db.evidenceDecision.create({ data: { evidenceId: old.id, reviewerId: reviewer.id, status: 'REJECTED', reason: 'Synthetic archive duplicate suppression check' } });
  await db.auditLog.create({ data: { action: 'evidence.review', targetType: 'FieldEvidence', targetId: old.id, actorId: reviewer.id, metadata: { status: 'REJECTED' } } });

  const result = await importOfficialFacts(db, { ...manifest, sources: [source], candidateClaims: [rawClaim] }, false);
  expect(result).toMatchObject({ staged: 0, reused: 1, createdSources: 0, createdRuns: 0, databaseChanged: false });
  expect(result.claimResults[0]).toMatchObject({ evidenceId: old.id, status: 'REUSED' });
  expect(await db.fieldEvidence.count()).toBe(1);
  expect(await db.evidenceDecision.count()).toBe(1);
  expect(await db.auditLog.count()).toBe(1);
  expect(await publicSourceReportedFacts({ id: college.id, slug: college.slug, structuredFacts: [] } as unknown as College)).toEqual([]);
});

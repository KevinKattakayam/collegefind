import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb, testDb } from './db';
import { collegeListSelect } from '@/server/colleges';
import { reviewFieldEvidence, stageFieldEvidence } from '@/server/ingest/field-evidence';
import { recordSourceUseAssessment } from '@/server/source-use-review';
import { evidenceQueue } from '@/server/evidence-queue';

const db = testDb();
const session = vi.hoisted(() => ({ id: null as string | null }));
vi.mock('next-auth', () => ({ getServerSession: async () => session.id ? { user: { id: session.id } } : null }));
const sourceUseRoute = await import('@/app/api/admin/source-use/route');
beforeEach(resetDb);
beforeEach(() => { session.id = null; });
afterAll(async () => { await prisma.$disconnect(); await db.$disconnect(); });

it('keeps source-use clearance separate from fact accuracy and withdraws display when the source becomes restricted', async () => {
  const college = await db.college.create({ data: { slug: 'source-use-review', name: 'Source Use Review', shortName: 'SUR', city: 'City', state: 'State', type: 'GOVERNMENT' } });
  const reviewer = await db.user.create({ data: { email: 'source-use-review@example.test', name: 'Disposable reviewer', password: 'fixture', role: 'ADMIN' } });
  const source = await db.source.create({ data: {
    name: 'Candidate PDF source', publisher: 'Official publisher', url: 'https://example.edu/report.pdf', retrievedAt: new Date('2026-11-23T00:00:00.000Z'),
    license: 'Short factual extraction; explicit bulk reuse permission not established', notes: 'Source-use assessment required before public use.',
  } });
  const claim = await stageFieldEvidence(db, { collegeId: college.id, sourceId: source.id, draft: {
    field: 'description', value: 'A source-reported fact', publisher: source.publisher, sourceUrl: source.url,
    retrievedAt: source.retrievedAt.toISOString(), reviewState: 'UNREVIEWED',
  } });
  const projected = () => prisma.college.findUniqueOrThrow({ where: { id: college.id }, select: { ...collegeListSelect, description: true } });
  expect((await projected()).description).toBeNull();
  await expect(reviewFieldEvidence(db, { evidenceId: claim.id, reviewerId: reviewer.id, status: 'APPROVED', reason: 'Accuracy checked against the report' }))
    .rejects.toMatchObject({ code: 'SOURCE_USE_NOT_CLEARED' });

  await recordSourceUseAssessment(db, { sourceId: source.id, reviewerId: reviewer.id, status: 'RESTRICTED', reason: 'Publisher terms restrict public reuse', basisUrl: 'https://example.edu/terms' });
  await expect(reviewFieldEvidence(db, { evidenceId: claim.id, reviewerId: reviewer.id, status: 'APPROVED', reason: 'Accuracy checked against the report' }))
    .rejects.toMatchObject({ code: 'SOURCE_USE_NOT_CLEARED' });

  await recordSourceUseAssessment(db, { sourceId: source.id, reviewerId: reviewer.id, status: 'CLEARED', reason: 'Terms permit concise attributed factual summaries', basisUrl: 'https://example.edu/terms' });
  await reviewFieldEvidence(db, { evidenceId: claim.id, reviewerId: reviewer.id, status: 'APPROVED', reason: 'Value, institution and scope inspected independently' });
  expect((await projected()).description).toBe('A source-reported fact');

  await recordSourceUseAssessment(db, { sourceId: source.id, reviewerId: reviewer.id, status: 'RESTRICTED', reason: 'Newly reviewed terms disallow this public use', basisUrl: 'https://example.edu/terms' });
  expect((await projected()).description).toBeNull();
  expect(await db.evidenceDecision.count({ where: { evidenceId: claim.id, status: 'APPROVED' } })).toBe(1);
  expect(await db.auditLog.count({ where: { action: 'source.use.assessment', targetType: 'Source', targetId: source.id } })).toBe(3);
});

it('requires an active ADMIN session for source-use assessment writes', async () => {
  const source = await db.source.create({ data: { name: 'Route source', publisher: 'Publisher', url: 'https://example.edu/source', retrievedAt: new Date() } });
  const user = await db.user.create({ data: { email: 'source-use-user@example.test', name: 'User', password: 'fixture' } });
  const payload = { sourceId: source.id, status: 'UNRESOLVED', reason: 'Terms need direct review', basisUrl: '' };
  const send = () => sourceUseRoute.POST(new Request('http://localhost/api/admin/source-use', { method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify(payload) }));
  expect((await send()).status).toBe(401);
  session.id = user.id;
  expect((await send()).status).toBe(403);
  await db.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
  expect((await send()).status).toBe(200);
  expect(await db.auditLog.count({ where: { action: 'source.use.assessment', targetId: source.id } })).toBe(1);
});

it('filters Batch 060 claims by fact type, source, academic year, historical state and source-use status', async () => {
  const college = await db.college.create({ data: { slug: 'batch-060-filter', name: 'Batch 060 Filter', shortName: 'B060', city: 'City', state: 'State', type: 'GOVERNMENT' } });
  const reviewer = await db.user.create({ data: { email: 'batch060-filter@example.test', name: 'Disposable reviewer', password: 'fixture', role: 'ADMIN' } });
  const source = await db.source.create({ data: { name: 'NIRF source', publisher: 'Official submitted data', url: 'https://example.edu/nirf.pdf', retrievedAt: new Date('2026-11-23'), license: 'Permission not established' } });
  const metrics = [
    { id: 'cmwm3rj75000bhxtvbr105oe7', metric: 'PLACED_COUNT', value: 70 },
    { id: 'b060-placement-median', metric: 'MEDIAN', value: 900000 },
    { id: 'b060-placement-higher-studies', metric: 'HIGHER_STUDIES_COUNT', value: 8 },
  ] as const;
  for (const entry of metrics) {
    await db.fieldEvidence.create({ data: {
      id: entry.id, collegeId: college.id, sourceId: source.id, field: 'structured.placement',
      value: { kind: 'placement', cohort: 'UG four-year cohort', metric: entry.metric, denominator: 100, value: entry.value, definition: 'Reported cohort metric.' },
      academicYear: 2024, historical: true, programScope: `UG four-year cohort · ${entry.metric}`, campusScope: 'Main campus',
      identityKey: `batch060-filter-identity-${entry.metric}`,
    } });
    await db.auditLog.create({ data: { action: 'official.fact.stage', targetType: 'FieldEvidence', targetId: entry.id, metadata: { sourceManifestId: 'b060-test-source' } } });
  }
  await db.fieldEvidence.create({ data: {
    id: 'cmwthl2rj007a7etvt5e1xc96', collegeId: college.id, sourceId: source.id, field: 'structured.fee',
    value: { kind: 'fee', programme: 'B.Tech', category: 'OPEN', component: 'Tuition', feeType: 'TUITION', period: 'SEMESTER', amountInr: 62500 },
    academicYear: 2026, historical: false, programScope: 'B.Tech fee', identityKey: 'nit-trichy-claim-specific-hold',
  } });
  await db.auditLog.create({ data: { action: 'official.fact.stage', targetType: 'FieldEvidence', targetId: 'cmwthl2rj007a7etvt5e1xc96', metadata: { sourceManifestId: 'b060-test-source' } } });
  const matching = await evidenceQueue(db, { batch: '060', factType: 'placement', program: 'four-year', source: 'nirf', academicYear: 2024, historical: 'HISTORICAL', sourceUse: 'UNASSESSED', status: 'ALL' });
  expect(matching.total).toBe(3);
  expect(matching.items.map(({ id }) => id)).toEqual(expect.arrayContaining(metrics.map(({ id }) => id)));
  expect(matching.items.every(({ sourceUseStatus, historical }) => sourceUseStatus === 'UNASSESSED' && historical)).toBe(true);
  expect(matching.placementCohorts).toHaveLength(1);
  expect(matching.placementCohorts[0]).toMatchObject({ collegeSlug: college.slug, cohort: 'UG four-year cohort', academicYear: 2024, sourceUseStatus: 'UNASSESSED' });
  expect(matching.placementCohorts[0].claims).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'cmwm3rj75000bhxtvbr105oe7', metric: 'PLACED_COUNT', value: 70, denominator: 100, reviewState: 'HELD', holdReason: expect.stringContaining('complete 2024–25 annual report') }),
    expect.objectContaining({ id: 'b060-placement-median', metric: 'MEDIAN', value: 900000, denominator: 100, reviewState: 'STAGED' }),
    expect.objectContaining({ id: 'b060-placement-higher-studies', metric: 'HIGHER_STUDIES_COUNT', value: 8, denominator: 100, reviewState: 'STAGED' }),
  ]));
  expect((await evidenceQueue(db, { batch: '060', factType: 'fee', status: 'ALL' })).total).toBe(1);
  expect((await evidenceQueue(db, { batch: '060', status: 'HELD' })).items.map(({ id }) => id).sort()).toEqual(['cmwthl2rj007a7etvt5e1xc96', 'cmwm3rj75000bhxtvbr105oe7'].sort());
  await recordSourceUseAssessment(db, { sourceId: source.id, reviewerId: reviewer.id, status: 'RESTRICTED', reason: 'Terms prohibit display', basisUrl: 'https://example.edu/terms' });
  expect((await evidenceQueue(db, { batch: '060', sourceUse: 'RESTRICTED', status: 'ALL' })).items.map(({ id }) => id).sort()).toEqual([...metrics.map(({ id }) => id), 'cmwthl2rj007a7etvt5e1xc96'].sort());
});

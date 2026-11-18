import { readFileSync } from 'node:fs';
import { beforeEach, expect, it } from 'vitest';
import { projectPublicCollege } from '@/server/public-evidence';
import { importOfficialFacts } from '@/server/ingest/official-facts';
import { reviewFieldEvidence } from '@/server/ingest/field-evidence';
import { testDb, resetDb } from './db';

const db = testDb();
type Candidate = {
  institutionSlug: string; field: string; value: string | string[]; sourceIds: string[];
  academicYear: string | null; evidenceLocation: string; status: string;
  reviewState: string; stageable: boolean;
};
type Research = { candidateClaims: Candidate[]; typedResearchFindings: Record<string, unknown>[]; sources: { retrievedAt: string }[] };
type SeedCollege = {
  slug: string; name: string; shortName: string; city: string; state: string;
  type: 'GOVERNMENT' | 'PRIVATE'; courses: string[]; website: string | null;
};
const research = JSON.parse(readFileSync('data/pilot/substantive-research-batch-001.json', 'utf8')) as Research;
const now = new Date('2026-11-18T00:00:00.000Z');

beforeEach(resetDb);

async function seedResearchColleges() {
  const seed = JSON.parse(readFileSync('src/server/seed/demo-colleges.json', 'utf8')) as SeedCollege[];
  const slugs = [...new Set(research.candidateClaims.map((claim) => claim.institutionSlug))];
  for (const slug of slugs) {
    const row = seed.find((college) => college.slug === slug);
    if (!row) throw new Error(`Missing catalogue fixture ${slug}`);
    await db.college.create({ data: {
      slug: row.slug, name: row.name, shortName: row.shortName, city: row.city, state: row.state,
      type: row.type, courses: row.courses, website: row.website, dataStatus: 'DEMO',
    } });
  }
}

it('stages only researched profile facts, idempotently, without publishing or mutating demo summaries', async () => {
  await seedResearchColleges();
  const dryRun = await importOfficialFacts(null, research, true, now);
  expect(dryRun).toEqual({ status: 'DRY_RUN', facts: 11, reviewState: 'UNREVIEWED' });
  expect(await db.source.count()).toBe(0);

  const first = await importOfficialFacts(db, research, false, now);
  expect(first).toMatchObject({ status: 'STAGED', facts: 11, reviewState: 'UNREVIEWED', staged: 11, reused: 0 });
  expect(first.claimResults).toHaveLength(11);
  expect(first.claimResults.every((claim) => claim.status === 'STAGED')).toBe(true);
  const second = await importOfficialFacts(db, research, false, now);
  expect(second).toMatchObject({ staged: 0, reused: 11, createdSources: 0, createdRuns: 0, repairedRuns: 0, databaseChanged: false });
  expect(second.claimResults.every((claim) => claim.status === 'REUSED')).toBe(true);
  expect(await db.fieldEvidence.count()).toBe(11);
  expect(await db.auditLog.count({ where: { action: 'official.fact.stage' } })).toBe(11);
  expect(await db.evidenceDecision.count()).toBe(0);
  expect(await db.importRun.count()).toBe(10);
  const runs = await db.importRun.findMany({ select: { startedAt: true, finishedAt: true } });
  expect(runs.every((run) => run.finishedAt !== null && run.finishedAt >= run.startedAt)).toBe(true);

  const courseClaim = await db.fieldEvidence.findFirstOrThrow({
    where: { field: 'courses' }, include: { source: true, decisions: true },
  });
  expect(courseClaim.isFixture).toBe(false);
  expect(courseClaim.evidenceLocator).toContain('B.Tech');
  expect(courseClaim.source.url).toMatch(/^https:\/\//);
  expect(courseClaim.decisions).toHaveLength(0);
  const college = await db.college.findUniqueOrThrow({
    where: { id: courseClaim.collegeId },
    include: { evidence: { include: { source: true, decisions: true } }, feesRecords: { include: { source: true, decisions: true } } },
  });
  const publicView = projectPublicCollege(college as unknown as Record<string, unknown>, now);
  expect(publicView.dataStatus).toBe('DEMO');
  expect(publicView.courses).toEqual([]);
  expect(publicView.fieldEvidence).toMatchObject({ courses: { status: 'UNREVIEWED' } });
  expect(publicView.website).toBeNull();

  const colleges = await db.college.findMany({ include: { evidence: { include: { source: true, decisions: true } } } });
  for (const researchedCollege of colleges) {
    const projected = projectPublicCollege(researchedCollege as unknown as Record<string, unknown>, now);
    for (const claim of researchedCollege.evidence) {
      expect((projected.fieldEvidence as Record<string, { status: string }>)[claim.field]?.status).toBe('UNREVIEWED');
      if (claim.field === 'courses') expect(projected.courses).toEqual([]);
      else expect(projected[claim.field]).toBeNull();
    }
  }

  // Synthetic approval exists only in the disposable integration database.
  const syntheticReviewer = await db.user.create({ data: {
    name: 'Synthetic reviewer', email: 'synthetic-reviewer@collegefind.test', password: 'synthetic-test-only', role: 'ADMIN',
  } });
  await reviewFieldEvidence(db, {
    evidenceId: courseClaim.id, reviewerId: syntheticReviewer.id, status: 'APPROVED',
    reason: 'Synthetic integration approval; never genuine college verification',
  });
  const approvedCollege = await db.college.findUniqueOrThrow({
    where: { id: courseClaim.collegeId }, include: { evidence: { include: { source: true, decisions: true } } },
  });
  const published = projectPublicCollege(approvedCollege as unknown as Record<string, unknown>, now);
  expect(published.dataStatus).toBe('DEMO');
  expect(published.courses).toEqual(courseClaim.value);
  expect(published.fieldEvidence).toMatchObject({
    courses: { status: 'AVAILABLE', sources: [{ url: courseClaim.source.url, publisher: courseClaim.source.publisher }] },
  });
  expect(await db.auditLog.count({ where: { action: 'evidence.review', targetId: courseClaim.id } })).toBe(1);
  const staleView = projectPublicCollege(approvedCollege as unknown as Record<string, unknown>, new Date('2029-11-18T00:00:00.000Z'));
  expect(staleView.courses).toEqual([]);
  expect(staleView.fieldEvidence).toMatchObject({ courses: { status: 'OUTDATED' } });
});

it('rejects unsupported fee fields, reviewer-state injection, mismatched institutions and future collection dates', async () => {
  await seedResearchColleges();
  const feeClaim = research.typedResearchFindings[0];
  const withFee = { ...structuredClone(research), candidateClaims: [
    ...structuredClone(research).candidateClaims,
    { ...feeClaim, stageable: true, status: 'RESEARCHED_READY_FOR_UNREVIEWED_STAGING' },
  ] };
  await expect(importOfficialFacts(null, withFee, true, now)).rejects.toThrow();

  const approved = structuredClone(research);
  approved.candidateClaims[0].reviewState = 'APPROVED';
  await expect(importOfficialFacts(null, approved, true, now)).rejects.toThrow();

  const mismatched = structuredClone(research);
  mismatched.candidateClaims[0].institutionSlug = 'different-college';
  await expect(importOfficialFacts(null, mismatched, true, now)).rejects.toThrow('Claim/source institution mismatch');

  const future = structuredClone(research);
  future.sources[0].retrievedAt = '2099-01-01T00:00:00.000Z';
  await expect(importOfficialFacts(null, future, true, now)).rejects.toThrow('Invalid source identity or collection time');
  expect(await db.source.count()).toBe(0);
  expect(await db.fieldEvidence.count()).toBe(0);
});

it('reconciles typed scopes, concurrent retries, rollback and reviewed projection', async () => {
  await seedResearchColleges();
  const original = research.candidateClaims[0];
  const source = research.sources.find((item) => (item as { id?: string }).id === original.sourceIds[0])!;
  const programme = {
    ...original, field: 'structured', academicYear: null,
    value: { kind: 'programme', programme: 'Synthetic Engineering', level: 'UG', durationMonths: 48 },
  };
  const manifest = { ...research, sources: [source], candidateClaims: [programme] };
  await expect(importOfficialFacts(null, { ...manifest, candidateClaims: [{ ...programme, value: { ...programme.value, durationMonths: 0 } }] }, true, now)).rejects.toThrow();
  await expect(importOfficialFacts(null, { ...manifest, candidateClaims: [{ ...programme, value: { kind: 'nirfRanking', category: 'Engineering', rank: 1 } }] }, true, now)).rejects.toThrow('requires a reporting');
  await expect(importOfficialFacts(db, { ...manifest, sources: [source, { ...source, id: 'unknown', institutionSlug: 'missing' }], candidateClaims: [
    programme, { ...programme, institutionSlug: 'missing', sourceIds: ['unknown'] },
  ] }, false, now)).rejects.toThrow();
  expect(await db.fieldEvidence.count()).toBe(0);
  expect(await db.source.count()).toBe(0);
  expect(await db.importRun.count()).toBe(0);

  const results = await Promise.all([importOfficialFacts(db, manifest, false, now), importOfficialFacts(db, manifest, false, now)]);
  expect(results.map((result) => result.staged).sort()).toEqual([0, 1]);
  expect(results[0].claimResults[0].evidenceId).toEqual(results[1].claimResults[0].evidenceId);
  const conflict = await importOfficialFacts(db, { ...manifest, candidateClaims: [
    { ...programme, value: { ...programme.value, durationMonths: 60 } },
  ] }, false, now);
  const { evidenceQueue } = await import('@/server/evidence-queue');
  expect((await evidenceQueue(db, { status: 'CONFLICT', q: 'structured.programme' })).total).toBe(2);
  const ids = [results[0].claimResults[0].evidenceId, conflict.claimResults[0].evidenceId];
  const reviewer = await db.user.create({ data: { name: 'Synthetic', email: 'typed-admin@example.test', password: 'synthetic', role: 'ADMIN' } });
  const member = await db.user.create({ data: { name: 'Synthetic', email: 'typed-member@example.test', password: 'synthetic' } });
  async function visible() {
    const college = await db.college.findUniqueOrThrow({
      where: { slug: original.institutionSlug }, include: { evidence: { include: { source: true, decisions: true } } },
    });
    return projectPublicCollege(college as unknown as Record<string, unknown>, now).structuredFacts;
  }
  async function decide(evidenceId: string, status: 'APPROVED' | 'REJECTED', reviewerId = reviewer.id) {
    return reviewFieldEvidence(db, { reviewerId, evidenceId, status, reason: 'Synthetic typed integration test' });
  }
  await expect(decide(ids[0], 'APPROVED', member.id)).rejects.toThrow('Reviewer access');
  expect(await visible()).toEqual([]);
  await expect(decide(ids[0], 'APPROVED')).rejects.toThrow(/Conflicting evidence remains unresolved/);
  await decide(ids[1], 'REJECTED');
  await decide(ids[0], 'APPROVED');
  expect(await visible()).toMatchObject([{ value: programme.value, source: { url: results[0].claimResults[0].sourceUrl } }]);
  await expect(decide(ids[1], 'APPROVED')).rejects.toThrow(/Conflicting evidence remains unresolved/);
  expect(await visible()).toMatchObject([{ value: programme.value }]);
  await decide(ids[0], 'REJECTED');
  await decide(ids[1], 'APPROVED');
  expect(await visible()).toMatchObject([{ value: { ...programme.value, durationMonths: 60 } }]);
  await db.fieldEvidence.update({ where: { id: ids[0] }, data: { isFixture: true } });
  await expect(decide(ids[0], 'APPROVED')).rejects.toThrow('Fixture evidence');
  expect(await visible()).toMatchObject([{ value: { ...programme.value, durationMonths: 60 } }]);
  expect(await db.auditLog.count({ where: { action: 'evidence.review' } })).toBe(4);
});

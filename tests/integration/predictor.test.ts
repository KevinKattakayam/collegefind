import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findPublicRankObservation } from '@/server/cutoffs';
import { resetDb, testDb } from './db';

const db = testDb();

beforeAll(async () => { await resetDb(); });
afterAll(async () => { await resetDb(); await db.$disconnect(); });

describe('reviewed historical rank guidance', () => {
  it('isolates exact seat dimensions and withholds unsupported and revoked observations', async () => {
    const reviewer = await db.user.create({ data: { name: 'Synthetic test reviewer', email: 'guidance@example.test', role: 'ADMIN', password: 'fixture-only' } });
    const source = await db.source.create({ data: { name: 'Synthetic test evidence', url: 'https://example.test/cutoffs', publisher: 'Synthetic test authority', retrievedAt: new Date('2026-01-01') } });
    const college = await db.college.create({ data: { slug: 'guidance-test', name: 'Synthetic Guidance Test', shortName: 'SGT', city: 'Test City', state: 'Test State', type: 'GOVERNMENT' } });
    const program = await db.program.create({ data: { collegeId: college.id, name: 'Test programme' } });
    const scope = { programId: program.id, sourceId: source.id, exam: 'JEE_MAIN', counsellingSystem: 'JOSAA', rankType: 'PWD_CATEGORY',
      year: 2025, round: 2, quota: 'HS', category: 'SC', isPwd: true, seatPool: 'FEMALE_ONLY', openingValue: 25, closingValue: 100 } as const;
    await db.cutoffRecord.createMany({ data: [
      { ...scope, id: 'exact' },
      { ...scope, id: 'different', counsellingSystem: 'CSAB', rankType: 'CRL', quota: 'OS', category: 'OPEN', isPwd: false, seatPool: 'GENDER_NEUTRAL', year: 2024, round: 3 },
      { ...scope, id: 'staged', year: 2023 },
      { ...scope, id: 'preparatory', year: 2022, isPreparatory: true },
      { ...scope, id: 'legacy', year: 2021, rankType: 'UNSPECIFIED' },
      { ...scope, id: 'score', year: 2020, metric: 'SCORE' },
      { ...scope, id: 'future-source', year: 2019 },
    ] });
    await db.evidenceDecision.createMany({ data: ['exact', 'different', 'preparatory', 'legacy', 'score', 'future-source'].map((cutoffId) => ({
      cutoffId, reviewerId: reviewer.id, status: 'APPROVED', reason: 'Synthetic test only', createdAt: new Date('2026-02-01'),
    })) });
    const future = await db.source.create({ data: { name: 'Future test source', url: 'https://example.test/future', publisher: 'Synthetic test authority', retrievedAt: new Date('2100-01-01') } });
    await db.cutoffRecord.update({ where: { id: 'future-source' }, data: { sourceId: future.id } });
    expect(await findPublicRankObservation(db, 'exact')).toMatchObject({ exam: 'JEE_MAIN', counsellingSystem: 'JOSAA', rankType: 'PWD_CATEGORY',
      year: 2025, round: 2, quota: 'HS', category: 'SC', isPwd: true, seatPool: 'FEMALE_ONLY', openingValue: 25, closingValue: 100, source: { url: source.url }, program: { id: program.id } });
    expect(await findPublicRankObservation(db, 'different')).toMatchObject({ counsellingSystem: 'CSAB', rankType: 'CRL', year: 2024 });
    for (const id of ['staged', 'preparatory', 'legacy', 'score', 'future-source', 'missing']) expect(await findPublicRankObservation(db, id)).toBeNull();
    await db.evidenceDecision.create({ data: { cutoffId: 'exact', reviewerId: reviewer.id, status: 'REJECTED', reason: 'Synthetic revocation', createdAt: new Date('2026-03-01') } });
    expect(await findPublicRankObservation(db, 'exact')).toBeNull();
    await db.college.update({ where: { id: college.id }, data: { dataStatus: 'DEMO' } });
    expect(await findPublicRankObservation(db, 'different')).toBeNull();
  });
});

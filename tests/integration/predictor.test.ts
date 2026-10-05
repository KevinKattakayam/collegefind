import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { predict } from '@/lib/predictor/service';
import { predictQuerySchema } from '@/lib/validation';
import { seedSyntheticCutoffs } from '@/server/seed/demo';
import { resetDb, testDb } from './db';

const db = testDb();
const q = (o: Record<string, string>) => predictQuerySchema.parse(o);

beforeAll(async () => {
  await resetDb();
  await seedSyntheticCutoffs(db);
});
afterAll(async () => {
  await db.$disconnect();
});

describe('predict (database-driven)', () => {
  it('reports no data for an exam with no cutoff records', async () => {
    const r = await predict(q({ exam: 'NEET', rank: '1000' }), db);
    expect(r.meta.hasData).toBe(false);
    expect(r.results).toEqual([]);
  });

  it('targets the year after the latest data and explains its assumptions', async () => {
    const r = await predict(q({ exam: 'JEE_MAIN', rank: '12000' }), db);
    expect(r.meta.latestDataYear).toBe(2025);
    expect(r.meta.targetYear).toBe(2026);
    expect(r.meta.assumptions.join(' ')).toContain('preparatory');
    expect(r.meta.disclaimer).toMatch(/not guarantees/i);
  });

  it('gives a better rank more and safer options than a worse rank', async () => {
    const good = await predict(q({ exam: 'JEE_MAIN', rank: '8000' }), db);
    const poor = await predict(q({ exam: 'JEE_MAIN', rank: '150000' }), db);
    expect(good.total).toBeGreaterThan(poor.total);
    expect(good.results.filter((r) => r.band === 'SAFE').length).toBeGreaterThan(0);
    expect(poor.results.every((r) => r.band !== 'SAFE')).toBe(true);
  });

  it('category rank changes the result (the old predictor ignored category)', async () => {
    const open = await predict(q({ exam: 'JEE_MAIN', rank: '60000' }), db);
    const obc = await predict(q({ exam: 'JEE_MAIN', rank: '60000', category: 'OBC_NCL', categoryRank: '9000' }), db);
    expect(obc.results.some((r) => r.seat.category === 'OBC_NCL')).toBe(true);
    expect(JSON.stringify(obc.results)).not.toEqual(JSON.stringify(open.results));
  });

  it('female candidates can additionally match female-only seats', async () => {
    const neutral = await predict(q({ exam: 'JEE_MAIN', rank: '30000' }), db);
    const female = await predict(q({ exam: 'JEE_MAIN', rank: '30000', gender: 'FEMALE' }), db);
    expect(neutral.results.every((r) => r.seat.seatPool === 'GENDER_NEUTRAL')).toBe(true);
    expect(female.total).toBeGreaterThanOrEqual(neutral.total);
  });

  it('home state controls which quota seats are offered', async () => {
    const none = await predict(q({ exam: 'JEE_MAIN', rank: '30000' }), db);
    expect(none.results.every((r) => r.seat.quota !== 'HS')).toBe(true);
    const kerala = await predict(q({ exam: 'JEE_MAIN', rank: '30000', homeState: 'Kerala' }), db);
    expect(kerala.results.some((r) => r.seat.quota === 'HS')).toBe(true);
    // Home-state seats are only offered for colleges in that state.
    for (const r of kerala.results.filter((x) => x.seat.quota === 'HS')) {
      expect(r.college.state).toBe('Kerala');
    }
  });

  it('filters by branch, state and budget in the database', async () => {
    const r = await predict(q({ exam: 'JEE_MAIN', rank: '80000', branches: 'Mechanical', states: 'Tamil Nadu', maxFees: '100000' }), db);
    expect(r.results.length).toBeGreaterThan(0);
    for (const x of r.results) {
      expect(x.program.branch).toContain('Mechanical');
      expect(x.college.state).toBe('Tamil Nadu');
      expect(x.college.annualFees ?? 0).toBeLessThanOrEqual(100000);
    }
  });

  it('uses the final round of each year and cites a source for every estimate', async () => {
    const r = await predict(q({ exam: 'JEE_MAIN', rank: '12000' }), db);
    const first = r.results[0];
    expect(first.history.every((h) => h.round === 5)).toBe(true);
    expect(first.history.length).toBe(3);
    expect(first.history.every((h) => h.source.url.length > 0)).toBe(true);
    expect(first.explanation).toContain('2025');
  });

  it('respects the limit and sorts by probability', async () => {
    const r = await predict(q({ exam: 'JEE_MAIN', rank: '40000', limit: '2', includeUnlikely: 'true' }), db);
    expect(r.results.length).toBeLessThanOrEqual(2);
    for (let i = 1; i < r.results.length; i++) {
      expect(r.results[i].probability).toBeLessThanOrEqual(r.results[i - 1].probability);
    }
  });

  it('returns one row per program (the best eligible seat), not one per seat type', async () => {
    const r = await predict(q({ exam: 'JEE_MAIN', rank: '30000', gender: 'FEMALE', category: 'OBC_NCL', categoryRank: '9000', includeUnlikely: 'true' }), db);
    const ids = r.results.map((x) => x.program.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

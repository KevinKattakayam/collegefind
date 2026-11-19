import { describe, expect, it } from 'vitest';
import { evaluateFit, fitQuery, fitWeight } from '@/lib/college-fit';
import { compareHistoricalRank, historicalRank } from '@/lib/historical-rank';
import { projectPublicCollege } from '@/server/public-evidence';
import type { College } from '@/types';

const now = new Date('2026-11-01');
const college = { name: 'Example campus', city: 'Kochi', state: 'Kerala', type: 'GOVERNMENT',
  dataStatus: 'UNVERIFIED', annualFees: 1, courses: ['Computer Science'] } as College;
const claim = {
  id: 'p1', field: 'structured.programme', programScope: 'B.Tech Computer Science',
  value: { kind: 'programme', programme: 'B.Tech Computer Science', level: 'UG' },
  academicYear: 2026, publishedAt: null, validFrom: null, validUntil: null, supersedesId: null,
  decisions: [{ status: 'APPROVED', createdAt: new Date('2026-01-03') }],
  source: { url: 'https://college.example/programme', publisher: 'Example institution', retrievedAt: new Date('2026-01-02') },
};
const prefs = fitQuery.parse({ programme: 'B.Tech Computer Science', degree: 'UG', budget: '90000', year: '2026', feeCategory: 'General' });

describe('CollegeFit', () => {
  it('normalizes active priorities, reports identity mismatches and reproduces the result', () => {
    const q = fitQuery.parse({ location: '  kERALA ', type: 'PRIVATE', priority: 'identity' });
    const reasons = evaluateFit(college, q);
    expect(reasons.map(({ state }) => state)).toEqual(['MATCH', 'MISMATCH']);
    expect(evaluateFit(college, q)).toEqual(reasons);
    expect(fitWeight(reasons, q.priority)).toBe(0.5);
    expect(evaluateFit(college, { ...q, location: 'Delhi' })[0].state).toBe('MISMATCH');
  });

  it('excludes legacy, staged, fixture, expired, rejected and conflicting evidence', () => {
    for (const evidence of [
      [], [{ ...claim, isFixture: true }], [{ ...claim, decisions: [] }],
      [{ ...claim, validUntil: new Date('2026-10-01') }],
      [{ ...claim, decisions: [{ status: 'REJECTED', createdAt: now }] }],
      [claim, { ...claim, id: 'conflict', value: { ...claim.value, level: 'PG' } }],
    ]) {
      const projected = projectPublicCollege({ ...college, evidence }, now);
      const reasons = evaluateFit(projected, prefs);
      expect(reasons.map(({ state }) => state)).toEqual(['UNKNOWN', 'UNKNOWN']);
      expect(fitWeight(reasons, '')).toBeNull();
    }
  });

  it('requires comparable annual fees and distinguishes a reviewed budget mismatch from unknown', () => {
    const fee = { ...claim, id: 'fee', field: 'structured.fee', value: { kind: 'fee', programme: 'B.Tech Computer Science',
      feeType: 'TUITION', category: 'General', period: 'YEAR', component: 'Tuition fee', amountInr: 100000 } };
    const reviewed = projectPublicCollege({ ...college, evidence: [claim, fee] }, now);
    const reasons = evaluateFit(reviewed, prefs);
    expect(reasons.map(({ state }) => state)).toEqual(['MATCH', 'MISMATCH']);
    expect(reasons[1].facts?.[0]).toMatchObject({ academicYear: 2026, source: { url: claim.source.url } });
    expect(fitWeight(reasons, 'programme')).toBe(2 / 3);
    expect(fitWeight(reasons, 'budget')).toBe(1 / 3);
    expect(evaluateFit(reviewed, { ...prefs, budget: 100000 })[1].state).toBe('MATCH');
    for (const q of [{ ...prefs, year: 2025 }, { ...prefs, feeCategory: 'SC' }, { ...prefs, programme: 'Computer' }]) {
      expect(fitWeight(evaluateFit(reviewed, q), '')).toBeNull();
    }
    expect(evaluateFit({ ...reviewed, dataStatus: 'DEMO' }, prefs).map(({ state }) => state)).toEqual(['UNKNOWN', 'UNKNOWN']);
  });
});

describe('historical rank comparison', () => {
  it('validates rank format and compares only the published range', () => {
    for (const input of ['', '0', '1e4', '4.5', '3000001']) expect(historicalRank.safeParse(input).success).toBe(false);
    expect(historicalRank.parse(' 115 ')).toBe(115);
    expect(compareHistoricalRank(50, 100, 200)).toContain('lower than the published opening');
    expect(compareHistoricalRank(115, 100, 200)).toContain('within');
    expect(compareHistoricalRank(200, 100, 200)).toContain('equals');
    expect(compareHistoricalRank(201, 100, 200)).toContain('higher');
    expect(compareHistoricalRank(50, null, 200)).toContain('opening rank was not published');
  });
});

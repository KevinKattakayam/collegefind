import { describe, expect, it, vi } from 'vitest';
import { eligibleSeatTypes, explain, metricForExam } from '@/lib/predictor/service';
import { predictQuerySchema } from '@/lib/validation';

const q = (o: Record<string, string>) => predictQuerySchema.parse(o);

describe('metricForExam', () => {
  it('uses ranks for JoSAA/MCC exams and scores for CAT/GATE', () => {
    expect(metricForExam('JEE_MAIN')).toBe('RANK');
    expect(metricForExam('NEET')).toBe('RANK');
    expect(metricForExam('CAT')).toBe('PERCENTILE');
    expect(metricForExam('GATE')).toBe('SCORE');
  });
});

describe('eligibleSeatTypes', () => {
  it('OPEN candidate without gender: gender-neutral OPEN seats only, using CRL', () => {
    const s = eligibleSeatTypes(q({ exam: 'JEE_MAIN', rank: '5000' }), 'RANK');
    expect(s).toEqual([{ category: 'OPEN', isPwd: false, seatPool: 'GENDER_NEUTRAL', value: 5000, valueLabel: 'CRL / All India Rank' }]);
  });

  it('female candidates are also eligible for female-only seats', () => {
    const s = eligibleSeatTypes(q({ exam: 'JEE_MAIN', rank: '5000', gender: 'FEMALE' }), 'RANK');
    expect(s.map((x) => x.seatPool).sort()).toEqual(['FEMALE_ONLY', 'GENDER_NEUTRAL']);
  });

  it('reserved-category candidates compete for OPEN seats with CRL and category seats with category rank', () => {
    const s = eligibleSeatTypes(q({ exam: 'JEE_MAIN', rank: '40000', category: 'OBC_NCL', categoryRank: '9000' }), 'RANK');
    expect(s).toContainEqual(expect.objectContaining({ category: 'OPEN', value: 40000 }));
    expect(s).toContainEqual(expect.objectContaining({ category: 'OBC_NCL', value: 9000 }));
  });

  it('without a category rank, reserved seats are not evaluated (instead of silently using CRL)', () => {
    const s = eligibleSeatTypes(q({ exam: 'JEE_MAIN', rank: '40000', category: 'SC' }), 'RANK');
    expect(s.every((x) => x.category === 'OPEN')).toBe(true);
  });

  it('PwD seats use the PwD rank', () => {
    const s = eligibleSeatTypes(q({ exam: 'JEE_MAIN', rank: '40000', category: 'EWS', categoryRank: '6000', isPwd: 'true', pwdRank: '120' }), 'RANK');
    expect(s).toContainEqual(expect.objectContaining({ category: 'EWS', isPwd: true, value: 120 }));
  });

  it('score exams use the same score for every eligible seat', () => {
    const s = eligibleSeatTypes(q({ exam: 'CAT', score: '97.5', category: 'SC' }), 'PERCENTILE');
    expect(new Set(s.map((x) => x.value))).toEqual(new Set([97.5]));
    expect(s.map((x) => x.category).sort()).toEqual(['OPEN', 'SC']);
  });

  it('score-based PwD candidates can use both eligible pools and retain score labels', () => {
    const seats = eligibleSeatTypes(q({ exam: 'GATE', score: '650', category: 'SC', isPwd: 'true', gender: 'FEMALE' }), 'SCORE');
    expect(seats).toHaveLength(6);
    expect(seats.every((seat) => seat.value === 650 && seat.valueLabel === 'score')).toBe(true);
    expect(seats.some((seat) => seat.category === 'SC' && seat.isPwd && seat.seatPool === 'FEMALE_ONLY')).toBe(true);
  });
});

describe('explain', () => {
  it('produces a plain-language explanation with the numbers used', () => {
    const text = explain(
      {
        program: { id: 'p', name: 'CSE', branch: 'Computer Science and Engineering', degree: null },
        college: { id: 'c', slug: 's', name: 'X', shortName: 'X', city: 'C', state: 'S', type: 'GOVERNMENT', annualFees: null, dataStatus: 'VERIFIED' },
        seat: { quota: 'AI', category: 'OPEN', isPwd: false, seatPool: 'GENDER_NEUTRAL', valueUsed: 4800, valueLabel: 'CRL / All India Rank' },
        probability: 0.62,
        band: 'TARGET',
        confidence: 'MEDIUM',
        estimate: { expected: 5150, low: 4500, high: 5900, targetYear: 2026 },
        history: [
          { year: 2024, round: 6, closing: 4870, source: { name: 'n', publisher: 'p', url: 'u' } },
          { year: 2025, round: 6, closing: 5300, source: { name: 'n', publisher: 'p', url: 'u' } },
        ],
      },
      'RANK',
    );
    expect(text).toContain('2024: 4,870');
    expect(text).toContain('5,150');
    expect(text).toContain('about 62%');
    expect(text).toContain('better than');
  });
});

describe('probability presentation', () => {
  it('never claims 0% or 100% certainty', async () => {
    const { predict } = await import('@/lib/predictor/service');
    // Stub just enough of the client surface the service uses.
    const db = {
      cutoffRecord: {
        aggregate: async () => ({ _max: { year: 2025 } }),
        findMany: async (args: { select?: Record<string, unknown> }) =>
          args.select && 'programId' in args.select && Object.keys(args.select).length === 1
            ? [{ programId: 'p1' }]
            : [
                {
                  programId: 'p1', year: 2025, round: 6, quota: 'AI', category: 'OPEN', isPwd: false,
                  seatPool: 'GENDER_NEUTRAL', closingValue: 50000,
                  program: {
                    id: 'p1', name: 'CSE', branch: 'CSE', degree: null,
                    college: { id: 'c1', slug: 'c', name: 'C', shortName: 'C', city: 'X', state: 'Y', type: 'GOVERNMENT', annualFees: null, dataStatus: 'VERIFIED' },
                  },
                  source: { name: 'n', publisher: 'p', url: 'u' },
                },
              ],
      },
    };
    // Rank far better than the cutoff would otherwise round to 100%.
    const r = await predict(predictQuerySchema.parse({ exam: 'JEE_MAIN', rank: '1' }), db as never);
    expect(r.results[0].probability).toBeLessThanOrEqual(0.97);
    expect(r.results[0].explanation).not.toContain('100%');
  });

  it('reports plausible-data absence, requested round and production demo exclusion', async () => {
    const { predict } = await import('@/lib/predictor/service');
    const findMany = vi.fn(async (args: { select?: Record<string, unknown> }) => {
      if (args.select && 'year' in args.select) return [{ year: 2025 }];
      if (args.select && 'programId' in args.select) return [];
      throw new Error('Unexpected prediction query');
    });
    const oldNodeEnv = process.env.NODE_ENV;
    try {
      Reflect.set(process.env, 'NODE_ENV', 'production');
      const query = predictQuerySchema.parse({ exam: 'JEE_MAIN', rank: '1000', category: 'SC', homeState: 'Goa', round: '2' });
      const result = await predict(query, { cutoffRecord: { findMany } } as never);
      expect(result.meta.hasData).toBe(true);
      expect(result.results).toEqual([]);
      expect(result.meta.assumptions).toContain('Using round 2 closing values only.');
      expect(result.meta.assumptions.some((line) => line.includes('No category rank given'))).toBe(true);
      const candidateQuery = findMany.mock.calls[1][0] as { where: { AND: unknown[] } };
      expect(JSON.stringify(candidateQuery.where)).toContain('DEMO');
      expect(JSON.stringify(candidateQuery.where)).toContain('GO');
    } finally {
      if (oldNodeEnv === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV');
      else Reflect.set(process.env, 'NODE_ENV', oldNodeEnv);
    }
  });
});

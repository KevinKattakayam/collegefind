import { describe, expect, it } from 'vitest';
import { buildCollegeOrderBy, buildCollegeWhere } from '@/server/colleges';
import { collegesQuerySchema } from '@/lib/validation';

describe('college query construction', () => {
  it('combines search, location, type, trusted metric, course and exam constraints', () => {
    const query = collegesQuerySchema.parse({
      search: 'IIT', state: 'Kerala', type: 'GOVERNMENT', minFees: '100', maxFees: '500',
      naac: 'A+,A', minRating: '4', courses: 'B.Tech,M.Tech', exams: 'JEE_MAIN,JEE_ADVANCED',
    });
    const where = buildCollegeWhere(query) as { AND: Array<Record<string, unknown>> };
    expect(where.AND).toEqual(expect.arrayContaining([
      { dataStatus: { not: 'DEMO' } },
      { state: { equals: 'Kerala', mode: 'insensitive' } },
      { type: 'GOVERNMENT' },
      { annualFees: { gte: 100, lte: 500 } },
      { naacGrade: { in: ['A+', 'A'] } },
      { rating: { gte: 4 } },
      { courses: { hasSome: ['B.Tech', 'M.Tech'] } },
      { programs: { some: { cutoffs: { some: { exam: { in: ['JEE_MAIN', 'JEE_ADVANCED'] } } } } } },
    ]));
    expect(where.AND.some((part) => 'OR' in part)).toBe(true);
  });

  it('does not add a DEMO exclusion for identity-only queries and applies each year window', () => {
    expect(buildCollegeWhere(collegesQuerySchema.parse({ search: 'NIT' }))).toMatchObject({ AND: [expect.objectContaining({ OR: expect.any(Array) })] });
    for (const [established, condition] of [
      ['before_1960', { lt: 1960 }],
      ['1960_1990', { gte: 1960, lt: 1990 }],
      ['1990_2010', { gte: 1990, lte: 2010 }],
      ['after_2010', { gt: 2010 }],
    ] as const) {
      const where = buildCollegeWhere(collegesQuerySchema.parse({ established })) as { AND: Array<Record<string, unknown>> };
      expect(where.AND).toContainEqual({ establishedYear: condition });
      expect(where.AND).toContainEqual({ dataStatus: { not: 'DEMO' } });
    }
    expect(buildCollegeWhere(collegesQuerySchema.parse({}))).toEqual({});
  });

  it('uses deterministic ordering and pushes null measurements last for every supported sort', () => {
    expect(buildCollegeOrderBy('name')).toEqual([{ name: 'asc' }, { id: 'asc' }]);
    expect(buildCollegeOrderBy('fees_asc')).toEqual([{ annualFees: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }]);
    expect(buildCollegeOrderBy('fees_desc')).toEqual([{ annualFees: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }]);
    expect(buildCollegeOrderBy('rating')).toEqual([{ rating: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }]);
    expect(buildCollegeOrderBy('newest')).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);
  });
});

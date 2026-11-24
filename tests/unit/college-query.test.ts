import { describe, expect, it } from 'vitest';
import { buildCollegeOrderBy, buildCollegeWhere } from '@/server/colleges';
import { collegesQuerySchema } from '@/lib/validation';

describe('college query construction', () => {
  it('combines identity search, location and type constraints without filtering raw summary facts', () => {
    const query = collegesQuerySchema.parse({
      search: 'IIT', state: 'Kerala', type: 'GOVERNMENT', minFees: '100', maxFees: '500',
      naac: 'A+,A', minRating: '4', courses: 'B.Tech,M.Tech', exams: 'JEE_MAIN,JEE_ADVANCED',
    });
    const where = buildCollegeWhere(query) as { AND: Array<Record<string, unknown>> };
    expect(where.AND).toEqual(expect.arrayContaining([
      { state: { equals: 'Kerala', mode: 'insensitive' } },
      { type: 'GOVERNMENT' },
    ]));
    expect(where.AND.some((part) => 'OR' in part && JSON.stringify(part).includes('aliases'))).toBe(true);
    expect(JSON.stringify(where)).not.toMatch(/annualFees|naacGrade|cutoffs|establishedYear|rating/);
  });

  it('uses only trusted projected facts for measurements and does not push those filters into raw columns', () => {
    expect(buildCollegeWhere(collegesQuerySchema.parse({ search: 'NIT' }))).toMatchObject({ AND: [expect.objectContaining({ OR: expect.any(Array) })] });
    expect(buildCollegeWhere(collegesQuerySchema.parse({ established: 'before_1960', minFees: '1', naac: 'A', exams: 'JEE_MAIN' }))).toEqual({});
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

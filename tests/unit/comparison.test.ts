import { describe, expect, it } from 'vitest';
import { bestComparisonIndex, comparisonSlugs, shareComparisonUrl } from '@/lib/comparison';
import { buildCollegeWhere } from '@/server/colleges';

describe('comparison links and missing values', () => {
  it('accepts two or three unique canonical slugs and rejects invalid/duplicate identifiers', () => {
    expect(comparisonSlugs(['iit-bombay', 'nit-trichy'])).toEqual(['iit-bombay', 'nit-trichy']);
    expect(comparisonSlugs(['a', 'b', 'c'])).toHaveLength(3);
    expect(comparisonSlugs(['a', 'a'])).toBeNull();
    expect(comparisonSlugs(['a', 'bad/slug'])).toBeNull();
    expect(comparisonSlugs(['only-one'])).toBeNull();
  });
  it('serializes stable slugs into a shareable URL', () => {
    expect(shareComparisonUrl('https://example.test', [{ slug: 'iit-bombay' }, { slug: 'nit-trichy' }]))
      .toBe('https://example.test/compare?colleges=iit-bombay,nit-trichy');
    expect(shareComparisonUrl('https://example.test', [{ slug: 'alone' }])).toBeNull();
  });
  it('only chooses a winner when every compared value is known', () => {
    expect(bestComparisonIndex([{ n: 1 }, { n: 2 }], (x) => x.n, 'min')).toBe(0);
    expect(bestComparisonIndex([{ n: 5 }, { n: 2 }, { n: 4 }], (x) => x.n, 'min')).toBe(1);
    expect(bestComparisonIndex([{ n: 5 }, { n: 7 }, { n: 6 }], (x) => x.n, 'max')).toBe(1);
    expect(bestComparisonIndex([{ n: 5 }], (x) => x.n, 'max')).toBe(-1);
    expect(bestComparisonIndex([{ n: 1 }, { n: null }, { n: 2 }], (x) => x.n, 'min')).toBe(-1);
    expect(bestComparisonIndex([{ n: 1 }, { n: Number.NaN }], (x) => x.n, 'max')).toBe(-1);
  });
  it('excludes demo rows from numeric fee filters', () => {
    const where = buildCollegeWhere({ minFees: 100, maxFees: 500, page: 1, limit: 12, sort: 'name' } as never);
    expect(where).toMatchObject({ AND: expect.arrayContaining([{ dataStatus: { not: 'DEMO' } }]) });
  });
});

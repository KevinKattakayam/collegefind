import { describe, expect, it } from 'vitest';
import type { PublicCutoffRow } from '@/server/cutoffs';
import { buildCutoffTrendGrid, cutoffTrendDomain, cutoffTrendPath } from '@/server/cutoff-trends';

function record(year: number, round: number, openingValue: number | null, closingValue: number): PublicCutoffRow {
  return {
    id: `${year}-${round}`, college: { id: 'college-1', slug: 'college-one', name: 'College One', city: 'City', state: 'State' },
    program: { id: 'program-1', name: 'Engineering', branch: 'Engineering', degree: 'B.Tech', durationYears: 4 },
    counsellingSystem: 'JOSAA', rankType: 'CRL', exam: 'JEE_MAIN', year, round, quota: 'AI', category: 'OPEN', isPwd: false,
    seatPool: 'GENDER_NEUTRAL', metric: 'RANK', openingValue, closingValue, isPreparatory: false, evidenceLocator: null,
    source: { name: 'Test source', publisher: 'Authority', url: 'https://authority.example.test', publishedAt: new Date('2024-01-01'), retrievedAt: new Date('2024-01-02') },
    reviewedAt: new Date('2024-01-03'),
  };
}

describe('cutoff trend series', () => {
  it('inserts gaps for absent years and rounds rather than joining across them', () => {
    const cells = buildCutoffTrendGrid([record(2022, 1, 100, 200), record(2024, 1, 80, 160), record(2024, 2, 75, 150), record(2024, 3, null, 140)]);
    expect(cells).toHaveLength(9);
    expect(cells.filter(({ record: row }) => row === null).map(({ year, round }) => `${year}-${round}`)).toEqual(['2022-2', '2022-3', '2023-1', '2023-2', '2023-3']);
    const domain = cutoffTrendDomain(cells)!;
    const paths = cutoffTrendPath(cells, 'closingValue', 700, 250, domain);
    expect(paths).toHaveLength(2);
    expect(paths.every((path) => path.startsWith('M'))).toBe(true);
    expect(paths.some((path) => path.includes('L'))).toBe(true);
  });

  it('represents a single point and null opening value without inventing a line', () => {
    const cells = buildCutoffTrendGrid([record(2024, 2, null, 300)]);
    const domain = cutoffTrendDomain(cells)!;
    expect(cutoffTrendPath(cells, 'openingValue', 700, 250, domain)).toEqual([]);
    expect(cutoffTrendPath(cells, 'closingValue', 700, 250, domain)).toHaveLength(1);
    expect(cutoffTrendDomain([])).toBeNull();
    expect(buildCutoffTrendGrid([])).toEqual([]);
  });

  it('shows requested boundary years and does not label unselected rounds as missing', () => {
    const rows = [record(2022, 1, 100, 200), record(2024, 1, 80, 160)];
    const ranged = buildCutoffTrendGrid(rows, { yearFrom: 2021, yearTo: 2024, round: 1 });
    expect(ranged.map(({ year, round, record: item }) => [year, round, item?.id ?? null])).toEqual([
      [2021, 1, null], [2022, 1, '2022-1'], [2023, 1, null], [2024, 1, '2024-1'],
    ]);
  });
});

import type { PublicCutoffRow } from './cutoffs';

export type CutoffTrendCell = { year: number; round: number; record: PublicCutoffRow | null };

/** Materialize absent year/round pairs as null cells so chart paths break instead
 * of drawing a line across years/rounds for which no reviewed record exists. */
export function buildCutoffTrendGrid(rows: PublicCutoffRow[], selection: { year?: number; yearFrom?: number; yearTo?: number; round?: number } = {}): CutoffTrendCell[] {
  if (!rows.length) return [];
  const firstYear = selection.year ?? selection.yearFrom ?? Math.min(...rows.map((row) => row.year));
  const lastYear = selection.year ?? selection.yearTo ?? Math.max(...rows.map((row) => row.year));
  const rounds = selection.round === undefined ? Array.from({ length: Math.max(...rows.map((row) => row.round)) }, (_, index) => index + 1) : [selection.round];
  const bySlot = new Map(rows.map((row) => [`${row.year}:${row.round}`, row]));
  const cells: CutoffTrendCell[] = [];
  for (let year = firstYear; year <= lastYear; year++) {
    for (const round of rounds) {
      cells.push({ year, round, record: bySlot.get(`${year}:${round}`) ?? null });
    }
  }
  return cells;
}

export function cutoffTrendDomain(cells: CutoffTrendCell[]) {
  const values = cells.flatMap(({ record }) => record ? [record.openingValue, record.closingValue].filter((value): value is number => value !== null) : []);
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max(1, (max - min) * 0.08);
  return { min: Math.max(0, min - padding), max: max + padding };
}

export function cutoffTrendPath(cells: CutoffTrendCell[], field: 'openingValue' | 'closingValue', width: number, height: number, domain: { min: number; max: number }) {
  const span = domain.max - domain.min || 1;
  const segments: string[] = [];
  let current: string[] = [];
  cells.forEach(({ record }, index) => {
    const value = record?.[field];
    if (value === undefined || value === null) {
      if (current.length) segments.push(current.join(' '));
      current = [];
      return;
    }
    const x = cells.length < 2 ? width / 2 : (index / (cells.length - 1)) * width;
    const y = height - ((value - domain.min) / span) * height;
    current.push(`${current.length ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`);
  });
  if (current.length) segments.push(current.join(' '));
  return segments;
}

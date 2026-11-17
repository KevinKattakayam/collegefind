import type { College } from '@/types';

export function comparisonSlugs(values: string[]): string[] | null {
  const slugs = values.map((value) => value.trim());
  if (slugs.length < 2 || slugs.length > 3) return null;
  if (slugs.some((slug) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug))) return null;
  if (new Set(slugs.map((s) => s.toLowerCase())).size !== slugs.length) return null;
  return slugs;
}

export function shareComparisonUrl(origin: string, colleges: Pick<College, 'slug'>[]): string | null {
  const slugs = comparisonSlugs(colleges.map((c) => c.slug));
  if (!slugs) return null;
  return `${origin}/compare?colleges=${slugs.map(encodeURIComponent).join(',')}`;
}

export function bestComparisonIndex<T>(items: T[], getValue: (item: T) => number | null | undefined, direction: 'min' | 'max'): number {
  if (items.length < 2) return -1;
  const values = items.map(getValue);
  if (values.some((v) => v === null || v === undefined || !Number.isFinite(v))) return -1;
  const known = values as number[];
  return known.reduce((best, value, index) => {
    const current = known[best];
    return direction === 'min' ? (value < current ? index : best) : (value > current ? index : best);
  }, 0);
}

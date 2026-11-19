import type { College } from '@/types';
import type { CollegesQuery } from '@/lib/validation';

export function filterPublicColleges(rows: College[], q: CollegesQuery): College[] {
  return rows.filter((c) => {
    if (q.city && c.city.localeCompare(q.city, undefined, { sensitivity: 'base' }) !== 0) return false;
    if (q.minFees !== undefined && (c.annualFees === null || c.annualFees < q.minFees)) return false;
    if (q.maxFees !== undefined && (c.annualFees === null || c.annualFees > q.maxFees)) return false;
    if (q.naac?.length && (!c.naacGrade || !q.naac.some((grade) => grade === c.naacGrade))) return false;
    if (q.courses?.length && !q.courses.some((v) => c.courses.includes(v))) return false;
    if (q.programme && !c.structuredFacts?.some(({ value }) => value.kind === 'programme' && value.programme.toLocaleLowerCase().includes(q.programme!.toLocaleLowerCase()))) return false;
    if (q.degrees?.length && !c.structuredFacts?.some(({ value }) => value.kind === 'programme' && q.degrees!.includes(value.level))) return false;
    if (q.eligibility && !c.structuredFacts?.some(({ value }) => value.kind === 'admission' && value.eligibility?.toLocaleLowerCase().includes(q.eligibility!.toLocaleLowerCase()))) return false;
    if (q.minRating !== undefined && (c.rating === null || c.rating < q.minRating)) return false;
    const year = c.establishedYear;
    if (q.established && year === null) return false;
    if (q.established === 'before_1960' && year! >= 1960) return false;
    if (q.established === '1960_1990' && (year! < 1960 || year! >= 1990)) return false;
    if (q.established === '1990_2010' && (year! < 1990 || year! > 2010)) return false;
    if (q.established === 'after_2010' && year! <= 2010) return false;
    return true;
  }).sort((a,b) => {
    if (q.sort === 'rating') return (b.rating ?? -1) - (a.rating ?? -1) || a.slug.localeCompare(b.slug);
    if (q.sort === 'fees_asc' || q.sort === 'fees_desc') {
      if (a.annualFees === null) return b.annualFees === null ? a.slug.localeCompare(b.slug) : 1;
      if (b.annualFees === null) return -1;
      return (q.sort === 'fees_asc' ? a.annualFees-b.annualFees : b.annualFees-a.annualFees) || a.slug.localeCompare(b.slug);
    }
    return 0; // preserve stable DB ordering for other sorts
  });
}

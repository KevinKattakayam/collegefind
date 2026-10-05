import type { Prisma } from '@prisma/client';
import type { CollegesQuery } from '@/lib/validation';

/** Fields safe and useful for listing cards. */
export const collegeListSelect = {
  id: true,
  slug: true,
  name: true,
  shortName: true,
  city: true,
  state: true,
  type: true,
  establishedYear: true,
  totalStudents: true,
  naacGrade: true,
  annualFees: true,
  placementPct: true,
  avgPackage: true,
  highestPackage: true,
  metricsYear: true,
  courses: true,
  topRecruiters: true,
  rating: true,
  reviewCount: true,
  dataStatus: true,
} satisfies Prisma.CollegeSelect;

export const collegeDetailSelect = {
  ...collegeListSelect,
  description: true,
  about: true,
  website: true,
  phone: true,
  email: true,
  aisheCode: true,
  updatedAt: true,
} satisfies Prisma.CollegeSelect;

const insensitive = 'insensitive' as const;

export function buildCollegeWhere(q: CollegesQuery): Prisma.CollegeWhereInput {
  const and: Prisma.CollegeWhereInput[] = [];
  if (q.search) {
    and.push({
      OR: [
        { name: { contains: q.search, mode: insensitive } },
        { shortName: { contains: q.search, mode: insensitive } },
        { city: { contains: q.search, mode: insensitive } },
        { state: { contains: q.search, mode: insensitive } },
      ],
    });
  }
  if (q.state) and.push({ state: { equals: q.state, mode: insensitive } });
  if (q.type) and.push({ type: q.type });
  if (q.minFees !== undefined || q.maxFees !== undefined) {
    and.push({
      annualFees: {
        ...(q.minFees !== undefined ? { gte: q.minFees } : {}),
        ...(q.maxFees !== undefined ? { lte: q.maxFees } : {}),
      },
    });
  }
  if (q.naac?.length) and.push({ naacGrade: { in: q.naac } });
  if (q.minRating !== undefined) and.push({ rating: { gte: q.minRating } });
  if (q.courses?.length) and.push({ courses: { hasSome: q.courses } });
  if (q.exams?.length) {
    // Only colleges with real, sourced cutoff records for these exams.
    and.push({ programs: { some: { cutoffs: { some: { exam: { in: q.exams } } } } } });
  }
  switch (q.established) {
    case 'before_1960':
      and.push({ establishedYear: { lt: 1960 } });
      break;
    case '1960_1990':
      and.push({ establishedYear: { gte: 1960, lt: 1990 } });
      break;
    case '1990_2010':
      and.push({ establishedYear: { gte: 1990, lte: 2010 } });
      break;
    case 'after_2010':
      and.push({ establishedYear: { gt: 2010 } });
      break;
  }
  return and.length ? { AND: and } : {};
}

export function buildCollegeOrderBy(sort: CollegesQuery['sort']): Prisma.CollegeOrderByWithRelationInput[] {
  switch (sort) {
    case 'fees_asc':
      return [{ annualFees: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }];
    case 'fees_desc':
      return [{ annualFees: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }];
    case 'newest':
      return [{ createdAt: 'desc' }, { id: 'asc' }];
    case 'rating':
      return [{ rating: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }];
    case 'name':
    default:
      return [{ name: 'asc' }, { id: 'asc' }];
  }
}

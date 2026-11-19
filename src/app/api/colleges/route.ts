import { filterPublicColleges } from '@/server/public-search';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CACHE_PUBLIC_SHORT, readQuery, withErrorHandling } from '@/lib/http';
import { collegesQuerySchema } from '@/lib/validation';
import { buildCollegeOrderBy, buildCollegeWhere, collegeListSelect } from '@/server/colleges';
import { listCollegesWithReviewedCutoffs } from '@/server/cutoffs';

export const GET = withErrorHandling(async (request: Request) => {
  const q = readQuery(request, collegesQuerySchema);

  if (q.distinct === 'states') {
    const rows = await prisma.college.findMany({
      select: { state: true },
      distinct: ['state'],
      orderBy: { state: 'asc' },
    });
    return NextResponse.json(
      { states: rows.map((r) => r.state) },
      { headers: { 'Cache-Control': CACHE_PUBLIC_SHORT } },
    );
  }

  if (q.slugs?.length) {
    const rows = await prisma.college.findMany({ where: { slug: { in: q.slugs } }, select: collegeListSelect });
    const bySlug = new Map(rows.map((row) => [row.slug, row]));
    const colleges = q.slugs.flatMap((slug) => {
      const row = bySlug.get(slug);
      return row ? filterPublicColleges([row], q) : [];
    });
    return NextResponse.json({
      colleges,
      total: colleges.length,
      missingSlugs: q.slugs.filter((slug) => !bySlug.has(slug)),
      page: 1,
      limit: q.slugs.length,
      totalPages: colleges.length ? 1 : 0,
    }, { headers: { 'Cache-Control': CACHE_PUBLIC_SHORT } });
  }

  // Filter source-reviewed projections, never denormalised legacy measurements.
  const where = buildCollegeWhere({ ...q, minFees: undefined, maxFees: undefined, naac: undefined, courses: undefined, established: undefined, minRating: undefined, sort: 'name' });
  if (q.exams?.length) {
    const collegeIds = await listCollegesWithReviewedCutoffs(prisma, q.exams);
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), { id: { in: collegeIds } }];
  }
  const needsProjectedFiltering = Boolean(q.minFees !== undefined || q.maxFees !== undefined || q.naac?.length || q.courses?.length || q.programme || q.degrees?.length || q.eligibility || q.established || q.minRating !== undefined || q.exams?.length || q.sort === 'fees_asc' || q.sort === 'fees_desc' || q.sort === 'rating');
  if (!needsProjectedFiltering) {
    // Keep count and page on one snapshot, and submit sequentially through the
    // PostgreSQL adapter's transaction connection.
    const [total, colleges] = await prisma.$transaction(async (tx) => {
      const total = await tx.college.count({ where });
      const colleges = await tx.college.findMany({ where, select: collegeListSelect, orderBy: buildCollegeOrderBy(q.sort), skip: (q.page - 1) * q.limit, take: q.limit });
      return [total, colleges] as const;
    }, { isolationLevel: 'RepeatableRead' });
    return NextResponse.json({ colleges, total, page: q.page, limit: q.limit, totalPages: Math.ceil(total / q.limit) }, { headers: { 'Cache-Control': CACHE_PUBLIC_SHORT } });
  }
  const candidates = await prisma.college.findMany({ where, select: collegeListSelect, orderBy: buildCollegeOrderBy(q.sort === 'fees_asc' || q.sort === 'fees_desc' || q.sort === 'rating' ? 'name' : q.sort) });
  const filtered = filterPublicColleges(candidates, q);
  const total = filtered.length;
  const colleges = filtered.slice((q.page - 1) * q.limit, q.page * q.limit);

  return NextResponse.json(
    { colleges, total, page: q.page, limit: q.limit, totalPages: Math.ceil(total / q.limit) },
    { headers: { 'Cache-Control': CACHE_PUBLIC_SHORT } },
  );
});

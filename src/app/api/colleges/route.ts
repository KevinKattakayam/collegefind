import { filterPublicColleges } from '@/server/public-search';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CACHE_PUBLIC_SHORT, readQuery, withErrorHandling } from '@/lib/http';
import { collegesQuerySchema } from '@/lib/validation';
import { buildCollegeOrderBy, buildCollegeWhere, collegeListSelect } from '@/server/colleges';

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

  // Filter source-reviewed projections, never denormalised legacy measurements.
  const where = buildCollegeWhere({ ...q, minFees: undefined, maxFees: undefined, naac: undefined, courses: undefined, established: undefined, minRating: undefined, sort: 'name' });
  const candidates = await prisma.college.findMany({ where, select: collegeListSelect, orderBy: buildCollegeOrderBy(q.sort === 'fees_asc' || q.sort === 'fees_desc' || q.sort === 'rating' ? 'name' : q.sort) });
  const filtered = filterPublicColleges(candidates, q);
  const total = filtered.length;
  const colleges = filtered.slice((q.page - 1) * q.limit, q.page * q.limit);

  return NextResponse.json(
    { colleges, total, page: q.page, limit: q.limit, totalPages: Math.ceil(total / q.limit) },
    { headers: { 'Cache-Control': CACHE_PUBLIC_SHORT } },
  );
});

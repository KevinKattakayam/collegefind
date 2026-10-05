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

  const where = buildCollegeWhere(q);
  const [colleges, total] = await Promise.all([
    prisma.college.findMany({
      where,
      select: collegeListSelect,
      orderBy: buildCollegeOrderBy(q.sort),
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.college.count({ where }),
  ]);

  return NextResponse.json(
    { colleges, total, page: q.page, limit: q.limit, totalPages: Math.ceil(total / q.limit) },
    { headers: { 'Cache-Control': CACHE_PUBLIC_SHORT } },
  );
});

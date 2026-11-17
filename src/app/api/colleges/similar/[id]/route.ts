import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiError, CACHE_PUBLIC_SHORT, withErrorHandling } from '@/lib/http';
import { collegeKeySchema } from '@/lib/validation';
import { collegeListSelect } from '@/server/colleges';

/** Same state and type first, then same type with the closest known fees. */
export const GET = withErrorHandling(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const key = collegeKeySchema.parse((await ctx.params).id);
  const college = await prisma.college.findFirst({
    where: { OR: [{ id: key }, { slug: key }] },
    select: collegeListSelect,
  });
  if (!college) throw new ApiError(404, 'NOT_FOUND', 'College not found');

  const similar = await prisma.college.findMany({
    where: { state: college.state, type: college.type, id: { not: college.id }, dataStatus: { not: 'DEMO' } },
    select: collegeListSelect,
    orderBy: { name: 'asc' },
    take: 3,
  });
  if (similar.length < 3) {
    const more = await prisma.college.findMany({
      where: { type: college.type, id: { notIn: [college.id, ...similar.map((s) => s.id)] }, dataStatus: { not: 'DEMO' } },
      select: collegeListSelect,
      orderBy: { name: 'asc' },
      take: 50,
    });
    // Public projection already withholds unreviewed/demo fees. Use the
    // projected field itself rather than whole-college verification status.
    const fees = typeof college.annualFees === 'number' && Number.isFinite(college.annualFees)
      ? college.annualFees
      : null;
    more
      .sort((a, b) => {
        if (fees === null) return a.name.localeCompare(b.name);
        const aDistance = typeof a.annualFees === 'number' && Number.isFinite(a.annualFees)
          ? Math.abs(a.annualFees - fees)
          : Number.POSITIVE_INFINITY;
        const bDistance = typeof b.annualFees === 'number' && Number.isFinite(b.annualFees)
          ? Math.abs(b.annualFees - fees)
          : Number.POSITIVE_INFINITY;
        return aDistance - bDistance || a.name.localeCompare(b.name);
      })
      .slice(0, 3 - similar.length)
      .forEach((c) => similar.push(c));
  }
  return NextResponse.json({ colleges: similar }, { headers: { 'Cache-Control': CACHE_PUBLIC_SHORT } });
});

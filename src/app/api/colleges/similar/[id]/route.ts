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
    select: { id: true, state: true, type: true, annualFees: true },
  });
  if (!college) throw new ApiError(404, 'NOT_FOUND', 'College not found');

  const similar = await prisma.college.findMany({
    where: { state: college.state, type: college.type, id: { not: college.id } },
    select: collegeListSelect,
    orderBy: { name: 'asc' },
    take: 3,
  });
  if (similar.length < 3) {
    const more = await prisma.college.findMany({
      where: { type: college.type, id: { notIn: [college.id, ...similar.map((s) => s.id)] }, annualFees: { not: null } },
      select: collegeListSelect,
      take: 50,
    });
    const fees = college.annualFees;
    more
      .sort((a, b) =>
        fees === null ? a.name.localeCompare(b.name) : Math.abs((a.annualFees ?? 0) - fees) - Math.abs((b.annualFees ?? 0) - fees),
      )
      .slice(0, 3 - similar.length)
      .forEach((c) => similar.push(c));
  }
  return NextResponse.json({ colleges: similar }, { headers: { 'Cache-Control': CACHE_PUBLIC_SHORT } });
});

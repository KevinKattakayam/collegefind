import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiError, CACHE_PUBLIC_SHORT, withErrorHandling } from '@/lib/http';
import { collegeKeySchema } from '@/lib/validation';
import { collegeDetailSelect } from '@/server/colleges';

/** Accepts either the college id or its slug. */
export const GET = withErrorHandling(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const key = collegeKeySchema.parse((await ctx.params).id);
  const college = await prisma.college.findFirst({
    where: { OR: [{ id: key }, { slug: key }] },
    select: collegeDetailSelect,
  });
  if (!college) throw new ApiError(404, 'NOT_FOUND', 'College not found');
  return NextResponse.json({ college }, { headers: { 'Cache-Control': CACHE_PUBLIC_SHORT } });
});

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiError, CACHE_PUBLIC_SHORT, withErrorHandling } from '@/lib/http';
import { collegeKeySchema } from '@/lib/validation';
import { cutoffQuerySchema, listPublicCutoffs } from '@/server/cutoffs';

/** Approved, source-backed history for one college. All rounds and seat pools are retained. */
export const GET = withErrorHandling(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const key = collegeKeySchema.parse((await ctx.params).id);
  const college = await prisma.college.findFirst({ where: { OR: [{ id: key }, { slug: key }] }, select: { id: true, slug: true } });
  if (!college) throw new ApiError(404, 'NOT_FOUND', 'College not found');
  const supplied = Object.fromEntries(new URL(request.url).searchParams.entries());
  const query = cutoffQuerySchema.parse({ ...supplied, college: college.slug });
  const result = await listPublicCutoffs(prisma, query);
  return NextResponse.json({ cutoffs: result.items, total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages }, { headers: { 'Cache-Control': CACHE_PUBLIC_SHORT } });
});

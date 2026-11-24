import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiError, CACHE_PUBLIC_SHORT, withErrorHandling } from '@/lib/http';
import { collegeKeySchema } from '@/lib/validation';
import { collegeDetailSelect } from '@/server/colleges';
import { publicSourceReportedFacts } from '@/server/source-reported-public';
import { errorFields, logger } from '@/lib/logger';

/** Accepts either the college id or its slug. */
export const GET = withErrorHandling(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const key = collegeKeySchema.parse((await ctx.params).id);
  const college = await prisma.college.findFirst({
    where: { OR: [{ id: key }, { slug: key }] },
    select: collegeDetailSelect,
  });
  if (!college) throw new ApiError(404, 'NOT_FOUND', 'College not found');
  let sourceReportedFacts: Awaited<ReturnType<typeof publicSourceReportedFacts>> = [];
  try {
    sourceReportedFacts = await publicSourceReportedFacts(college);
  } catch (error) {
    logger.warn('college_api_source_reported_unavailable', errorFields(error));
  }
  return NextResponse.json({ college: { ...college, sourceReportedFacts } }, { headers: { 'Cache-Control': CACHE_PUBLIC_SHORT } });
});

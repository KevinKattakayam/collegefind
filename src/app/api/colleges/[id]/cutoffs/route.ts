import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiError, CACHE_PUBLIC_SHORT, withErrorHandling } from '@/lib/http';
import { collegeKeySchema } from '@/lib/validation';

/** Sourced cutoff history for one college, newest years first, final rounds only. */
export const GET = withErrorHandling(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const key = collegeKeySchema.parse((await ctx.params).id);
  const college = await prisma.college.findFirst({
    where: { OR: [{ id: key }, { slug: key }] },
    select: { id: true },
  });
  if (!college) throw new ApiError(404, 'NOT_FOUND', 'College not found');

  const records = await prisma.cutoffRecord.findMany({
    where: { program: { collegeId: college.id }, isPwd: false },
    select: {
      exam: true,
      year: true,
      round: true,
      quota: true,
      category: true,
      seatPool: true,
      metric: true,
      openingValue: true,
      closingValue: true,
      isPreparatory: true,
      program: { select: { id: true, name: true, branch: true } },
      source: { select: { name: true, publisher: true, url: true, retrievedAt: true } },
    },
    orderBy: [{ year: 'desc' }, { round: 'desc' }],
    take: 2000,
  });

  // Keep only the last round per (program, year, quota, category, pool).
  const seen = new Set<string>();
  const finalRound = records.filter((r) => {
    const k = [r.program.id, r.exam, r.year, r.quota, r.category, r.seatPool].join('|');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return NextResponse.json({ cutoffs: finalRound }, { headers: { 'Cache-Control': CACHE_PUBLIC_SHORT } });
});

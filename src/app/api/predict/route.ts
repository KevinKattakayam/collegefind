import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CACHE_NONE, clientIp, readQuery, withErrorHandling } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { guidanceQuerySchema } from '@/lib/validation';
import { findPublicRankObservation } from '@/server/cutoffs';

/** Returns one reviewed historical rank observation. The URL is retained for existing navigation. */
export const GET = withErrorHandling(async (request: Request) => {
  await enforceRateLimit('predict', clientIp(request));
  const { cutoff } = readQuery(request, guidanceQuerySchema);
  const observation = await findPublicRankObservation(prisma, cutoff);
  return NextResponse.json({
    status: observation ? 'HISTORICAL_OBSERVATION' : 'INSUFFICIENT_VERIFIED_EVIDENCE',
    eligibility: 'NOT_CONFIRMED',
    observation,
  }, { headers: { 'Cache-Control': CACHE_NONE } });
});

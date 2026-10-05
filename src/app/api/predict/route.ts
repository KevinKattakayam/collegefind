import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp, readQuery, withErrorHandling } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { predictQuerySchema } from '@/lib/validation';
import { predict } from '@/lib/predictor/service';

/**
 * GET /api/predict — see docs/PREDICTOR.md for the full contract.
 * All filtering happens in PostgreSQL; only candidate programs are loaded.
 */
export const GET = withErrorHandling(async (request: Request) => {
  await enforceRateLimit('predict', clientIp(request));
  const q = readQuery(request, predictQuerySchema);
  const result = await predict(q, prisma);
  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
});

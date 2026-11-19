import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CACHE_PUBLIC_SHORT, readQuery, withErrorHandling } from '@/lib/http';
import { cutoffQuerySchema, listPublicCutoffs } from '@/server/cutoffs';

export const GET = withErrorHandling(async (request: Request) => {
  const query = readQuery(request, cutoffQuerySchema);
  const result = await listPublicCutoffs(prisma, query);
  return NextResponse.json(result, { headers: { 'Cache-Control': CACHE_PUBLIC_SHORT } });
});

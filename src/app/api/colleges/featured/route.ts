import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CACHE_PUBLIC_SHORT, withErrorHandling } from '@/lib/http';
import { collegeListSelect } from '@/server/colleges';

/**
 * A neutral starting set: verified colleges first, then alphabetical.
 * There is no paid placement and no ranking by the (formerly fake) rating.
 */
export const GET = withErrorHandling(async () => {
  const colleges = await prisma.college.findMany({
    select: collegeListSelect,
    orderBy: [{ dataStatus: 'desc' }, { name: 'asc' }],
    take: 6,
  });
  return NextResponse.json({ colleges }, { headers: { 'Cache-Control': CACHE_PUBLIC_SHORT } });
});

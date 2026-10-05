import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiError, CACHE_NONE, assertSameOrigin, readJson, withErrorHandling } from '@/lib/http';
import { requireUser } from '@/lib/session';
import { enforceRateLimit } from '@/lib/rate-limit';
import { comparisonCreateSchema } from '@/lib/validation';
import { collegeListSelect } from '@/server/colleges';

const MAX_COMPARISONS = 50;

function signatureFromIds(ids: string[]) {
  return [...new Set(ids)].sort().join('|');
}

export const GET = withErrorHandling(async () => {
  const user = await requireUser();
  const comparisons = await prisma.savedComparison.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, collegeIds: true, createdAt: true },
  });
  const ids = [...new Set(comparisons.flatMap((c) => c.collegeIds))];
  const colleges = ids.length
    ? await prisma.college.findMany({ where: { id: { in: ids } }, select: collegeListSelect })
    : [];
  const byId = new Map(colleges.map((c) => [c.id, c]));
  return NextResponse.json(
    {
      comparisons: comparisons.map((c) => ({
        ...c,
        colleges: c.collegeIds.map((id) => byId.get(id)).filter(Boolean),
      })),
    },
    { headers: { 'Cache-Control': CACHE_NONE } },
  );
});

export const POST = withErrorHandling(async (request: Request) => {
  const user = await requireUser();
  assertSameOrigin(request);
  await enforceRateLimit('save', user.id);
  const { collegeIds } = await readJson(request, comparisonCreateSchema);

  const found = await prisma.college.count({ where: { id: { in: collegeIds } } });
  if (found !== collegeIds.length) throw new ApiError(404, 'NOT_FOUND', 'One or more colleges not found');

  const count = await prisma.savedComparison.count({ where: { userId: user.id } });
  if (count >= MAX_COMPARISONS) {
    throw new ApiError(409, 'LIMIT_REACHED', `You can save up to ${MAX_COMPARISONS} comparisons`);
  }

  // Unique (userId, signature) makes concurrent duplicate saves a clean 409, not a 500.
  const comparison = await prisma.savedComparison.create({
    data: { userId: user.id, signature: signatureFromIds(collegeIds), collegeIds },
    select: { id: true, collegeIds: true, createdAt: true },
  });
  return NextResponse.json({ comparison }, { status: 201 });
});

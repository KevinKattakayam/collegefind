import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiError, CACHE_NONE, assertSameOrigin, readJson, withErrorHandling } from '@/lib/http';
import { requireUser } from '@/lib/session';
import { enforceRateLimit } from '@/lib/rate-limit';
import { saveCollegeSchema } from '@/lib/validation';
import { collegeListSelect } from '@/server/colleges';

const MAX_SAVED = 200;

export const GET = withErrorHandling(async () => {
  const user = await requireUser();
  const saved = await prisma.savedCollege.findMany({
    where: { userId: user.id },
    select: { college: { select: collegeListSelect } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ saved: saved.map((s) => s.college) }, { headers: { 'Cache-Control': CACHE_NONE } });
});

/** Idempotent: saving twice (or two tabs at once) never produces a 500. */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await requireUser();
  assertSameOrigin(request);
  await enforceRateLimit('save', user.id);
  const { collegeId } = await readJson(request, saveCollegeSchema);

  const college = await prisma.college.findUnique({ where: { id: collegeId }, select: { id: true } });
  if (!college) throw new ApiError(404, 'NOT_FOUND', 'College not found');

  const count = await prisma.savedCollege.count({ where: { userId: user.id } });
  if (count >= MAX_SAVED) throw new ApiError(409, 'LIMIT_REACHED', `You can save up to ${MAX_SAVED} colleges`);

  const result = await prisma.savedCollege.createMany({
    data: [{ userId: user.id, collegeId }],
    skipDuplicates: true,
  });
  return NextResponse.json(
    { success: true, alreadySaved: result.count === 0 },
    { status: result.count === 0 ? 200 : 201 },
  );
});

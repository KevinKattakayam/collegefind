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
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return NextResponse.json({ saved: saved.map((s) => s.college) }, { headers: { 'Cache-Control': CACHE_NONE } });
});

/** Idempotently adds one college or merges a device shortlist for the signed-in owner. */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await requireUser();
  assertSameOrigin(request);
  await enforceRateLimit('save', user.id);
  const input = await readJson(request, saveCollegeSchema, 32 * 1024);
  const keys = 'collegeKeys' in input ? input.collegeKeys : [input.collegeId];

  const result = await prisma.$transaction(async (tx) => {
    // Serialize per-user cap checks so concurrent requests cannot exceed the limit.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
    const colleges = await tx.college.findMany({
      where: { OR: [{ id: { in: keys } }, { slug: { in: keys } }] },
      select: { id: true, slug: true },
    });
    const matched = new Map(colleges.flatMap((college) => [[college.id, college.id], [college.slug, college.id]]));
    const missing = keys.filter((key) => !matched.has(key));
    if (missing.length) throw new ApiError(404, 'NOT_FOUND', 'One or more colleges are unavailable');
    const collegeIds = [...new Set(keys.map((key) => matched.get(key)!))];
    const existing = await tx.savedCollege.findMany({ where: { userId: user.id, collegeId: { in: collegeIds } }, select: { collegeId: true } });
    const existingIds = new Set(existing.map((row) => row.collegeId));
    const toAdd = collegeIds.filter((id) => !existingIds.has(id));
    const total = await tx.savedCollege.count({ where: { userId: user.id } });
    if (total + toAdd.length > MAX_SAVED) throw new ApiError(409, 'LIMIT_REACHED', `You can save up to ${MAX_SAVED} colleges`);
    if (toAdd.length) await tx.savedCollege.createMany({ data: toAdd.map((collegeId) => ({ userId: user.id, collegeId })), skipDuplicates: true });
    return { addedCount: toAdd.length, alreadySavedCount: collegeIds.length - toAdd.length };
  });

  const batch = 'collegeKeys' in input;
  return NextResponse.json(
    batch
      ? { success: true, savedCount: result.addedCount, alreadySavedCount: result.alreadySavedCount }
      : { success: true, alreadySaved: result.addedCount === 0 },
    { status: !batch && result.addedCount > 0 ? 201 : 200 },
  );
});

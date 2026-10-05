import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertSameOrigin, withErrorHandling } from '@/lib/http';
import { requireUser } from '@/lib/session';
import { idSchema } from '@/lib/validation';

/** Idempotent delete scoped to the signed-in user (no IDOR). */
export const DELETE = withErrorHandling(async (request: Request, ctx: { params: Promise<{ collegeId: string }> }) => {
  const user = await requireUser();
  assertSameOrigin(request);
  const collegeId = idSchema.parse((await ctx.params).collegeId);
  const { count } = await prisma.savedCollege.deleteMany({ where: { userId: user.id, collegeId } });
  return NextResponse.json({ success: true, removed: count });
});

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiError, assertSameOrigin, withErrorHandling } from '@/lib/http';
import { requireUser } from '@/lib/session';
import { idSchema } from '@/lib/validation';

export const DELETE = withErrorHandling(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  assertSameOrigin(request);
  const id = idSchema.parse((await ctx.params).id);
  // Ownership is part of the WHERE clause, so another user's id simply matches nothing.
  const { count } = await prisma.savedComparison.deleteMany({ where: { id, userId: user.id } });
  if (count === 0) throw new ApiError(404, 'NOT_FOUND', 'Not found');
  return NextResponse.json({ success: true });
});

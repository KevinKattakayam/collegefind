import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withErrorHandling } from '@/lib/http';
import { idSchema } from '@/lib/validation';
import { getSessionUser } from '@/lib/session';

export const GET = withErrorHandling(async (request: Request, ctx: { params: Promise<{ collegeId: string }> }) => {
  const collegeId = idSchema.parse((await ctx.params).collegeId);
  const query = z.object({ page: z.coerce.number().int().min(1).max(1000).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) }).parse(Object.fromEntries(new URL(request.url).searchParams));
  const viewer = await getSessionUser();
  const where = { collegeId, status: 'VISIBLE' as const };
  const [total, rows] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where, select: { id: true, text: true, createdAt: true, userId: true, user: { select: { name: true } }, _count: { select: { answers: { where: { status: 'VISIBLE' } } } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.limit, take: query.limit,
    }),
  ]);
  const questions = rows.map(({ userId, ...row }) => ({ ...row, canEdit: userId === viewer?.id }));
  return NextResponse.json({ questions, total, page: query.page, limit: query.limit }, { headers: { 'Cache-Control': 'no-store' } });
});

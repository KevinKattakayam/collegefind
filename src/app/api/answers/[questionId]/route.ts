import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withErrorHandling } from '@/lib/http';
import { idSchema } from '@/lib/validation';
import { getSessionUser } from '@/lib/session';

export const GET = withErrorHandling(async (request: Request, ctx: { params: Promise<{ questionId: string }> }) => {
  const questionId = idSchema.parse((await ctx.params).questionId);
  const query = z.object({ page: z.coerce.number().int().min(1).max(1000).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) }).parse(Object.fromEntries(new URL(request.url).searchParams));
  const viewer = await getSessionUser();
  const where = { questionId, status: 'VISIBLE' as const, question: { status: 'VISIBLE' as const } };
  const [total, rows] = await Promise.all([
    prisma.answer.count({ where }),
    prisma.answer.findMany({ where, select: { id: true, text: true, createdAt: true, userId: true, user: { select: { name: true } } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.limit, take: query.limit }),
  ]);
  const answers = rows.map(({ userId, ...row }) => ({ ...row, canEdit: userId === viewer?.id }));
  return NextResponse.json({ answers, total, page: query.page, limit: query.limit }, { headers: { 'Cache-Control': 'no-store' } });
});

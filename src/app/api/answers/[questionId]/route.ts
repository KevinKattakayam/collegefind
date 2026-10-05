import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withErrorHandling } from '@/lib/http';
import { idSchema } from '@/lib/validation';

export const GET = withErrorHandling(async (_request: Request, ctx: { params: Promise<{ questionId: string }> }) => {
  const questionId = idSchema.parse((await ctx.params).questionId);
  const answers = await prisma.answer.findMany({
    where: { questionId, status: 'VISIBLE', question: { status: 'VISIBLE' } },
    select: { id: true, text: true, createdAt: true, user: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
  return NextResponse.json({ answers }, { headers: { 'Cache-Control': 'no-store' } });
});

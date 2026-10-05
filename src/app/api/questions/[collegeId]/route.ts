import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withErrorHandling } from '@/lib/http';
import { idSchema } from '@/lib/validation';

export const GET = withErrorHandling(async (_request: Request, ctx: { params: Promise<{ collegeId: string }> }) => {
  const collegeId = idSchema.parse((await ctx.params).collegeId);
  const questions = await prisma.question.findMany({
    where: { collegeId, status: 'VISIBLE' },
    select: {
      id: true,
      text: true,
      createdAt: true,
      user: { select: { name: true } },
      _count: { select: { answers: { where: { status: 'VISIBLE' } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return NextResponse.json({ questions }, { headers: { 'Cache-Control': 'no-store' } });
});

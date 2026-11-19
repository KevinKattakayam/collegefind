import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ApiError, assertSameOrigin, readJson, withErrorHandling } from '@/lib/http';
import { requireUser } from '@/lib/session';
import { enforceRateLimit } from '@/lib/rate-limit';

const schema = z.object({ questionId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(), answerId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(), reason: z.enum(['SPAM', 'ABUSE', 'MISLEADING', 'OTHER']), details: z.string().trim().max(500).optional() }).strict().refine(v => Boolean(v.questionId) !== Boolean(v.answerId), 'Choose one community item to report');
export const POST = withErrorHandling(async (request: Request) => {
  const user = await requireUser(); assertSameOrigin(request); await enforceRateLimit('question', user.id); const input = await readJson(request, schema);
  if (input.questionId) { const target = await prisma.question.findFirst({ where: { id: input.questionId, status: 'VISIBLE' }, select: { id: true } }); if (!target) throw new ApiError(404, 'NOT_FOUND', 'Community item not found') ;}
  else { const target = await prisma.answer.findFirst({ where: { id: input.answerId!, status: 'VISIBLE', question: { status: 'VISIBLE' } }, select: { id: true } }); if (!target) throw new ApiError(404, 'NOT_FOUND', 'Community item not found') ;}
  const reason = `${input.reason}${input.details ? `: ${input.details}` : ''}`;
  let report;
  try {
    report = input.questionId
      ? await prisma.communityReport.upsert({ where: { reporterId_questionId: { reporterId: user.id, questionId: input.questionId } }, create: { reporterId: user.id, questionId: input.questionId, reason }, update: {} })
      : await prisma.communityReport.upsert({ where: { reporterId_answerId: { reporterId: user.id, answerId: input.answerId! } }, create: { reporterId: user.id, answerId: input.answerId!, reason }, update: {} });
  } catch (error) {
    // Concurrent identical reports may race the unique constraint. Return the
    // first persisted report, preserving its original reason and audit context.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
    report = input.questionId
      ? await prisma.communityReport.findUnique({ where: { reporterId_questionId: { reporterId: user.id, questionId: input.questionId } } })
      : await prisma.communityReport.findUnique({ where: { reporterId_answerId: { reporterId: user.id, answerId: input.answerId! } } });
    if (!report) throw error;
  }
  return NextResponse.json({ reported: true, status: report.status }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
});

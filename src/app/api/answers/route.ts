import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { ApiError, assertSameOrigin, readJson, withErrorHandling } from '@/lib/http';
import { requireUser } from '@/lib/session';
import { enforceRateLimit } from '@/lib/rate-limit';
import { answerCreateSchema } from '@/lib/validation';

export const POST = withErrorHandling(async (request: Request) => {
  const user = await requireUser();
  assertSameOrigin(request);
  await enforceRateLimit('answer', user.id);
  const { questionId, text } = await readJson(request, answerCreateSchema);

  const question = await prisma.question.findFirst({
    where: { id: questionId, status: 'VISIBLE' },
    select: { id: true },
  });
  if (!question) throw new ApiError(404, 'NOT_FOUND', 'Question not found');

  const contentHash = createHash('sha256').update(text.normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleLowerCase('en')).digest('hex');
  if (await prisma.answer.findFirst({ where: { userId: user.id, questionId, contentHash }, select: { id: true } })) throw new ApiError(409, 'DUPLICATE_CONTENT', 'You already posted this answer');

  const answer = await prisma.answer.create({
    data: { text, contentHash, userId: user.id, questionId },
    select: { id: true, text: true, createdAt: true, user: { select: { name: true } } },
  });
  return NextResponse.json({ answer: { ...answer, canEdit: true } }, { status: 201 });
});

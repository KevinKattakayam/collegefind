import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiError, assertSameOrigin, readJson, withErrorHandling } from '@/lib/http';
import { requireUser } from '@/lib/session';
import { enforceRateLimit } from '@/lib/rate-limit';
import { questionCreateSchema } from '@/lib/validation';

export const POST = withErrorHandling(async (request: Request) => {
  const user = await requireUser();
  assertSameOrigin(request);
  await enforceRateLimit('question', user.id);
  const { collegeId, text } = await readJson(request, questionCreateSchema);

  const college = await prisma.college.findUnique({ where: { id: collegeId }, select: { id: true } });
  if (!college) throw new ApiError(404, 'NOT_FOUND', 'College not found');

  // Text is stored as plain text and rendered by React (escaped). Never render
  // it with dangerouslySetInnerHTML or a markdown renderer without sanitising.
  const question = await prisma.question.create({
    data: { text, userId: user.id, collegeId },
    select: { id: true, text: true, createdAt: true, user: { select: { name: true } } },
  });
  return NextResponse.json({ question: { ...question, _count: { answers: 0 } } }, { status: 201 });
});

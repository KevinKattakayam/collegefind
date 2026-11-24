import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiError, assertSameOrigin, readJson, withErrorHandling } from '@/lib/http';
import { requireUser } from '@/lib/session';
import { enforceRateLimit } from '@/lib/rate-limit';
import { answerCreateSchema } from '@/lib/validation';

type Context = { params: Promise<{ questionId: string; answerId: string ;}> ;};
export const PATCH = withErrorHandling(async (request: Request, context: Context) => {
  const user = await requireUser(); assertSameOrigin(request); await enforceRateLimit('answer', user.id); const { questionId, answerId } = await context.params; const input = await readJson(request, answerCreateSchema);
  if (input.questionId !== questionId) throw new ApiError(400, 'INVALID_INPUT', 'Question cannot be changed while editing an answer');
  const contentHash = createHash('sha256').update(input.text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en')).digest('hex');
  const answer = await prisma.$transaction(async tx => { const changed = await tx.answer.updateMany({ where: { id: answerId, questionId, userId: user.id, status: 'VISIBLE', question: { status: 'VISIBLE' } }, data: { text: input.text, contentHash } }); if (!changed.count) throw new ApiError(404, 'NOT_FOUND', 'Answer not found'); await tx.auditLog.create({ data: { actorId: user.id, action: 'community.answer.edit', targetType: 'Answer', targetId: answerId } }); return tx.answer.findUniqueOrThrow({ where: { id: answerId }, select: { id: true, text: true, createdAt: true, user: { select: { name: true } } } }) ;});
  return NextResponse.json({ answer: { ...answer, canEdit: true } }, { headers: { 'Cache-Control': 'no-store' } });
});
export const DELETE = withErrorHandling(async (request: Request, context: Context) => {
  const user = await requireUser(); assertSameOrigin(request); await enforceRateLimit('answer', user.id); const { questionId, answerId } = await context.params;
  await prisma.$transaction(async tx => { const changed = await tx.answer.updateMany({ where: { id: answerId, questionId, userId: user.id, status: 'VISIBLE' }, data: { status: 'HIDDEN', text: '[Removed by author]' } }); if (!changed.count) throw new ApiError(404, 'NOT_FOUND', 'Answer not found'); await tx.auditLog.create({ data: { actorId: user.id, action: 'community.answer.author_remove', targetType: 'Answer', targetId: answerId } }) ;});
  return NextResponse.json({ removed: true }, { headers: { 'Cache-Control': 'no-store' } });
});

import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiError, assertSameOrigin, readJson, withErrorHandling } from '@/lib/http';
import { requireUser } from '@/lib/session';
import { enforceRateLimit } from '@/lib/rate-limit';
import { questionCreateSchema } from '@/lib/validation';

type Context = { params: Promise<{ collegeId: string; questionId: string ;}> ;};
export const PATCH = withErrorHandling(async (request: Request, context: Context) => {
  const user = await requireUser(); assertSameOrigin(request); await enforceRateLimit('question', user.id);
  const { collegeId, questionId } = await context.params; const input = await readJson(request, questionCreateSchema);
  if (input.collegeId !== collegeId) throw new ApiError(400, 'INVALID_INPUT', 'College cannot be changed while editing a question');
  const contentHash = createHash('sha256').update(input.text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en')).digest('hex');
  const question = await prisma.$transaction(async tx => {
    const changed = await tx.question.updateMany({ where: { id: questionId, collegeId, userId: user.id, status: 'VISIBLE' }, data: { text: input.text, contentHash } });
    if (!changed.count) throw new ApiError(404, 'NOT_FOUND', 'Question not found');
    await tx.auditLog.create({ data: { actorId: user.id, action: 'community.question.edit', targetType: 'Question', targetId: questionId } });
    return tx.question.findUniqueOrThrow({ where: { id: questionId }, select: { id: true, text: true, createdAt: true, user: { select: { name: true } }, _count: { select: { answers: { where: { status: 'VISIBLE' } } } } } });
  });
  return NextResponse.json({ question: { ...question, canEdit: true } }, { headers: { 'Cache-Control': 'no-store' } });
});
export const DELETE = withErrorHandling(async (request: Request, context: Context) => {
  const user = await requireUser(); assertSameOrigin(request); await enforceRateLimit('question', user.id); const { collegeId, questionId } = await context.params;
  await prisma.$transaction(async tx => { const changed = await tx.question.updateMany({ where: { id: questionId, collegeId, userId: user.id, status: 'VISIBLE' }, data: { status: 'HIDDEN', text: '[Removed by author]' } }); if (!changed.count) throw new ApiError(404, 'NOT_FOUND', 'Question not found'); await tx.auditLog.create({ data: { actorId: user.id, action: 'community.question.author_remove', targetType: 'Question', targetId: questionId } }) ;});
  return NextResponse.json({ removed: true }, { headers: { 'Cache-Control': 'no-store' } });
});

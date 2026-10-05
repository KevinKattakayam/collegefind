import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertSameOrigin, readJson, withErrorHandling } from '@/lib/http';
import { requireAdmin } from '@/lib/session';
import { enforceRateLimit } from '@/lib/rate-limit';
import { moderationSchema } from '@/lib/validation';

/** Hide or restore a question/answer. Every action is written to AuditLog. */
export const POST = withErrorHandling(async (request: Request) => {
  const admin = await requireAdmin();
  assertSameOrigin(request);
  await enforceRateLimit('moderation', admin.id);
  const { type, id, status, reason } = await readJson(request, moderationSchema);

  await prisma.$transaction(async (tx) => {
    if (type === 'question') await tx.question.update({ where: { id }, data: { status } });
    else await tx.answer.update({ where: { id }, data: { status } });
    await tx.auditLog.create({
      data: {
        actorId: admin.id,
        action: `${type}.${status === 'HIDDEN' ? 'hide' : 'restore'}`,
        targetType: type,
        targetId: id,
        metadata: reason ? { reason } : undefined,
      },
    });
  });
  return NextResponse.json({ success: true });
});

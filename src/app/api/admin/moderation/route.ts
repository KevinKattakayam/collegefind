import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ApiError, assertSameOrigin, readJson, withErrorHandling } from '@/lib/http';
import { requireAdmin } from '@/lib/session';
import { enforceRateLimit } from '@/lib/rate-limit';

const querySchema = z.object({
  status: z.enum(['OPEN', 'RESOLVED', 'DISMISSED', 'ALL']).default('OPEN'),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const contentActionSchema = z.object({
  type: z.enum(['question', 'answer']),
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  status: z.enum(['VISIBLE', 'HIDDEN']),
  expectedStatus: z.enum(['VISIBLE', 'HIDDEN']),
  reason: z.string().trim().min(3).max(500),
  reportId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
}).strict();

const reportActionSchema = z.object({
  reportId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  reportStatus: z.enum(['RESOLVED', 'DISMISSED']),
  reason: z.string().trim().min(3).max(500),
}).strict();

export const GET = withErrorHandling(async (request: Request) => {
  await requireAdmin();
  const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const where: Prisma.CommunityReportWhereInput = {
    ...(query.status === 'ALL' ? {} : { status: query.status }),
    ...(query.q ? {
      OR: [
        { reason: { contains: query.q, mode: 'insensitive' } },
        { question: { text: { contains: query.q, mode: 'insensitive' } } },
        { answer: { text: { contains: query.q, mode: 'insensitive' } } },
      ],
    } : {}),
  };

  const [total, reports] = await Promise.all([
    prisma.communityReport.count({ where }),
    prisma.communityReport.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        reason: true,
        status: true,
        createdAt: true,
        resolutionReason: true,
        resolvedAt: true,
        question: {
          select: {
            id: true,
            text: true,
            status: true,
            createdAt: true,
            college: { select: { id: true, slug: true, name: true } },
          },
        },
        answer: {
          select: {
            id: true,
            text: true,
            status: true,
            createdAt: true,
            question: {
              select: {
                id: true,
                text: true,
                status: true,
                college: { select: { id: true, slug: true, name: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  // Reporter identity and contact data are intentionally omitted from the queue.
  return NextResponse.json({ reports, total, page: query.page, limit: query.limit }, { headers: { 'Cache-Control': 'no-store' } });
});

export const POST = withErrorHandling(async (request: Request) => {
  const admin = await requireAdmin();
  assertSameOrigin(request);
  await enforceRateLimit('moderation', admin.id);
  const input = await readJson(request, z.union([contentActionSchema, reportActionSchema]));

  if ('reportStatus' in input) {
    await prisma.$transaction(async tx => {
      const changed = await tx.communityReport.updateMany({
        where: { id: input.reportId, status: 'OPEN' },
        data: { status: input.reportStatus, resolutionReason: input.reason, resolvedAt: new Date(), resolvedById: admin.id },
      });
      if (!changed.count) {
        const exists = await tx.communityReport.findUnique({ where: { id: input.reportId }, select: { id: true } });
        if (!exists) throw new ApiError(404, 'NOT_FOUND', 'Report not found');
        throw new ApiError(409, 'REPORT_ALREADY_RESOLVED', 'This report was already resolved');
      }
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: `community.report.${input.reportStatus.toLowerCase()}`,
          targetType: 'CommunityReport',
          targetId: input.reportId,
          metadata: { reason: input.reason },
        },
      });
    });
    return NextResponse.json({ resolved: true }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const { type, id, status, expectedStatus, reason, reportId } = input;
  await prisma.$transaction(async tx => {
    const author = status === 'VISIBLE' ? { user: { deactivatedAt: null } } : {};
    const changed = type === 'question'
      ? await tx.question.updateMany({ where: { id, status: expectedStatus, ...author }, data: { status } })
      : await tx.answer.updateMany({ where: { id, status: expectedStatus, ...author }, data: { status } });

    if (!changed.count) {
      const exists = type === 'question'
        ? await tx.question.findUnique({ where: { id }, select: { id: true } })
        : await tx.answer.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new ApiError(404, 'NOT_FOUND', 'Community item not found');
      throw new ApiError(409, 'CONTENT_CHANGED', 'Community content changed or is no longer available. Reload the moderation queue before acting');
    }

    await tx.auditLog.create({
      data: { actorId: admin.id, action: `${type}.${status === 'HIDDEN' ? 'hide' : 'restore'}`, targetType: type, targetId: id, metadata: { reason } },
    });

    if (!reportId) return;
    const target = type === 'question' ? { questionId: id } : { answerId: id };
    const resolved = await tx.communityReport.updateMany({
      where: { id: reportId, status: 'OPEN', ...target },
      data: { status: 'RESOLVED', resolutionReason: reason, resolvedAt: new Date(), resolvedById: admin.id },
    });
    if (!resolved.count) throw new ApiError(409, 'REPORT_CHANGED', 'The linked report is no longer open or does not match this content');
    await tx.auditLog.create({
      data: { actorId: admin.id, action: 'community.report.resolved', targetType: 'CommunityReport', targetId: reportId, metadata: { reason } },
    });
  });

  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
});

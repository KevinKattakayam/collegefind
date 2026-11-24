import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { ApiError } from '@/lib/http';

export const sourceUseStatusSchema = z.enum(['CLEARED', 'RESTRICTED', 'UNRESOLVED']);
export type SourceUseStatus = z.infer<typeof sourceUseStatusSchema>;

export const sourceUseReviewSchema = z.object({
  sourceId: z.string().min(1).max(120),
  status: sourceUseStatusSchema,
  reason: z.string().trim().min(8).max(2000),
  basisUrl: z.string().url().max(2000).optional().or(z.literal('')),
}).strict().superRefine((value, ctx) => {
  if (value.status === 'CLEARED') {
    if (!value.basisUrl) ctx.addIssue({ code: 'custom', path: ['basisUrl'], message: 'A specific source-use basis URL is required for clearance.' });
    else {
      try { const url = new URL(value.basisUrl); if (url.protocol !== 'https:' || url.username || url.password) throw new Error(); }
      catch { ctx.addIssue({ code: 'custom', path: ['basisUrl'], message: 'Use an HTTPS source-use terms or license URL.' }); }
    }
  }
});

export function sourceRequiresExplicitUseAssessment(source: { license: string | null; notes: string | null }) {
  const text = `${source.license ?? ''} ${source.notes ?? ''}`.toLowerCase();
  return /permission.{0,40}not established|source[- ]use.{0,40}(review|required|unresolved)|reuse.{0,40}(unclear|unresolved|not established)/.test(text);
}

export async function latestSourceUseAssessments(db: Pick<Prisma.TransactionClient, 'auditLog'>, sourceIds: string[]) {
  if (!sourceIds.length) return new Map<string, { status: SourceUseStatus; reason: string; basisUrl: string | null; assessedAt: Date }>();
  const rows = await db.auditLog.findMany({
    where: { action: 'source.use.assessment', targetType: 'Source', targetId: { in: [...new Set(sourceIds)] } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { targetId: true, metadata: true, createdAt: true },
  });
  const latest = new Map<string, { status: SourceUseStatus; reason: string; basisUrl: string | null; assessedAt: Date }>();
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.targetId)) continue;
    seen.add(row.targetId);
    const parsed = z.object({ status: sourceUseStatusSchema, reason: z.string(), basisUrl: z.string().nullable().optional() }).safeParse(row.metadata);
    latest.set(row.targetId, parsed.success
      ? { status: parsed.data.status, reason: parsed.data.reason, basisUrl: parsed.data.basisUrl ?? null, assessedAt: row.createdAt }
      : { status: 'UNRESOLVED', reason: 'Latest source-use audit entry is malformed; inspect audit history.', basisUrl: null, assessedAt: row.createdAt });
  }
  return latest;
}

export async function recordSourceUseAssessment(db: PrismaClient, input: z.infer<typeof sourceUseReviewSchema> & { reviewerId: string }) {
  const { reviewerId, ...assessmentInput } = input;
  const parsed = sourceUseReviewSchema.parse(assessmentInput);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(180231, 3)`;
    const reviewer = await tx.user.findUniqueOrThrow({ where: { id: reviewerId } });
    if (reviewer.role !== 'ADMIN' || reviewer.deactivatedAt) throw new ApiError(403, 'FORBIDDEN', 'Reviewer access required');
    await tx.source.findUniqueOrThrow({ where: { id: parsed.sourceId }, select: { id: true } });
    const metadata: Prisma.InputJsonObject = {
      status: parsed.status,
      reason: parsed.reason,
      basisUrl: parsed.basisUrl || null,
      scope: 'SOURCE_USE_ONLY_NOT_FACTUAL_ACCURACY_APPROVAL',
    };
    return tx.auditLog.create({ data: {
      actorId: reviewer.id,
      action: 'source.use.assessment',
      targetType: 'Source',
      targetId: parsed.sourceId,
      metadata,
    } });
  });
}

export async function assertSourceUseAllowsApproval(db: Pick<Prisma.TransactionClient, 'auditLog'>, source: { id: string; license: string | null; notes: string | null }) {
  if (!sourceRequiresExplicitUseAssessment(source)) return;
  const latest = await latestSourceUseAssessments(db, [source.id]);
  const assessment = latest.get(source.id);
  if (assessment?.status !== 'CLEARED') {
    const message = assessment?.status === 'RESTRICTED'
      ? 'Source use is restricted; this claim cannot be approved for publication.'
      : 'Record a separate, source-backed source-use clearance before approving this claim.';
    throw new ApiError(409, 'SOURCE_USE_NOT_CLEARED', message);
  }
}

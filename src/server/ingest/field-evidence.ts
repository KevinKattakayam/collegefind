import type { PrismaClient } from '@prisma/client';
import { checksum } from './identity';
import { validateEvidenceDraft, type EvidenceDraft } from './evidence';
import { evidenceReviewHold } from '@/server/review-holds';
import { ApiError } from '@/lib/http';

// Monetary/cutoff/ranking records retain their dedicated typed tables.
const PROFILE_FIELDS = new Set(['description', 'about', 'website', 'phone', 'email', 'naacGrade', 'establishedYear', 'totalStudents', 'courses', 'topRecruiters', 'scholarships', 'facilities', 'admissions']);

export async function stageFieldEvidence(db: PrismaClient, input: {
  collegeId: string; sourceId: string; draft: EvidenceDraft;
  validFrom?: Date; validUntil?: Date; supersedesId?: string;
}) {
  input = { ...input, validFrom: input.validFrom ?? (input.draft.validFrom ? new Date(input.draft.validFrom) : undefined), validUntil: input.validUntil ?? (input.draft.validUntil ? new Date(input.draft.validUntil) : undefined) };
  const errors = validateEvidenceDraft(input.draft);
  if (errors.length || !PROFILE_FIELDS.has(input.draft.field) || input.draft.reviewState !== 'UNREVIEWED') throw new Error('Invalid unreviewed profile evidence');
  if ((input.validFrom && !Number.isFinite(input.validFrom.getTime())) || (input.validUntil && !Number.isFinite(input.validUntil.getTime())) || (input.validFrom && input.validUntil && input.validFrom > input.validUntil)) throw new Error('Invalid validity period');
  const source = await db.source.findUniqueOrThrow({ where: { id: input.sourceId } });
  if (source.url !== input.draft.sourceUrl || source.publisher !== input.draft.publisher || source.retrievedAt.toISOString() !== new Date(input.draft.retrievedAt).toISOString()) throw new Error('Source metadata mismatch');
  if (input.supersedesId) {
    const previous = await db.fieldEvidence.findUniqueOrThrow({ where: { id: input.supersedesId } });
    if (previous.collegeId !== input.collegeId || previous.field !== input.draft.field) throw new Error('Supersession scope mismatch');
  }
  const data = {
    collegeId: input.collegeId, sourceId: input.sourceId, field: input.draft.field,
    value: input.draft.value, unit: input.draft.unit, academicYear: input.draft.academicYear,
    publishedAt: input.draft.publishedAt ? new Date(input.draft.publishedAt) : undefined,
    validFrom: input.validFrom, validUntil: input.validUntil, supersedesId: input.supersedesId,
  };
  return db.fieldEvidence.upsert({ where: { identityKey: checksum(data) }, update: {}, create: { ...data, identityKey: checksum(data) } });
}

/** Reviewer identity is checked against current database roles; imports cannot approve claims. */
export async function reviewFieldEvidence(db: PrismaClient, input: {
  evidenceId: string; reviewerId: string; status: 'APPROVED' | 'REJECTED'; reason: string; expectedDecisionId?: string | null;
}) {
  if (!input.reason.trim() || !['APPROVED', 'REJECTED'].includes(input.status)) throw new Error('Review reason and decision required');
  return db.$transaction(async (tx) => {
    // Share the importer lock so a review cannot race a same-scope import.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(180231, 3)`;
    const reviewer = await tx.user.findUniqueOrThrow({ where: { id: input.reviewerId } });
    if (reviewer.role !== 'ADMIN') throw new Error('Reviewer access required');
    const claim = await tx.fieldEvidence.findUniqueOrThrow({ where: { id: input.evidenceId } });
    if (input.expectedDecisionId !== undefined) {
      const latest = await tx.evidenceDecision.findFirst({ where: { evidenceId: claim.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true } });
      if ((latest?.id ?? null) !== input.expectedDecisionId) throw new ApiError(409, 'REVIEW_CHANGED', 'Another reviewer changed this claim. Reload its current history before deciding.');
    }
    if (input.status === 'APPROVED') {
      if (claim.isFixture) throw new ApiError(409, 'FIXTURE_NOT_PUBLISHABLE', 'Fixture evidence cannot be published');
      const held = evidenceReviewHold(claim.id);
      if (held) throw new ApiError(409, 'EVIDENCE_ON_HOLD', held);
      const now = new Date();
      if (claim.validUntil && claim.validUntil < now) throw new ApiError(409, 'EVIDENCE_EXPIRED', 'Expired evidence cannot be published; obtain a current source or reject it');
      if (claim.validFrom && claim.validFrom > now) throw new ApiError(409, 'EVIDENCE_NOT_YET_VALID', 'Future-valid evidence cannot be published yet');
      const conflicts = await tx.$queryRaw<{ id: string; }[]>`
        SELECT other.id FROM "FieldEvidence" other
        LEFT JOIN LATERAL (
          SELECT status FROM "EvidenceDecision" d WHERE d."evidenceId"=other.id
          ORDER BY d."createdAt" DESC,d.id DESC LIMIT 1
        ) latest ON true
        WHERE other.id<>${claim.id} AND other."collegeId"=${claim.collegeId} AND other.field=${claim.field}
          AND other."programScope" IS NOT DISTINCT FROM ${claim.programScope}
          AND other."academicYear" IS NOT DISTINCT FROM ${claim.academicYear}
          AND (${claim.supersedesId}::text IS NULL OR other.id<>${claim.supersedesId})
          AND other.value<>${JSON.stringify(claim.value)}::jsonb
          AND NOT other."isFixture" AND latest.status IS DISTINCT FROM 'REJECTED'
          AND (other."validUntil" IS NULL OR other."validUntil">=CURRENT_TIMESTAMP)
          AND (other."validFrom" IS NULL OR other."validFrom"<=CURRENT_TIMESTAMP)
          AND NOT EXISTS (SELECT 1 FROM "FieldEvidence" successor
            JOIN "EvidenceDecision" decision ON decision."evidenceId"=successor.id AND decision.status='APPROVED'
            WHERE successor."supersedesId"=other.id)
        LIMIT 1`;
      if (conflicts.length) throw new ApiError(409, 'EVIDENCE_CONFLICT', 'Conflicting evidence remains unresolved; review the matching claims first');
    }
    const decisionData = { evidenceId: input.evidenceId, reviewerId: input.reviewerId, status: input.status, reason: input.reason };
    const decision = await tx.evidenceDecision.create({ data: decisionData });
    await tx.auditLog.create({ data: { actorId: reviewer.id, action: 'evidence.review', targetType: 'FieldEvidence', targetId: input.evidenceId, metadata: { status: input.status, reason: input.reason } } });
    return decision;
  });
}

/** Reuse the same append-only decisions for existing typed facts; no duplicated numeric values. */
export async function reviewTypedRecord(db: PrismaClient, input: {
  kind: 'cutoff' | 'fees' | 'placement' | 'ranking'; recordId: string;
  reviewerId: string; status: 'APPROVED' | 'REJECTED'; reason: string; expectedDecisionId?: string | null;
}) {
  if (!['cutoff', 'fees', 'placement', 'ranking'].includes(input.kind) || !input.reason.trim() || !['APPROVED', 'REJECTED'].includes(input.status)) throw new Error('Invalid record review');
  return db.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ locked: boolean; }>>`SELECT pg_advisory_xact_lock(180231, 4) IS NULL AS locked`;
    const reviewer = await tx.user.findUniqueOrThrow({ where: { id: input.reviewerId } });
    if (reviewer.role !== 'ADMIN') throw new Error('Reviewer access required');
    const target = { [`${input.kind}Id`]: input.recordId };
    if (input.expectedDecisionId !== undefined) {
      const where = input.kind === 'cutoff' ? { cutoffId: input.recordId } : input.kind === 'fees' ? { feesId: input.recordId } : input.kind === 'placement' ? { placementId: input.recordId } : { rankingId: input.recordId };
      const latest = await tx.evidenceDecision.findFirst({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true } });
      if ((latest?.id ?? null) !== input.expectedDecisionId) throw new ApiError(409, 'REVIEW_CHANGED', 'Another reviewer changed this record. Reload its current history before deciding.');
    }
    const decision = await tx.evidenceDecision.create({
      data: {
        ...target, reviewerId: reviewer.id, status: input.status, reason: input.reason,
      }
    });
    await tx.auditLog.create({ data: { actorId: reviewer.id, action: 'record.review', targetType: input.kind, targetId: input.recordId, metadata: { status: input.status, reason: input.reason } } });
    return decision;
  });
}

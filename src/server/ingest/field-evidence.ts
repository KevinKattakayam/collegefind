import type { PrismaClient } from '@prisma/client';
import { checksum } from './identity';
import { validateEvidenceDraft, type EvidenceDraft } from './evidence';

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
  evidenceId: string; reviewerId: string; status: 'APPROVED' | 'REJECTED'; reason: string;
}) {
  if (!input.reason.trim() || !['APPROVED', 'REJECTED'].includes(input.status)) throw new Error('Review reason and decision required');
  return db.$transaction(async (tx) => {
    const reviewer = await tx.user.findUniqueOrThrow({ where: { id: input.reviewerId } });
    if (reviewer.role !== 'ADMIN') throw new Error('Reviewer access required');
    const decision = await tx.evidenceDecision.create({ data: input });
    await tx.auditLog.create({ data: { actorId: reviewer.id, action: 'evidence.review', targetType: 'FieldEvidence', targetId: input.evidenceId, metadata: { status: input.status, reason: input.reason } } });
    return decision;
  });
}

/** Reuse the same append-only decisions for existing typed facts; no duplicated numeric values. */
export async function reviewTypedRecord(db: PrismaClient, input: {
  kind: 'cutoff' | 'fees' | 'placement' | 'ranking'; recordId: string;
  reviewerId: string; status: 'APPROVED' | 'REJECTED'; reason: string;
}) {
  if (!['cutoff', 'fees', 'placement', 'ranking'].includes(input.kind) || !input.reason.trim() || !['APPROVED', 'REJECTED'].includes(input.status)) throw new Error('Invalid record review');
  return db.$transaction(async (tx) => {
    const reviewer = await tx.user.findUniqueOrThrow({ where: { id: input.reviewerId } });
    if (reviewer.role !== 'ADMIN') throw new Error('Reviewer access required');
    const target = { [`${input.kind}Id`]: input.recordId };
    const decision = await tx.evidenceDecision.create({ data: {
      ...target, reviewerId: reviewer.id, status: input.status, reason: input.reason,
    } });
    await tx.auditLog.create({ data: { actorId: reviewer.id, action: 'record.review', targetType: input.kind, targetId: input.recordId, metadata: { status: input.status, reason: input.reason } } });
    return decision;
  });
}

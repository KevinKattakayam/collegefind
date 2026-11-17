/** Pure validation helpers for staged, field-level source evidence. */
export type EvidenceReviewState = 'UNREVIEWED' | 'APPROVED' | 'REJECTED';

export interface EvidenceDraft {
  field: string;
  value: string;
  unit?: string;
  publisher: string;
  sourceUrl: string;
  publishedAt?: string;
  validFrom?: string;
  validUntil?: string;
  academicYear?: number;
  retrievedAt: string;
  reviewState: EvidenceReviewState;
}

export function validateEvidenceDraft(draft: EvidenceDraft, now = new Date()): string[] {
  const errors: string[] = [];
  if (!/^[a-z][a-zA-Z0-9_.]{1,80}$/.test(draft.field)) errors.push('field');
  if (!draft.value.trim()) errors.push('value');
  if (!draft.publisher.trim()) errors.push('publisher');
  try {
    const url = new URL(draft.sourceUrl);
    if (url.protocol !== 'https:' || !url.hostname) errors.push('sourceUrl');
  } catch { errors.push('sourceUrl'); }
  const retrieved = new Date(draft.retrievedAt);
  if (!Number.isFinite(retrieved.getTime()) || retrieved > now) errors.push('retrievedAt');
  if (draft.publishedAt && !Number.isFinite(new Date(draft.publishedAt).getTime())) errors.push('publishedAt');
  if (draft.academicYear !== undefined && (!Number.isInteger(draft.academicYear) || draft.academicYear < 1900 || draft.academicYear > now.getUTCFullYear() + 1)) errors.push('academicYear');
  if (!['UNREVIEWED', 'APPROVED', 'REJECTED'].includes(draft.reviewState)) errors.push('reviewState');
  for (const key of ['validFrom', 'validUntil'] as const) {
    if (draft[key] && !Number.isFinite(new Date(draft[key]!).getTime())) errors.push(key);
  }
  if (draft.validFrom && draft.validUntil && new Date(draft.validFrom) > new Date(draft.validUntil)) errors.push('validityPeriod');
  return errors;
}

/** Stable content identity allows repeat imports to reconcile the same evidence. */
export function evidenceIdentity(draft: Pick<EvidenceDraft, 'field' | 'sourceUrl' | 'publishedAt' | 'academicYear' | 'value'>): string {
  return [draft.field.trim(), draft.sourceUrl.trim(), draft.publishedAt ?? '', draft.academicYear ?? '', draft.value.trim()].map((part) => JSON.stringify(part)).join('|');
}

export type ImportRunState = 'STAGED' | 'VALIDATED' | 'PUBLISHED' | 'PARTIAL' | 'FAILED';
const TRANSITIONS: Record<ImportRunState, ImportRunState[]> = {
  STAGED: ['VALIDATED', 'FAILED'],
  VALIDATED: ['PUBLISHED', 'PARTIAL', 'FAILED'],
  PUBLISHED: [], PARTIAL: ['VALIDATED', 'FAILED'], FAILED: ['STAGED'],
};

export function canTransitionImportRun(from: ImportRunState, to: ImportRunState): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Never pick arbitrarily between competing approved values or expired claims. */
export function resolveReviewedField(claims: {
  id: string; value: string; validUntil?: Date | null; validFrom?: Date | null;
  supersedesId?: string | null; decisions: { status: string; createdAt: Date }[];
}[], now = new Date()): { status: 'AVAILABLE' | 'CONFLICT' | 'UNKNOWN'; value: string | null } {
  const approved = claims.filter((claim) => {
    const latest = [...claim.decisions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    return latest?.status === 'APPROVED' && !claim.decisions.some((d) => d.createdAt.getTime() === latest.createdAt.getTime() && d.status !== 'APPROVED');
  });
  const superseded = new Set(approved.map((claim) => claim.supersedesId).filter(Boolean));
  const active = approved.filter((claim) => !superseded.has(claim.id) && (!claim.validFrom || claim.validFrom <= now) && (!claim.validUntil || claim.validUntil >= now));
  if (!active.length) return { status: 'UNKNOWN', value: null };
  if (new Set(active.map((claim) => claim.value)).size !== 1) return { status: 'CONFLICT', value: null };
  return { status: 'AVAILABLE', value: active[0].value };
}

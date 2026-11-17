import { resolveReviewedField } from './ingest/evidence';

export const publicEvidenceSelect = {
  reviews: { where: { status: 'APPROVED' as const }, select: { rating: true } },
  evidence: { include: { decisions: true, source: true } },
  feesRecords: { include: { decisions: true, source: true } },
} as const;

type Decision = { status: string; createdAt: Date };
type Claim = { id: string; field: string; value: unknown; academicYear: number | null; publishedAt: Date | null; validFrom: Date | null; validUntil: Date | null; supersedesId: string | null; decisions: Decision[]; source: { url: string; publisher: string; retrievedAt: Date } };
const FIELDS = ['description', 'about', 'website', 'phone', 'email', 'naacGrade', 'establishedYear', 'totalStudents', 'courses', 'topRecruiters'];
function officialSource(source: Claim['source'], now: Date) {
  try { const url = new URL(source.url); return url.protocol === 'https:' && !url.username && !url.password && !!source.publisher.trim() && source.retrievedAt <= now; } catch { return false; }
}

/** No fallback to legacy summaries: unavailable/conflicting facts stay unavailable. */
export function projectPublicCollege<T extends Record<string, unknown>>(college: T, now = new Date()): T {
  const out: Record<string, unknown> = { ...college, dataStatus: college.dataStatus === 'DEMO' ? 'DEMO' : 'UNVERIFIED' };
  const claims = (college.evidence ?? []) as Claim[];
  const fieldEvidence: Record<string, unknown> = {};
  for (const field of FIELDS) {
    const candidates = claims.filter((c) => c.field === field && officialSource(c.source, now) && (!c.publishedAt || c.publishedAt <= now));
    const eligible = candidates.map((c) => !c.validUntil && !(c.academicYear !== null && c.academicYear >= now.getUTCFullYear() - 1) && !['establishedYear', 'description', 'about'].includes(field) ? { ...c, validUntil: new Date(0) } : c);
    const resolved = resolveReviewedField(eligible.map((c) => ({ ...c, value: JSON.stringify(c.value) })), now);
    let value: unknown = resolved.value === null ? null : JSON.parse(resolved.value);
    if (typeof value === 'string' && ['totalStudents', 'establishedYear'].includes(field)) value = /^\d+$/.test(value) ? Number(value) : null;
    if (['courses', 'topRecruiters'].includes(field)) {
      if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = null; } }
      value = Array.isArray(value) && value.every((v) => typeof v === 'string') ? value : [];
    } else if (!['totalStudents', 'establishedYear'].includes(field) && value !== null && typeof value !== 'string') value = null;
    if (field === 'website' && value) { try { if (new URL(String(value)).protocol !== 'https:') value = null; } catch { value = null; } }
    if (field in college) out[field] = value;
    fieldEvidence[field] = { status: resolved.status === 'UNKNOWN' && candidates.length ? (candidates.some((c) => c.decisions.some((d) => d.status === 'APPROVED')) ? 'OUTDATED' : 'UNREVIEWED') : resolved.status, sources: resolved.status === 'AVAILABLE' ? eligible.filter((c) => [...c.decisions].sort((a,b) => b.createdAt.getTime()-a.createdAt.getTime())[0]?.status === 'APPROVED').map((c) => ({ url: c.source.url, publisher: c.source.publisher, retrievedAt: c.source.retrievedAt })) : [] };
  }
  for (const key of ['annualFees', 'placementPct', 'avgPackage', 'highestPackage', 'metricsYear', 'rating']) if (key in out) out[key] = null;
  // Only comparable college-wide annual tuition records; programme-specific/other fees cannot be substituted.
  const fees = (college.feesRecords ?? []) as { amountInr: number; programId: string | null; feeType: string; year: number; decisions: Decision[]; source: Claim['source'] }[];
  const approved = fees.filter((f) => f.programId === null && f.feeType === 'TUITION_PER_YEAR' && f.year >= now.getUTCFullYear() - 1 && f.year <= now.getUTCFullYear() && officialSource(f.source, now) && [...f.decisions].sort((a,b) => b.createdAt.getTime()-a.createdAt.getTime())[0]?.status === 'APPROVED' && !f.decisions.some((d) => d.status !== 'APPROVED' && d.createdAt.getTime() === Math.max(...f.decisions.map((item) => item.createdAt.getTime()))));
  const latest = Math.max(...approved.map((f) => f.year));
  const current = approved.filter((f) => f.year === latest);
  if (current.length && new Set(current.map((f) => f.amountInr)).size === 1 && 'annualFees' in out) { out.annualFees = current[0].amountInr; out.metricsYear = latest; }
  fieldEvidence.annualFees = { status: out.annualFees === null ? 'UNKNOWN' : 'AVAILABLE', year: Number.isFinite(latest) ? latest : null };
  const reviews = (college.reviews ?? []) as {rating:number}[];
  if ('rating' in out) out.rating = reviews.length ? reviews.reduce((sum,r) => sum+r.rating,0)/reviews.length : null;
  if ('reviewCount' in out) out.reviewCount = reviews.length;
  delete out.evidence; delete out.feesRecords; delete out.reviews;
  out.fieldEvidence = fieldEvidence;
  return out as T;
}

export function projectPublicResult<T>(value: T): T {
  if (value === null || typeof value !== 'object' || value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(projectPublicResult) as T;
  const object = Object.fromEntries(Object.entries(value).map(([key,item]) => [key, projectPublicResult(item)]));
  return ('dataStatus' in object && 'slug' in object ? projectPublicCollege(object) : object) as T;
}

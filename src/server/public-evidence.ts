import { resolveReviewedField } from './ingest/evidence';
import { structuredFact } from './ingest/structured-facts';

export const publicEvidenceSelect = {
  reviews: { where: { status: 'APPROVED' as const }, select: { rating: true } },
  evidence: { include: { decisions: true, source: true } },
  feesRecords: { include: { decisions: true, source: true } },
} as const;

type Decision = { status: string; createdAt: Date };
type Claim = { isFixture?: boolean; id: string; field: string; programScope?: string | null; value: unknown; academicYear: number | null; publishedAt: Date | null; validFrom: Date | null; validUntil: Date | null; supersedesId: string | null; decisions: Decision[]; source: { url: string; publisher: string; retrievedAt: Date } };
const FIELDS = ['admissions', 'description', 'about', 'website', 'phone', 'email', 'naacGrade', 'establishedYear', 'totalStudents', 'courses', 'topRecruiters'];
const UNDATED_FRESHNESS_DAYS: Record<string, number> = {
  admissions: 365, description: 1095, about: 1095, website: 365, phone: 180,
  email: 180, naacGrade: 365, totalStudents: 365, courses: 730, topRecruiters: 365,
};
function officialSource(source: Claim['source'], now: Date) {
  try { const url = new URL(source.url); return url.protocol === 'https:' && !url.username && !url.password && !!source.publisher.trim() && source.retrievedAt <= now; } catch { return false; }
}

function projectStructuredFacts(claims: Claim[], now: Date) {
  const groups = new Map<string, Claim[]>();
  for (const claim of claims) {
    if (claim.isFixture || !claim.field.startsWith('structured.') || !claim.programScope ||
        !officialSource(claim.source, now) || (claim.publishedAt && claim.publishedAt > now) ||
        (claim.academicYear !== null && claim.academicYear > now.getUTCFullYear())) continue;
    const fact = structuredFact.safeParse(claim.value);
    if (!fact.success || claim.field !== `structured.${fact.data.kind}`) continue;
    const key = JSON.stringify([claim.field, claim.programScope, claim.academicYear]);
    const group = groups.get(key) ?? [];
    group.push({ ...claim, value: fact.data });
    groups.set(key, group);
  }
  return [...groups.entries()].flatMap(([key, group]) => {
    const eligible = group.filter((claim) => {
      if (claim.validUntil || claim.field === 'structured.nirfRanking' || claim.field === 'structured.placement') return true;
      if (claim.academicYear !== null) return claim.academicYear >= now.getUTCFullYear() - 1;
      return now.getTime() - claim.source.retrievedAt.getTime() <= 365 * 86400000;
    });
    const resolved = resolveReviewedField(eligible.map((claim) => ({ ...claim, value: JSON.stringify(claim.value) })), now);
    if (resolved.status !== 'AVAILABLE') return [];
    const approved = eligible.filter((claim) =>
      resolveReviewedField([{ ...claim, value: JSON.stringify(claim.value) }], now).value === resolved.value);
    const claim = approved.sort((a, b) => b.source.retrievedAt.getTime() - a.source.retrievedAt.getTime() || a.id.localeCompare(b.id))[0];
    const decision = [...claim.decisions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    return [{ key, value: structuredFact.parse(claim.value), academicYear: claim.academicYear,
      validUntil: claim.validUntil, source: { url: claim.source.url, publisher: claim.source.publisher,
        publishedAt: claim.publishedAt, retrievedAt: claim.source.retrievedAt, reviewedAt: decision?.createdAt ?? null } }];
  });
}

/** No fallback to legacy summaries: unavailable/conflicting facts stay unavailable. */
export function projectPublicCollege<T extends Record<string, unknown>>(college: T, now = new Date()): T {
  const out: Record<string, unknown> = { ...college, dataStatus: college.dataStatus === 'DEMO' ? 'DEMO' : 'UNVERIFIED' };
  const claims = (college.evidence ?? []) as Claim[];
  out.structuredFacts = projectStructuredFacts(claims, now);
  const fieldEvidence: Record<string, unknown> = {};
  for (const field of FIELDS) {
    const candidates = claims.filter((c) => !c.isFixture && c.field === field && officialSource(c.source, now) && (!c.publishedAt || c.publishedAt <= now));
    const eligible = candidates.map((c) => {
      if (c.validUntil || field === 'establishedYear') return c;
      if (c.academicYear !== null) return c.academicYear >= now.getUTCFullYear() - 1 ? c : { ...c, validUntil: new Date(0) };
      const maxAgeDays = UNDATED_FRESHNESS_DAYS[field];
      if (maxAgeDays === undefined) return { ...c, validUntil: new Date(0) };
      return { ...c, validUntil: new Date(c.source.retrievedAt.getTime() + maxAgeDays * 86400000) };
    });
    const resolved = resolveReviewedField(eligible.map((c) => ({ ...c, value: JSON.stringify(c.value) })), now);
    let value: unknown = resolved.value === null ? null : JSON.parse(resolved.value);
    if (typeof value === 'string' && ['totalStudents', 'establishedYear'].includes(field)) value = /^\d+$/.test(value) ? Number(value) : null;
    if (['courses', 'topRecruiters'].includes(field)) {
      if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = null; } }
      value = Array.isArray(value) && value.every((v) => typeof v === 'string') ? value : [];
    } else if (!['totalStudents', 'establishedYear'].includes(field) && value !== null && typeof value !== 'string') value = null;
    if (['website','admissions'].includes(field) && value) { try { if (new URL(String(value)).protocol !== 'https:') value = null; } catch { value = null; } }
    if (field in college || field === 'admissions') out[field] = value;
    fieldEvidence[field] = { status: resolved.status === 'UNKNOWN' && candidates.length ? (candidates.some((c) => c.decisions.some((d) => d.status === 'APPROVED')) ? 'OUTDATED' : 'UNREVIEWED') : resolved.status, sources: resolved.status === 'AVAILABLE' ? eligible.filter((c) => [...c.decisions].sort((a,b) => b.createdAt.getTime()-a.createdAt.getTime())[0]?.status === 'APPROVED').map((c) => ({ url: c.source.url, publisher: c.source.publisher, publishedAt: c.publishedAt, retrievedAt: c.source.retrievedAt, reviewedAt: [...c.decisions].sort((a,b) => b.createdAt.getTime()-a.createdAt.getTime())[0]?.createdAt ?? null })) : [] };
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

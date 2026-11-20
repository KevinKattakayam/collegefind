import { createHash } from 'node:crypto';
import { z } from 'zod';
import archive from '../../data/pilot/staged-evidence-after-batch-027.json';
import batch29 from '../../data/pilot/substantive-research-batch-029.json';
import batch30 from '../../data/pilot/substantive-research-batch-030.json';
import batch31 from '../../data/pilot/substantive-research-batch-031.json';
import batch32 from '../../data/pilot/substantive-research-batch-032.json';
import coverage from '../../docs/DATA_COVERAGE.json';
import release from '../../data/pilot/source-reported-release.json';
import { evidenceReviewHold } from './review-holds';
import { structuredFact } from './ingest/structured-facts';

const nonempty = z.string().trim().min(1);
const decisionRow = z.strictObject({
  ref: nonempty, collegeId: nonempty, slug: nonempty, campus: nonempty, sourceTitle: nonempty,
  sourceUrl: z.url(), checkedAt: z.iso.datetime(), expiresAt: z.iso.datetime(),
  basis: z.literal('ATTRIBUTED_INDIVIDUAL_FACT'), usageAssessment: nonempty, fingerprint: z.hash('sha256'),
  status: z.enum(['PUBLISH', 'WITHDRAWN']), reason: nonempty,
});

type Identity = { id: string; slug: string };
type Candidate = {
  ref: string; collegeId: string; slug: string; value: unknown; field: string; locator: string | null;
  url: string; publisher: string; collectedAt: string; publicationDate: string | null;
  year: string | number | null; validFrom: string | null; validUntil: string | null;
};

const identity = new Map(archive.collegeIdentity.map(({ id, slug }) => [slug, id]));
const slugs = new Map(archive.collegeIdentity.map(({ id, slug }) => [id, slug]));
const sources = new Map(archive.sources.map((source) => [source.id, source]));
const candidates = new Map<string, Candidate>();
const heldRefs = new Set(coverage.humanReviewManifest.heldClaims.map(({ evidenceId }) => evidenceId));
for (const claim of archive.claims) {
  const source = sources.get(claim.sourceId);
  const slug = slugs.get(claim.collegeId);
  if (!source || !slug || claim.isFixture) continue;
  candidates.set(claim.id, {
    ref: claim.id, collegeId: claim.collegeId, slug, value: claim.value, field: claim.field,
    locator: claim.evidenceLocator, url: source.url, publisher: source.publisher, collectedAt: source.retrievedAt,
    publicationDate: claim.publishedAt ?? source.publishedAt, year: claim.academicYear, validFrom: claim.validFrom, validUntil: claim.validUntil,
  });
}
for (const batch of [batch29, batch30, batch31, batch32]) {
  for (const [index, claim] of batch.candidateClaims.entries()) {
    const source = batch.sources.find(({ id }) => id === claim.sourceIds[0]);
    const collegeId = identity.get(claim.institutionSlug);
    if (!collegeId || !source || source.institutionSlug !== claim.institutionSlug || !claim.stageable ||
        claim.field !== 'structured' || claim.reviewState !== 'UNREVIEWED' || claim.sourceIds.length !== 1) continue;
    const ref = `batch-${batch.batch}:${index}`;
    candidates.set(ref, {
      ref, collegeId, slug: claim.institutionSlug, value: claim.value, field: `structured.${claim.value.kind}`,
      locator: claim.evidenceLocation, url: source.url, publisher: source.publisher, collectedAt: source.retrievedAt,
      publicationDate: source.publicationDate, year: claim.academicYear ?? source.academicYear,
      validFrom: 'validFrom' in claim && typeof claim.validFrom === 'string' ? claim.validFrom : null,
      validUntil: 'validUntil' in claim && typeof claim.validUntil === 'string' ? claim.validUntil : null,
    });
  }
}

export function sourceReportedFingerprint(ref: string) {
  const candidate = candidates.get(ref);
  return candidate ? createHash('sha256').update(JSON.stringify(candidate)).digest('hex') : null;
}

function safeUrl(value: string) {
  const url = URL.parse(value);
  return !!url && url.protocol === 'https:' && !url.username && !url.password && !url.port;
}

const policy = z.strictObject({ version: z.literal(1), records: z.array(decisionRow) }).parse(release);
const factsBySlug = new Map<string, typeof policy.records>();
for (const record of policy.records) {
  const matching = factsBySlug.get(record.slug) ?? [];
  matching.push(record);
  factsBySlug.set(record.slug, matching);
}

const candidatesByCollege = new Map<string, Candidate[]>();
for (const candidate of candidates.values()) {
  const group = candidatesByCollege.get(candidate.collegeId) ?? [];
  group.push(candidate);
  candidatesByCollege.set(candidate.collegeId, group);
}

const maxReviewAgeMs = 90 * 86_400_000;

export function eligibleSourceReported(college: Identity, now = new Date(), records = factsBySlug.get(college.slug) ?? []) {
  return records.flatMap((raw) => {
    const parsed = decisionRow.safeParse(raw);
    if (!parsed.success) return [];
    const record = parsed.data;
    const c = candidates.get(record.ref);
    if (!c || heldRefs.has(record.ref) || evidenceReviewHold(record.ref) || record.status !== 'PUBLISH' || !c.locator || !c.publisher.trim() ||
        record.collegeId !== college.id || c.collegeId !== college.id || record.slug !== college.slug || c.slug !== college.slug ||
        c.url !== record.sourceUrl || !safeUrl(c.url) || sourceReportedFingerprint(record.ref) !== record.fingerprint ||
        records.filter(({ ref }) => ref === record.ref).length !== 1) return [];
    const collected = Date.parse(c.collectedAt);
    const checked = Date.parse(record.checkedAt);
    const expires = Date.parse(record.expiresAt);
    if (!Number.isFinite(collected) || checked < collected || checked > +now || expires <= +now ||
        expires - checked > maxReviewAgeMs || (c.validFrom && !(Date.parse(c.validFrom) <= +now)) ||
        (c.validUntil && !(Date.parse(c.validUntil) > +now)) ||
        (c.publicationDate && !(Date.parse(c.publicationDate) <= +now))) return [];
    // Pilot covers standing programme pages and campus facilities. Intake-specific
    // or decision-critical facts require a separate policy and human review.
    if (c.year !== null) return [];
    const fact = structuredFact.safeParse(c.value);
    if (!fact.success || c.field !== `structured.${fact.data.kind}` ||
        (fact.data.kind !== 'programme' && fact.data.kind !== 'facility')) return [];
    return [{
      ref: c.ref, value: fact.data, campus: record.campus, publisher: c.publisher, url: c.url,
      evidenceLocation: c.locator, sourceTitle: record.sourceTitle, collectedAt: c.collectedAt,
      publicationDate: c.publicationDate, checkedAt: record.checkedAt, status: 'OFFICIAL_SOURCE_REPORTED' as const,
    }];
  });
}

export type SourceReportedFact = ReturnType<typeof eligibleSourceReported>[number];

type EvidenceRow = {
  id: string; field: string; value: unknown; isFixture: boolean; academicYear: number | null;
  validFrom: Date | null; validUntil: Date | null; supersedesId: string | null;
  decisions: { status: string }[];
};

function scoped(value: unknown) {
  const parsed = structuredFact.safeParse(value);
  if (!parsed.success) return null;
  if (parsed.data.kind === 'programme') return ['programme', parsed.data.programme.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')].join(':');
  if (parsed.data.kind === 'facility') return ['facility', parsed.data.facility.toLowerCase().trim()].join(':');
  return null;
}

function sameFact(a: unknown, b: unknown) {
  const left = structuredFact.safeParse(a);
  const right = structuredFact.safeParse(b);
  return left.success && right.success && JSON.stringify(left.data) === JSON.stringify(right.data);
}

export function suppressSourceReported(facts: SourceReportedFact[], rows: EvidenceRow[], reviewed: { value: unknown }[], now = new Date()) {
  const unique = new Set<string>();
  return facts.filter((fact) => {
    const scope = scoped(fact.value);
    if (!scope || unique.has(scope) ||
        reviewed.some(({ value }) => scoped(value) === scope) ||
        facts.some((peer) => scoped(peer.value) === scope && !sameFact(peer.value, fact.value))) return false;
    if (rows.some((row) => {
      if (row.isFixture || row.field !== `structured.${fact.value.kind}`) return false;
      const applies = row.id === fact.ref || scoped(row.value) === scope;
      if (!applies) return false;
      if (heldRefs.has(row.id) || evidenceReviewHold(row.id) || ['REJECTED', 'PENDING'].includes(row.decisions[0]?.status ?? '')) return true;
      if (row.academicYear !== null || (row.validFrom && row.validFrom > now) || (row.validUntil && row.validUntil <= now)) return row.id === fact.ref;
      return row.supersedesId === fact.ref || row.decisions[0]?.status === 'APPROVED' || !sameFact(row.value, fact.value);
    })) return false;
    const archivedPeers = candidatesByCollege.get(candidates.get(fact.ref)?.collegeId ?? '') ?? [];
    if (archivedPeers.some((peer) => peer.year === null &&
        peer.field === `structured.${fact.value.kind}` && scoped(peer.value) === scope && !sameFact(peer.value, fact.value))) return false;
    unique.add(scope);
    return true;
  });
}

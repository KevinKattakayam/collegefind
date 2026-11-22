import { createHash } from 'node:crypto';
import { z } from 'zod';
import archive from '../../data/pilot/staged-evidence-after-batch-027.json';
import batch29 from '../../data/pilot/substantive-research-batch-029.json';
import batch30 from '../../data/pilot/substantive-research-batch-030.json';
import batch31 from '../../data/pilot/substantive-research-batch-031.json';
import batch32 from '../../data/pilot/substantive-research-batch-032.json';
import batch33 from '../../data/pilot/substantive-research-batch-033.json';
import batch34 from '../../data/pilot/substantive-research-batch-034.json';
import batch35 from '../../data/pilot/substantive-research-batch-035.json';
import batch36 from '../../data/pilot/substantive-research-batch-036.json';
import batch37 from '../../data/pilot/substantive-research-batch-037.json';
import batch38 from '../../data/pilot/substantive-research-batch-038.json';
import batch39 from '../../data/pilot/substantive-research-batch-039.json';
import batch40 from '../../data/pilot/substantive-research-batch-040.json';
import batch41 from '../../data/pilot/substantive-research-batch-041.json';
import batch42 from '../../data/pilot/substantive-research-batch-042.json';
import batch43 from '../../data/pilot/substantive-research-batch-043.json';
import batch44 from '../../data/pilot/substantive-research-batch-044.json';
import batch45 from '../../data/pilot/substantive-research-batch-045.json';
import batch46 from '../../data/pilot/substantive-research-batch-046.json';
import batch47 from '../../data/pilot/substantive-research-batch-047.json';
import batch48 from '../../data/pilot/substantive-research-batch-048.json';
import batch49 from '../../data/pilot/substantive-research-batch-049.json';
import batch50 from '../../data/pilot/substantive-research-batch-050.json';
import batch51 from '../../data/pilot/substantive-research-batch-051.json';
import batch52 from '../../data/pilot/substantive-research-batch-052.json';
import batch53 from '../../data/pilot/substantive-research-batch-053.json';
import batch54 from '../../data/pilot/substantive-research-batch-054.json';
import batch55 from '../../data/pilot/substantive-research-batch-055.json';
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
  publisherPeriod: nonempty.optional(), historical: z.boolean().optional(),
  scopeSourceUrl: z.url().optional(), scopeSourceTitle: nonempty.optional(), scopeEvidenceLocation: nonempty.optional(),
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
for (const batch of [batch29, batch30, batch31, batch32, batch33, batch34, batch35, batch36, batch37, batch38, batch39, batch40, batch41, batch42, batch43, batch44, batch45, batch46, batch47, batch48, batch49, batch50, batch51, batch52, batch53, batch54, batch55]) {
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

function academicStart(year: Candidate['year']) {
  if (year === null) return null;
  const match = /^(20[0-9]{2})(?:[-–]([0-9]{2}|20[0-9]{2}))?$/.exec(String(year));
  if (!match) return NaN;
  const start = Number(match[1]);
  return !match[2] || [String(start + 1), String(start + 1).slice(-2)].includes(match[2]) ? start : NaN;
}

function samePeriod(a: Candidate['year'], b: Candidate['year']) {
  return academicStart(a) === academicStart(b);
}

const maxReviewAgeMs = 90 * 86_400_000;

export function eligibleSourceReported(college: Identity, now = new Date(), records = factsBySlug.get(college.slug) ?? []) {
  return records.flatMap((raw) => {
    const parsed = decisionRow.safeParse(raw);
    if (!parsed.success) return [];
    const record = parsed.data;
    const scopeFields = [record.scopeSourceUrl, record.scopeSourceTitle, record.scopeEvidenceLocation];
    if ((scopeFields.some(Boolean) && !scopeFields.every(Boolean)) ||
        (record.scopeSourceUrl !== undefined && !safeUrl(record.scopeSourceUrl))) return [];
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
    const start = academicStart(c.year);
    if (start !== null && (!Number.isFinite(start) || start > now.getUTCFullYear() + 2)) return [];
    const withdrawn = [...(factsBySlug.get(college.slug) ?? []), ...records].some((other) => {
      const previous = candidates.get(other.ref);
      return other.status === 'WITHDRAWN' && previous && scoped(previous.value) === scoped(c.value) &&
        (previous.year === null || c.year === null || samePeriod(previous.year, c.year));
    });
    if (withdrawn) return [];
    const fact = structuredFact.safeParse(c.value);
    if (!fact.success || c.field !== `structured.${fact.data.kind}` ||
        (fact.data.kind !== 'programme' && fact.data.kind !== 'facility' &&
          fact.data.kind !== 'contact' && fact.data.kind !== 'admission')) return [];
    if (fact.data.kind === 'admission') {
      const { eligibility, applicationUrl, programme, category, route, exam, counselling } = fact.data;
      const description = [programme, category, route, exam, counselling].join(' ');
      if (start === null || !record.publisherPeriod || eligibility || applicationUrl ||
          /[%₹]|\b(?:percentile|cutoff|cut-off)\b|\b\d[\d,]*\s+seats?\b/i.test(description)) return [];
    }
    return [{
      ref: c.ref, value: fact.data, campus: record.campus, publisher: c.publisher, url: c.url,
      evidenceLocation: c.locator, sourceTitle: record.sourceTitle, collectedAt: c.collectedAt,
      publicationDate: c.publicationDate, academicYear: c.year, validFrom: c.validFrom, validUntil: c.validUntil,
      publisherPeriod: record.publisherPeriod,
      scopeVerification: record.scopeSourceUrl && record.scopeSourceTitle && record.scopeEvidenceLocation
        ? { url: record.scopeSourceUrl, title: record.scopeSourceTitle, evidenceLocation: record.scopeEvidenceLocation }
        : undefined,
      historical: record.historical === true || (start !== null && start < now.getUTCFullYear()), checkedAt: record.checkedAt, status: 'OFFICIAL_SOURCE_REPORTED' as const,
    }];
  });
}

export type SourceReportedFact = ReturnType<typeof eligibleSourceReported>[number];

type EvidenceRow = {
  id: string; field: string; value: unknown; isFixture: boolean; academicYear: number | null;
  validFrom: Date | null; validUntil: Date | null; supersedesId: string | null;
  decisions: { status: string }[];
};

function programmeScope(name: string) {
  const programme = name.toLowerCase().replace(/\s+in\s+/g, ' ').replaceAll('&', 'and')
    .replace(/\s*\(\d+ (?:years?|months?|semesters?)\)$/, '').replace(/[^\p{L}\p{N}]/gu, '');
  return `programme:${programme}`;
}

function matchesScope(value: unknown, scope: string) {
  return Array.isArray(value)
    ? value.some((name) => typeof name === 'string' && programmeScope(name) === scope)
    : scoped(value) === scope;
}

function scoped(value: unknown) {
  const parsed = structuredFact.safeParse(value);
  if (!parsed.success) return null;
  if (parsed.data.kind === 'programme') return programmeScope(parsed.data.programme);
  if (parsed.data.kind === 'admission') return JSON.stringify(['admission', programmeScope(parsed.data.programme), parsed.data.category.toLowerCase()]);
  if (parsed.data.kind === 'contact') return JSON.stringify(['contact', parsed.data.office.toLowerCase(), parsed.data.channel]);
  if (parsed.data.kind === 'facility') return ['facility', parsed.data.facility.toLowerCase().trim()].join(':');
  return null;
}

function compatibleFact(a: unknown, b: unknown) {
  const left = structuredFact.safeParse(a);
  const right = structuredFact.safeParse(b);
  if (!left.success || !right.success) return false;
  if (left.data.kind === 'programme' && right.data.kind === 'programme') {
    return scoped(left.data) === scoped(right.data) && left.data.level === right.data.level &&
      (left.data.durationMonths === undefined || right.data.durationMonths === undefined ||
        left.data.durationMonths === right.data.durationMonths) &&
      (left.data.durationSemesters === undefined || right.data.durationSemesters === undefined ||
        left.data.durationSemesters === right.data.durationSemesters);
  }
  if (left.data.kind === 'admission' && right.data.kind === 'admission') {
    return left.data.route === right.data.route && left.data.exam === right.data.exam &&
      left.data.counselling === right.data.counselling;
  }
  return JSON.stringify(left.data) === JSON.stringify(right.data);
}

export function suppressSourceReported(facts: SourceReportedFact[], rows: EvidenceRow[], reviewed: { value: unknown }[], now = new Date()) {
  const unique = new Set<string>();
  return facts.filter((fact) => {
    const scope = scoped(fact.value);
    const periodKey = JSON.stringify([scope, academicStart(fact.academicYear)]);
    if (!scope || unique.has(periodKey) ||
        reviewed.some(({ value }) => scoped(value) === scope) ||
        facts.some((peer) => scoped(peer.value) === scope && samePeriod(peer.academicYear, fact.academicYear) && !compatibleFact(peer.value, fact.value))) return false;
    if (rows.some((row) => {
      const legacyCourses = fact.value.kind === 'programme' && row.field === 'courses';
      if (row.isFixture || (!legacyCourses && row.field !== `structured.${fact.value.kind}`)) return false;
      const applies = row.id === fact.ref || matchesScope(row.value, scope);
      const active = (!row.validFrom || row.validFrom <= now) && (!row.validUntil || row.validUntil > now);
      if (row.supersedesId === fact.ref && active) return true;
      if (!applies) return false;
      const decisionApplies = row.id === fact.ref || row.academicYear === null ||
        fact.academicYear === null || samePeriod(row.academicYear, fact.academicYear);
      if (decisionApplies && (heldRefs.has(row.id) || evidenceReviewHold(row.id) ||
          ['REJECTED', 'PENDING'].includes(row.decisions[0]?.status ?? ''))) return true;
      if (!active) return row.id === fact.ref;
      return samePeriod(row.academicYear, fact.academicYear) &&
        (row.decisions[0]?.status === 'APPROVED' || (!legacyCourses && !compatibleFact(row.value, fact.value)));
    })) return false;
    const archivedPeers = candidatesByCollege.get(candidates.get(fact.ref)?.collegeId ?? '') ?? [];
    if (archivedPeers.some((peer) => matchesScope(peer.value, scope) &&
        (peer.year === null || fact.academicYear === null || samePeriod(peer.year, fact.academicYear)) &&
        (heldRefs.has(peer.ref) || evidenceReviewHold(peer.ref)))) return false;
    if (archivedPeers.some((peer) => samePeriod(peer.year, fact.academicYear) &&
        (!peer.validFrom || Date.parse(peer.validFrom) <= +now) && (!peer.validUntil || Date.parse(peer.validUntil) > +now) &&
        peer.field === `structured.${fact.value.kind}` && scoped(peer.value) === scope && !compatibleFact(peer.value, fact.value))) return false;
    unique.add(periodKey);
    return true;
  });
}

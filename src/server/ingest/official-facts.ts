import { z } from 'zod';
import type { Prisma, PrismaClient } from '@prisma/client';
import { checksum } from './identity';
import { structuredFact, structuredScope } from './structured-facts';

const sourceSchema = z.object({
  id: z.string().min(1),
  institutionSlug: z.string().min(1),
  publisher: z.string().trim().min(1),
  title: z.string().trim().min(1).optional(),
  url: z.url().startsWith('https://'),
  publicationDate: z.iso.date().nullable(),
  academicYear: z.string().nullable(),
  retrievedAt: z.iso.datetime(),
  access: z.enum(['PUBLIC_HTML_READ', 'PUBLIC_PDF_READ', 'REGISTERED_INDIVIDUAL_FACT_RELEASE']),
  reuseConditions: z.string().trim().min(1),
  evidenceLocations: z.array(z.string().trim().min(1)).min(1),
}).strict();

const claimBase = z.object({
  institutionSlug: z.string().min(1),
  sourceIds: z.array(z.string().min(1)).length(1),
  academicYear: z.string().nullable(),
  evidenceLocation: z.string().trim().min(1),
  status: z.literal('RESEARCHED_READY_FOR_UNREVIEWED_STAGING'),
  reviewState: z.literal('UNREVIEWED'),
  stageable: z.literal(true),
}).strict();
const claimSchema = z.union([
  claimBase.extend({
    field: z.enum(['courses', 'admissions', 'phone', 'email']),
    value: z.union([z.string().trim().min(1), z.array(z.string().trim().min(1)).min(1)]),
  }),
  claimBase.extend({
    field: z.literal('structured'), value: structuredFact,
    validFrom: z.iso.date().optional(), validUntil: z.iso.date().optional(),
  campusScope: z.string().trim().min(1).optional(),
  applicablePeriod: z.string().trim().min(1).optional(),
  publisherPeriod: z.string().trim().min(1).optional(),
  historical: z.boolean().optional(),
  sourceReportedRef: z.string().trim().min(1).optional(),
  }),
]);

export const officialFactsManifestSchema = z.object({
  scope: z.literal('RESEARCH_NOTES_WITH_IMPORTABLE_CANDIDATES'),
  sources: z.array(sourceSchema).min(1),
  candidateClaims: z.array(claimSchema).min(1).max(25),
}).passthrough();

export type OfficialFactsManifest = z.infer<typeof officialFactsManifestSchema>;

export type OfficialFactsDryRunResult = {
  status: 'DRY_RUN'; facts: number; reviewState: 'UNREVIEWED';
};
export type OfficialFactsImportResult = {
  status: 'STAGED'; facts: number; reviewState: 'UNREVIEWED';
  staged: number; reused: number; createdSources: number; createdRuns: number; repairedRuns: number;
  claimResults: Array<{ institutionSlug: string; field: string; evidenceId: string; sourceId: string; sourceUrl: string; status: 'STAGED' | 'REUSED' }>;
  databaseChanged: boolean;
};

function yearNumber(year: string | null): number | undefined {
  if (year === null) return undefined;
  const match = /^(\d{4})(?:-\d{2,4})?$/.exec(year);
  if (!match) throw new Error(`Unsupported academic year: ${year}`);
  return Number(match[1]);
}

export function validateOfficialFacts(input: unknown, now = new Date()) {
  const manifest = officialFactsManifestSchema.parse(input);
  const sources = new Map(manifest.sources.map((source) => [source.id, source]));
  if (sources.size !== manifest.sources.length) throw new Error('Duplicate source identifiers in manifest');
  const releaseRefs = new Set<string>();
  const semanticClaims = new Set<string>();
  for (const source of manifest.sources) {
    const url = new URL(source.url);
    if (url.username || url.password || new Date(source.retrievedAt) > now) throw new Error('Invalid source identity or collection time');
  }
  return manifest.candidateClaims.map((claim) => {
    if (claim.field === 'structured' && claim.sourceReportedRef) {
      if (releaseRefs.has(claim.sourceReportedRef)) throw new Error('Duplicate source-reported release reference in manifest');
      releaseRefs.add(claim.sourceReportedRef);
    }
    const source = sources.get(claim.sourceIds[0]);
    if (!source || source.institutionSlug !== claim.institutionSlug) throw new Error('Claim/source institution mismatch');
    const academicYear = yearNumber(claim.academicYear);
    if (source.academicYear && claim.academicYear && source.academicYear !== claim.academicYear) throw new Error('Claim/source academic year mismatch');
    if (Array.isArray(claim.value) && claim.field !== 'courses') throw new Error('Array values are only valid for course lists');
    if (!Array.isArray(claim.value) && claim.field === 'courses') throw new Error('Course facts must be an array to preserve public projection semantics');
    if (claim.field === 'structured') {
      const { kind } = claim.value;
      if (['admission', 'fee', 'nirfRanking', 'placement'].includes(kind) && academicYear === undefined) {
        throw new Error('Structured claim requires a reporting or academic year');
      }
      if (academicYear !== undefined && (academicYear < 1900 || academicYear > now.getUTCFullYear() + 1)) {
        throw new Error('Structured claim year out of range');
      }
      if ((claim.validFrom && claim.validUntil && claim.validFrom > claim.validUntil) ||
          (kind === 'recognition' && (!claim.validFrom || !claim.validUntil))) throw new Error('Invalid structured validity period');
      if (source.publicationDate && source.publicationDate > source.retrievedAt.slice(0, 10)) throw new Error('Publication after collection');
      const scope = JSON.stringify(structuredScope(claim.value).map((part) => part.normalize('NFKC').replace(/\s+/g, ' ').toLowerCase()));
      const semanticKey = checksum([claim.institutionSlug, `structured.${kind}`, claim.value, academicYear ?? null, scope, new URL(source.url).href]);
      if (semanticClaims.has(semanticKey)) throw new Error('Duplicate semantic fact in manifest');
      semanticClaims.add(semanticKey);
      return { claim, source, academicYear, field: `structured.${kind}`, scope };
    }
    return { claim, source, academicYear, field: claim.field, scope: claim.academicYear ? `Academic year ${claim.academicYear}` : null };
  });
}

/**
 * Atomically stages a bounded batch of manually researched official facts.
 * It creates only UNREVIEWED evidence and never updates College summary fields.
 */
export function importOfficialFacts(db: null, input: unknown, dryRun?: true, now?: Date): Promise<OfficialFactsDryRunResult>;
export function importOfficialFacts(db: null, input: unknown, dryRun: true, now?: Date): Promise<OfficialFactsDryRunResult>;
export function importOfficialFacts(db: PrismaClient, input: unknown, dryRun: false, now?: Date): Promise<OfficialFactsImportResult>;
export async function importOfficialFacts(
  db: PrismaClient | null,
  input: unknown,
  dryRun = true,
  now = new Date(),
): Promise<OfficialFactsDryRunResult | OfficialFactsImportResult> {
  const rows = validateOfficialFacts(input, now);
  const facts = rows.length;
  if (dryRun) return { status: 'DRY_RUN', facts, reviewState: 'UNREVIEWED' };
  if (!db) throw new Error('A validated disposable database client is required to apply official facts');

  return stageOfficialFactRows(db, rows);
}

export type OfficialFactRows = ReturnType<typeof validateOfficialFacts>;

function sourceFingerprint(source: OfficialFactRows[number]['source']) {
  return checksum(['official-fact-source-v1', source.publisher, source.title ?? null, new URL(source.url).href, source.retrievedAt, source.publicationDate, source.reuseConditions]);
}

export async function stageOfficialFactRows(db: PrismaClient, rows: OfficialFactRows, ownerPlan?: (tx: Prisma.TransactionClient, rows: OfficialFactRows) => Promise<OfficialFactRows>): Promise<OfficialFactsImportResult> {
  return db.$transaction(async (tx) => {
    // Serialize this bounded importer so concurrent retries cannot duplicate audit events.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(180231, 3)`;
    const plannedRows = ownerPlan ? await ownerPlan(tx, rows) : rows;
    const collegeBySlug = new Map<string, { id: string }>();
    for (const slug of new Set(plannedRows.map(({ claim }) => claim.institutionSlug))) {
      collegeBySlug.set(slug, await tx.college.findUniqueOrThrow({ where: { slug }, select: { id: true } }));
    }
    const selectedRows: OfficialFactRows = [];
    const reusedClaims: Array<{ institutionSlug: string; field: string; evidenceId: string; sourceId: string; sourceUrl: string; status: 'REUSED' }> = [];
    for (const row of plannedRows) {
      const { claim, source, field, academicYear, scope } = row;
      const college = collegeBySlug.get(claim.institutionSlug)!;
      const sourceKey = sourceFingerprint(source);
      const validity = claim.field === 'structured' ? [claim.validFrom ?? null, claim.validUntil ?? null] : [];
      const identityKey = checksum([college.id, field, claim.value, sourceKey, academicYear ?? null, claim.academicYear, ...validity, claim.field === 'structured' ? claim.sourceReportedRef ?? null : null]);
      const priorRelease = claim.field === 'structured' && claim.sourceReportedRef
        ? await tx.fieldEvidence.findUnique({ where: { sourceReportedRef: claim.sourceReportedRef }, select: { id: true, identityKey: true, sourceId: true } })
        : null;
      const releaseRef = claim.field === 'structured' ? claim.sourceReportedRef : undefined;
      if (priorRelease && priorRelease.identityKey !== identityKey) {
        throw new Error(`Source-reported release ${releaseRef} already exists with different data; preserve the prior record and review a correction separately`);
      }
      const existing = await tx.fieldEvidence.findUnique({ where: { identityKey }, select: { id: true, sourceId: true } });
      const duplicate = existing ?? (claim.field === 'structured'
        ? await tx.fieldEvidence.findFirst({
          where: {
            collegeId: college.id, field, value: { equals: claim.value as Prisma.InputJsonValue },
            academicYear: academicYear ?? null, programScope: scope,
            source: { is: { url: source.url } },
          },
          select: { id: true, sourceId: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        })
        : null);
      if (duplicate) {
        reusedClaims.push({ institutionSlug: claim.institutionSlug, field, evidenceId: duplicate.id, sourceId: duplicate.sourceId, sourceUrl: source.url, status: 'REUSED' });
      } else selectedRows.push(row);
    }
    const sourceIds = new Map<string, string>();
    const sourceKeys = new Map<string, string>();
    let createdSources = 0;
    for (const { source } of selectedRows) {
      if (sourceIds.has(source.id)) continue;
      const sourceKey = sourceFingerprint(source);
      const priorSource = await tx.source.findUnique({ where: { identityKey: sourceKey }, select: { id: true } });
      const stored = await tx.source.upsert({
        where: { identityKey: sourceKey },
        update: {},
        create: {
          identityKey: sourceKey,
          name: source.title ?? `Official source facts (${source.institutionSlug})`,
          publisher: source.publisher,
          url: source.url,
          license: source.access === 'REGISTERED_INDIVIDUAL_FACT_RELEASE'
            ? 'Individual factual attribution release recorded in the source-reported register; no bulk source text or tables stored'
            : 'Short factual extraction with attribution and source link only; explicit bulk reuse permission not established',
          retrievedAt: new Date(source.retrievedAt),
          publishedAt: source.publicationDate ? new Date(`${source.publicationDate}T00:00:00.000Z`) : null,
          notes: `${source.access}; ${source.reuseConditions}; no document or source prose stored`,
        },
      });
      if (!priorSource) createdSources += 1;
      sourceIds.set(source.id, stored.id);
      sourceKeys.set(source.id, sourceKey);
    }

    const claimsBySource = new Map<string, OfficialFactRows>();
    for (const row of selectedRows) {
      const sourceId = row.source.id;
      claimsBySource.set(sourceId, [...(claimsBySource.get(sourceId) ?? []), row]);
    }
    let staged = 0;
    let reused = rows.length - selectedRows.length;
    let createdRuns = 0;
    let repairedRuns = 0;
    const claimResults: Array<{ institutionSlug: string; field: string; evidenceId: string; sourceId: string; sourceUrl: string; status: 'STAGED' | 'REUSED' }> = [...reusedClaims];
    for (const [sourceManifestId, sourceRows] of claimsBySource) {
      let sourceStaged = 0;
      let sourceReused = 0;
      const sourceId = sourceIds.get(sourceManifestId)!;
      const sourceKey = sourceKeys.get(sourceManifestId)!;
      const runChecksum = checksum(sourceRows.map(({ claim, academicYear }) => ({
        slug: claim.institutionSlug, field: claim.field, value: claim.value,
        academicYear, evidenceLocation: claim.evidenceLocation,
        ...(claim.field === 'structured' ? {
          validFrom: claim.validFrom, validUntil: claim.validUntil, campusScope: claim.campusScope,
          applicablePeriod: claim.applicablePeriod, publisherPeriod: claim.publisherPeriod,
          historical: claim.historical, sourceReportedRef: claim.sourceReportedRef,
        } : {}),
      })));
      const runKey = checksum(['official-fact-import-v1', sourceKey, runChecksum]);
      const priorRun = await tx.importRun.findUnique({ where: { identityKey: runKey }, select: { id: true, startedAt: true, finishedAt: true } });
      const run = await tx.importRun.upsert({
        where: { identityKey: runKey },
        update: {},
        create: { identityKey: runKey, checksum: runChecksum, sourceId, status: 'STAGED', summary: { candidates: sourceRows.length, reviewState: 'UNREVIEWED' } },
      });
      if (!priorRun) createdRuns += 1;
      for (const { claim, academicYear, field, scope } of sourceRows) {
        const college = collegeBySlug.get(claim.institutionSlug)!;
        const value = claim.value;
        const validity = claim.field === 'structured' ? [claim.validFrom ?? null, claim.validUntil ?? null] : [];
        const identityKey = checksum([college.id, field, value, sourceKey, academicYear ?? null, claim.academicYear, ...validity, claim.field === 'structured' ? claim.sourceReportedRef ?? null : null]);
        if (claim.field === 'structured' && claim.sourceReportedRef) {
          const priorRelease = await tx.fieldEvidence.findUnique({ where: { sourceReportedRef: claim.sourceReportedRef }, select: { id: true, identityKey: true } });
          if (priorRelease && priorRelease.identityKey !== identityKey) {
            throw new Error(`Source-reported release ${claim.sourceReportedRef} already exists with different data; preserve the prior record and review a correction separately`);
          }
        }
        const existing = await tx.fieldEvidence.findUnique({ where: { identityKey }, select: { id: true } });
        const evidence = await tx.fieldEvidence.upsert({
          where: { identityKey },
          update: {},
          create: {
            identityKey,
            collegeId: college.id,
            sourceId,
            field,
            value,
            academicYear: academicYear ?? null,
            programScope: scope,
            ...(claim.field === 'structured' ? {
              campusScope: claim.campusScope ?? null,
              applicablePeriod: claim.applicablePeriod ?? null,
              publisherPeriod: claim.publisherPeriod ?? null,
              historical: claim.historical ?? false,
              sourceReportedRef: claim.sourceReportedRef ?? null,
            } : {}),
            ...(claim.field === 'structured' ? {
              validFrom: claim.validFrom ? new Date(claim.validFrom) : null,
              validUntil: claim.validUntil ? new Date(`${claim.validUntil}T23:59:59.999Z`) : null,
            } : {}),
            publishedAt: claim.sourceIds.length && sourceRows[0].source.publicationDate
              ? new Date(`${sourceRows[0].source.publicationDate}T00:00:00.000Z`) : null,
            evidenceLocator: claim.evidenceLocation,
            isFixture: false,
          },
        });
        if (existing) {
          reused += 1;
          sourceReused += 1;
          claimResults.push({ institutionSlug: claim.institutionSlug, field, evidenceId: evidence.id, sourceId, sourceUrl: sourceRows[0].source.url, status: 'REUSED' });
          continue;
        }
        await tx.auditLog.create({
          data: {
            action: 'official.fact.stage', targetType: 'FieldEvidence', targetId: evidence.id,
            metadata: {
              importRunId: run.id,
              reviewState: 'UNREVIEWED',
              publicationStatus: claim.field === 'structured' && claim.sourceReportedRef
                ? 'SOURCE_REPORTED_REGISTERED'
                : 'UNREVIEWED_CANDIDATE',
              sourceManifestId,
              sourceReportedRef: claim.field === 'structured' ? claim.sourceReportedRef ?? null : null,
            },
          },
        });
        staged += 1;
        sourceStaged += 1;
        claimResults.push({ institutionSlug: claim.institutionSlug, field, evidenceId: evidence.id, sourceId, sourceUrl: sourceRows[0].source.url, status: 'STAGED' });
      }
      if (!priorRun) {
        const finishedAt = new Date(Math.max(Date.now(), run.startedAt.getTime()));
        await tx.importRun.update({
          where: { id: run.id },
          data: { finishedAt, status: 'STAGED', summary: { candidates: sourceRows.length, staged: sourceStaged, reused: sourceReused, reviewState: 'UNREVIEWED' } },
        });
      } else if (!ownerPlan && (!priorRun.finishedAt || priorRun.finishedAt < priorRun.startedAt)) {
        // Old imported runs can contain clock-skewed inverted timestamps. We do
        // not invent an elapsed duration; clamp the missing/invalid end to start.
        await tx.importRun.update({ where: { id: run.id }, data: { finishedAt: priorRun.startedAt, status: 'STAGED' } });
        repairedRuns += 1;
      }
    }
    return { status: 'STAGED' as const, facts: rows.length, reviewState: 'UNREVIEWED' as const, staged, reused, createdSources, createdRuns, repairedRuns, claimResults, databaseChanged: staged + createdSources + createdRuns + repairedRuns > 0 };
  }, ownerPlan ? { timeout: 150_000 } : undefined);
}

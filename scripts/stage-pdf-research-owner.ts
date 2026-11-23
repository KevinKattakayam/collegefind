import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { validateOfficialFacts, stageOfficialFactRows } from '../src/server/ingest/official-facts';
import { freshOwnerBackup, ownerStagingTarget, planOwnerStage, requireApprovedBatch, verifyStagingIdentity } from './owner-review-stage';
import { assertOwnerReviewTarget } from '../src/server/owner-review-target';
import archive from '../data/pilot/staged-evidence-after-batch-027.json';

const AUTHORIZED_SHA256 = '50100da8b4516130c4d55639dede22ed9fd2ee108b89734d6dfc3de6faf2bc4b';
const EXPECTED_CANDIDATES = 336;
const CHUNK_SIZE = 25;
const PDF_NAMES = [
  'CollegeFind_First_40_College_Data_Verified_2026.pdf',
  'CollegeFind_Colleges_41_to_100_Research_2026.pdf',
  'CollegeFind_Colleges_101_to_150_Research_2026.pdf',
  'CollegeFind_Colleges_151_to_205_Research_2026.pdf',
];

type Candidate = {
  collegeId: string;
  candidate: {
    institutionSlug: string; sourceIds: string[]; reviewState: string; status: string; stageable: boolean;
    [key: string]: unknown;
  };
};
type Batch = {
  schemaVersion: number; batch: number; readPageCount: number; profileIdentityCount: number;
  catalogueIdentityHash: string; catalogueIdentities: Array<{ id: string; slug: string }>;
  inputPdfs: Array<{ name: string; pages: number; sha256: string }>;
  candidates: Candidate[];
  sources: Array<Record<string, unknown> & { id: string; institutionSlug: string; reuseConditions: string; access: string }>;
  dispositions: Array<{ status: string }>;
};

function identityHash(rows: Batch['catalogueIdentities']) {
  return createHash('sha256').update(rows.map(({ id, slug }) => `${id}|${slug}`).join('\n')).digest('hex');
}

async function sha256(path: string) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function main() {
  const { values } = parseArgs({ options: {
    file: { type: 'string', default: 'data/pilot/pdf-research-2026-batch-060.json' },
    apply: { type: 'boolean', default: false },
    'approve-sha256': { type: 'string' },
  } });
  const payload = await readFile(values.file!);
  const batchSha256 = requireApprovedBatch(payload, values.apply === true, values['approve-sha256']);
  if (batchSha256 !== AUTHORIZED_SHA256) throw new Error('Refusing any PDF batch other than the explicitly authorized Batch 060 bytes.');
  const batch = JSON.parse(payload.toString()) as Batch;
  if (batch.batch !== 60 || batch.readPageCount !== 229 || batch.profileIdentityCount !== 205 || batch.candidates.length !== EXPECTED_CANDIDATES ||
      batch.catalogueIdentities.length !== 205 || identityHash(batch.catalogueIdentities) !== batch.catalogueIdentityHash) {
    throw new Error('Batch 060 page, candidate, or catalogue identity verification failed.');
  }
  const canonical = new Map(archive.collegeIdentity.map(({ id, slug }) => [slug, id]));
  for (const row of batch.catalogueIdentities) if (canonical.get(row.slug) !== row.id) throw new Error(`Batch 060 catalogue identity mismatch: ${row.slug}`);
  if (batch.inputPdfs.length !== PDF_NAMES.length || batch.inputPdfs.some((pdf, index) => pdf.name !== PDF_NAMES[index])) {
    throw new Error('Input PDF manifest does not match the four authorized research files.');
  }
  for (const pdf of batch.inputPdfs) {
    const actual = await sha256(pdf.name);
    if (actual !== pdf.sha256) throw new Error(`Input PDF checksum mismatch: ${pdf.name}`);
  }

  const sources = new Map(batch.sources.map((source) => [source.id, source]));
  if (sources.size !== batch.sources.length) throw new Error('Batch 060 has duplicate source IDs.');
  const stagedRows = [];
  const sourcePermissionWarnings = new Set<string>();
  for (let offset = 0; offset < batch.candidates.length; offset += CHUNK_SIZE) {
    const candidates = batch.candidates.slice(offset, offset + CHUNK_SIZE);
    const usedSourceIds = new Set<string>();
    for (const { collegeId, candidate } of candidates) {
      if (canonical.get(candidate.institutionSlug) !== collegeId || candidate.reviewState !== 'UNREVIEWED' ||
          candidate.status !== 'RESEARCHED_READY_FOR_UNREVIEWED_STAGING' || candidate.stageable !== true ||
          candidate.field !== 'structured' || candidate.sourceIds.length !== 1) {
        throw new Error(`Candidate is not eligible for unreviewed staging: ${candidate.institutionSlug}`);
      }
      const source = sources.get(candidate.sourceIds[0]);
      if (!source || source.institutionSlug !== candidate.institutionSlug || !['PUBLIC_HTML_READ', 'PUBLIC_PDF_READ'].includes(source.access) ||
          !source.reuseConditions.includes('No explicit bulk republication licence was established') ||
          !source.reuseConditions.includes('require direct reviewer confirmation') ||
          !String(source.url).startsWith('https://')) {
        throw new Error(`Source identity/access/reuse restriction is incomplete for ${candidate.institutionSlug}`);
      }
      usedSourceIds.add(source.id);
      sourcePermissionWarnings.add(source.id);
    }
    const manifest = {
      scope: 'RESEARCH_NOTES_WITH_IMPORTABLE_CANDIDATES',
      sources: [...usedSourceIds].map((id) => {
        const source = sources.get(id)!;
        const claimLocations = [...new Set(candidates
          .filter(({ candidate }) => candidate.sourceIds.includes(id))
          .map(({ candidate }) => String(candidate.evidenceLocation)))];
        return { ...source, evidenceLocations: claimLocations };
      }),
      candidateClaims: candidates.map(({ candidate }) => candidate),
    };
    stagedRows.push(...validateOfficialFacts(manifest));
  }
  if (stagedRows.length !== EXPECTED_CANDIDATES) throw new Error('Validated owner staging count differs from the authorized batch count.');
  const heldDispositionCount = batch.dispositions.filter(({ status }) => status === 'HELD').length;
  const archiveHoldCount = batch.dispositions.filter(({ status }) => status === 'PRESERVED_ARCHIVE_HOLD').length;
  const target = ownerStagingTarget(process.env, false);
  if (target.hostname !== '127.0.0.1' || target.port !== '35441' || target.username !== 'cf_owner_review' || target.pathname !== '/collegefind_owner_review_main') {
    throw new Error('Refusing owner target outside the exact authorized local destination.');
  }
  // Keep a second explicit assertion next to the operation; this prevents a future target-gate regression.
  assertOwnerReviewTarget(process.env, 'persistent');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: target.toString(), connectionTimeoutMillis: 5000 }) });
  try {
    const identity = await verifyStagingIdentity(db, target);
    const databaseCounts = async () => {
      const [colleges, sourcesCount, claims, runs, audits, users, decisions, decisionGroups] = await Promise.all([
        db.college.count(), db.source.count(), db.fieldEvidence.count(), db.importRun.count(), db.auditLog.count(),
        db.user.count(), db.evidenceDecision.count(), db.evidenceDecision.groupBy({ by: ['status'], _count: { _all: true } }),
      ]);
      return { colleges, sources: sourcesCount, claims, importRuns: runs, auditRows: audits, users, decisions,
        decisionStatuses: Object.fromEntries(decisionGroups.map(({ status, _count }) => [status, _count._all])) };
    };
    const before = await databaseCounts();
    if (before.colleges !== 205) throw new Error('Owner database no longer contains the expected 205 catalogue identities.');
    const presentColumns = new Set((await db.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'FieldEvidence'
    `).map(({ column_name }) => column_name));
    const requiredColumns = ['campusScope', 'applicablePeriod', 'publisherPeriod', 'historical', 'sourceReportedRef'];
    const missingSchemaColumns = requiredColumns.filter((column) => !presentColumns.has(column));
    const plan = await planOwnerStage(db, stagedRows);
    const planCounts = Object.fromEntries(['ADD_UNREVIEWED', 'REUSE', 'DUPLICATE_IN_BATCH'].map((action) =>
      [action, plan.changes.filter((change) => change.action === action).length]));
    const reusedIds = [...new Set(plan.changes.filter((change) => change.action === 'REUSE').map((change) => change.evidenceId).filter((id): id is string => Boolean(id)))];
    const reusedWithDecisions = reusedIds.length ? await db.evidenceDecision.count({ where: { evidenceId: { in: reusedIds } } }) : 0;
    const sourceUse = {
      candidates: stagedRows.length,
      distinctSources: sourcePermissionWarnings.size,
      explicitBulkReuseClearance: 0,
      allSourceRecordsCarryReviewerConfirmationWarning: true,
      publishableByThisOperation: 0,
    };
    if (!values.apply) {
      process.stdout.write(`${JSON.stringify({ mode: 'PREVIEW_ONLY', batchSha256, destination: 'collegefind_owner_review_main@127.0.0.1:35441', identity,
        before, candidatesValidated: stagedRows.length, candidateColleges: new Set(batch.candidates.map(({ candidate }) => candidate.institutionSlug)).size,
        schemaReady: missingSchemaColumns.length === 0, missingSchemaColumns,
        plan: planCounts, reusedClaimsWithExistingDecisions: reusedWithDecisions, heldCandidatesExcluded: heldDispositionCount,
        preservedArchiveHoldsUntouched: archiveHoldCount, sourceUse, freshBackupCreated: false, persistentWrites: 0 }, null, 2)}\n`);
      return;
    }
    if (missingSchemaColumns.length) throw new Error(`Owner database migration 20261123120000_source_reported_import_provenance is required; missing columns: ${missingSchemaColumns.join(', ')}. No backup or write attempted by this run.`);
    const backupDirectory = join(homedir(), '.local/share/collegefind-owner-review/backups');
    const passphraseFile = join(homedir(), '.local/share/collegefind-owner-review/secrets/backup-passphrase');
    let backup: Awaited<ReturnType<typeof freshOwnerBackup>> | undefined;
    let appliedChanges = plan.changes;
    const result = await stageOfficialFactRows(db, stagedRows, async (tx, rows) => {
      await verifyStagingIdentity(tx, target);
      const lockedPlan = await planOwnerStage(tx, rows);
      appliedChanges = lockedPlan.changes;
      const lockedCounts = Object.fromEntries(['ADD_UNREVIEWED', 'REUSE', 'DUPLICATE_IN_BATCH'].map((action) =>
        [action, lockedPlan.changes.filter((change) => change.action === action).length]));
      if (JSON.stringify(lockedCounts) !== JSON.stringify(planCounts)) throw new Error('Owner queue changed since exact dry run; no import was applied.');
      if (lockedPlan.created.length) backup = await freshOwnerBackup(target, backupDirectory, passphraseFile);
      return lockedPlan.created;
    });
    const after = await databaseCounts();
    if (after.colleges !== before.colleges || after.users !== before.users || after.decisions !== before.decisions ||
        JSON.stringify(after.decisionStatuses) !== JSON.stringify(before.decisionStatuses) ||
        after.claims - before.claims !== result.staged ||
        after.auditRows - before.auditRows !== result.staged) {
      throw new Error('Post-stage integrity counts do not match an additive unreviewed-only import; preserve the fresh backup for investigation.');
    }
    const insertedEvidenceIds = result.claimResults.filter(({ status }) => status === 'STAGED').map(({ evidenceId }) => evidenceId);
    const insertedDecisionCount = insertedEvidenceIds.length ? await db.evidenceDecision.count({ where: { evidenceId: { in: insertedEvidenceIds } } }) : 0;
    if (insertedDecisionCount !== 0) throw new Error('Newly staged claims unexpectedly have decisions.');
    process.stdout.write(`${JSON.stringify({ mode: 'APPLIED_UNREVIEWED_ONLY', batchSha256, destination: 'collegefind_owner_review_main@127.0.0.1:35441', identity,
      before, after, candidatesValidated: stagedRows.length, candidateColleges: new Set(batch.candidates.map(({ candidate }) => candidate.institutionSlug)).size,
      planned: Object.fromEntries(['ADD_UNREVIEWED', 'REUSE', 'DUPLICATE_IN_BATCH'].map((action) =>
        [action, appliedChanges.filter((change) => change.action === action).length])),
      inserted: result.staged, reused: stagedRows.length - result.staged, createdSources: result.createdSources, createdRuns: result.createdRuns,
      insertedEvidenceWithoutDecision: insertedDecisionCount, heldCandidatesExcluded: heldDispositionCount, preservedArchiveHoldsUntouched: archiveHoldCount,
      sourceUse, backup: backup ? { created: true, sha256: backup.sha256, archiveReadabilityVerified: true } : { created: false, reason: 'No additions were required; database was a no-op.' },
      decisionsAndUsersChanged: false, publicPublication: 0 }, null, 2)}\n`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error && !/postgres|password|connection string/i.test(error.message)
    ? error.message : 'Batch 060 owner staging failed validation or a safety check; inspect the target and backup without retrying writes.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});

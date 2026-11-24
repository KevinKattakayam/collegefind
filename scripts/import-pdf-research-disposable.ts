import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { importOfficialFacts } from '../src/server/ingest/official-facts';
import { assertDisposableTestTarget } from '../tests/integration/target';

type CandidateRow = { collegeId: string; candidate: { institutionSlug: string; sourceIds: string[]; reviewState: string; status: string; stageable: boolean } };
type Batch = {
  catalogueIdentityHash: string;
  catalogueIdentities: Array<{ id: string; slug: string; name?: string }>;
  candidates: CandidateRow[];
  sources: Array<{ id: string; institutionSlug: string }>;
};

const EXPECTED_DATABASE = 'collegefind_pdf_research_test';
const EXPECTED_PORT = '35444';
const CHUNK_SIZE = 25;

function identityHash(rows: Batch['catalogueIdentities']) {
  return createHash('sha256').update(rows.map((row) => `${row.id}|${row.slug}`).join('\n')).digest('hex');
}

function assertBatch(batch: Batch) {
  if (!Array.isArray(batch.catalogueIdentities) || batch.catalogueIdentities.length !== 205 || identityHash(batch.catalogueIdentities) !== batch.catalogueIdentityHash) {
    throw new Error('PDF batch catalogue identity mapping is missing or has changed');
  }
  const identities = new Map(batch.catalogueIdentities.map((row) => [row.slug, row.id]));
  const sources = new Map(batch.sources.map((source) => [source.id, source.institutionSlug]));
  if (batch.candidates.length !== 336) throw new Error('Unexpected candidate count; review the extracted batch before import');
  for (const row of batch.candidates) {
    const claim = row.candidate;
    if (identities.get(claim.institutionSlug) !== row.collegeId) throw new Error(`Canonical ID/slug mismatch for ${claim.institutionSlug}`);
    if (claim.reviewState !== 'UNREVIEWED' || claim.status !== 'RESEARCHED_READY_FOR_UNREVIEWED_STAGING' || claim.stageable !== true) {
      throw new Error('The PDF importer accepts only unreviewed, explicitly stageable candidates');
    }
    if (claim.sourceIds.length !== 1 || sources.get(claim.sourceIds[0]) !== claim.institutionSlug) {
      throw new Error(`Source/candidate institution mismatch for ${claim.institutionSlug}`);
    }
  }
}

async function main() {
  const { values } = parseArgs({ options: {
    file: { type: 'string', default: 'data/pilot/pdf-research-2026-batch-060.json' },
    apply: { type: 'boolean', default: false },
  } });
  const batch = JSON.parse(readFileSync(values.file!, 'utf8')) as Batch;
  assertBatch(batch);
  const sourceMap = new Map(batch.sources.map((source) => [source.id, source]));
  const manifests = [] as Array<{ scope: 'RESEARCH_NOTES_WITH_IMPORTABLE_CANDIDATES'; sources: unknown[]; candidateClaims: unknown[] }>;
  for (let offset = 0; offset < batch.candidates.length; offset += CHUNK_SIZE) {
    const candidateClaims = batch.candidates.slice(offset, offset + CHUNK_SIZE).map(({ candidate }) => candidate);
    const used = new Set(candidateClaims.flatMap((claim) => claim.sourceIds));
    manifests.push({
      scope: 'RESEARCH_NOTES_WITH_IMPORTABLE_CANDIDATES',
      sources: [...used].map((id) => sourceMap.get(id)!).filter(Boolean),
      candidateClaims,
    });
  }
  if (!values.apply) {
    let facts = 0;
    for (const manifest of manifests) {
      const dryRun = await importOfficialFacts(null, manifest, true, new Date('2026-11-23T00:00:00.000Z'));
      facts += dryRun.facts;
    }
    process.stdout.write(`${JSON.stringify({ status: 'DRY_RUN', batch: 60, pdfPages: 229, catalogueIdentities: 205, candidates: facts, chunks: manifests.length, reviewState: 'UNREVIEWED', persistentOwnerDatabase: 'NOT CONNECTED' }, null, 2)}\n`);
    return;
  }

  // Narrower than the general disposable guard: this operation accepts only the
  // fresh, loopback-only PostgreSQL container allocated for this PDF rehearsal.
  const connectionString = assertDisposableTestTarget();
  const target = new URL(connectionString);
  if (target.hostname !== '127.0.0.1' || target.port !== EXPECTED_PORT || decodeURIComponent(target.pathname.slice(1)) !== EXPECTED_DATABASE || target.username !== 'postgres') {
    throw new Error(`Refusing target; PDF rehearsal requires postgres@127.0.0.1:${EXPECTED_PORT}/${EXPECTED_DATABASE}`);
  }
  const pool = new pg.Pool({ connectionString, max: 4 });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const sqlIdentity = await pool.query<{ database: string; role: string }>('SELECT current_database() AS database, current_user AS role');
    if (sqlIdentity.rows[0]?.database !== EXPECTED_DATABASE || sqlIdentity.rows[0]?.role !== 'postgres') throw new Error('PostgreSQL identity check failed');
    const catalogue = await db.college.findMany({ select: { slug: true, name: true } });
    const seed = JSON.parse(readFileSync('src/server/seed/demo-colleges.json', 'utf8')) as Array<{ slug: string; name: string }>;
    if (catalogue.length !== 205 || seed.length !== 205) throw new Error(`Expected 205 seeded catalogue rows; found database=${catalogue.length}, seed=${seed.length}`);
    const dbBySlug = new Map(catalogue.map((row) => [row.slug, row.name]));
    for (const sourceIdentity of batch.catalogueIdentities) {
      const seeded = seed.find((row) => row.slug === sourceIdentity.slug);
      if (!seeded || dbBySlug.get(sourceIdentity.slug) !== seeded.name || (sourceIdentity.name && sourceIdentity.name !== seeded.name)) {
        throw new Error(`Seeded database identity mismatch for ${sourceIdentity.slug}`);
      }
    }
    const [priorFacts, priorSources, priorRuns, priorDecisions, priorAudit] = await Promise.all([
      db.fieldEvidence.count(), db.source.count(), db.importRun.count(), db.evidenceDecision.count(), db.auditLog.count(),
    ]);
    if (priorFacts || priorSources || priorRuns || priorDecisions || priorAudit) throw new Error('Disposable import target is not fresh; no rows were written');

    const first: Array<{ facts: number; staged: number; reused: number }> = [];
    for (const manifest of manifests) {
      const result = await importOfficialFacts(db, manifest, false, new Date('2026-11-23T00:00:00.000Z'));
      if (result.status !== 'STAGED' || result.reviewState !== 'UNREVIEWED') throw new Error('Importer returned an unexpected publication state');
      first.push({ facts: result.facts, staged: result.staged, reused: result.reused });
    }
    const afterFirst = await Promise.all([db.fieldEvidence.count(), db.auditLog.count({ where: { action: 'official.fact.stage' } }), db.evidenceDecision.count()]);
    if (afterFirst[0] !== 336 || afterFirst[1] !== 336 || afterFirst[2] !== 0) throw new Error(`Unexpected first import state: ${afterFirst.join('/')}`);

    const second: Array<{ facts: number; staged: number; reused: number }> = [];
    for (const manifest of manifests) {
      const result = await importOfficialFacts(db, manifest, false, new Date('2026-11-23T00:00:00.000Z'));
      if (result.status !== 'STAGED' || result.reviewState !== 'UNREVIEWED') throw new Error('Idempotent retry changed publication state');
      second.push({ facts: result.facts, staged: result.staged, reused: result.reused });
    }
    const afterSecond = await Promise.all([db.fieldEvidence.count(), db.auditLog.count({ where: { action: 'official.fact.stage' } }), db.evidenceDecision.count()]);
    if (afterSecond[0] !== 336 || afterSecond[1] !== 336 || afterSecond[2] !== 0 || second.some((run) => run.staged !== 0 || run.reused !== run.facts)) {
      throw new Error(`Idempotency verification failed: ${afterSecond.join('/')}`);
    }
    const byField = await db.fieldEvidence.groupBy({ by: ['field'], _count: { _all: true } });
    const populated = await db.fieldEvidence.findMany({ select: { collegeId: true, college: { select: { slug: true } }, source: { select: { publisher: true, url: true, retrievedAt: true } }, field: true, value: true, academicYear: true, programScope: true, evidenceLocator: true, decisions: { select: { id: true } }, sourceReportedRef: true } });
    if (populated.some((row) => row.decisions.length || row.sourceReportedRef || !row.evidenceLocator || !row.source.url.startsWith('https://'))) throw new Error('Unreviewed provenance/status invariant failed');
    const importedSlugs = new Set(populated.map((row) => row.college.slug));
    const stagedByField = Object.fromEntries(byField.map((row) => [row.field, row._count._all]));
    process.stdout.write(`${JSON.stringify({
      status: 'DISPOSABLE_IMPORT_VERIFIED', batch: 60, destination: `${EXPECTED_DATABASE}@127.0.0.1:${EXPECTED_PORT}`,
      pdfPages: 229, catalogueIdentities: catalogue.length, candidates: 336, uniqueCollegesPopulated: importedSlugs.size,
      firstImport: { staged: first.reduce((sum, row) => sum + row.staged, 0), reused: first.reduce((sum, row) => sum + row.reused, 0), evidenceRows: afterFirst[0], stageAuditRows: afterFirst[1], genuineApprovals: 0, byField: stagedByField },
      repeatedImport: { staged: second.reduce((sum, row) => sum + row.staged, 0), reused: second.reduce((sum, row) => sum + row.reused, 0), evidenceRows: afterSecond[0], stageAuditRows: afterSecond[1], decisions: afterSecond[2] },
      allRowsHaveHttpsSourceAndEvidenceLocator: true,
      persistentOwnerDatabase: 'NOT CONNECTED',
    }, null, 2)}\n`);
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Disposable PDF import failed; no secrets logged'}\n`);
  process.exitCode = 1;
});

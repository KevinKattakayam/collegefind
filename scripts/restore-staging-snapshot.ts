import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { relative, resolve, isAbsolute } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { assertDisposableTestTarget } from '../tests/integration/target';
import { importOfficialReference } from '../src/server/ingest/official-reference';

type Snapshot = {
  scope: string;
  sources: Record<string, unknown>[];
  claims: Record<string, unknown>[];
  runs: Record<string, unknown>[];
  audits: Record<string, unknown>[];
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function uniqueIds(rows: Record<string, unknown>[], label: string): Set<string> {
  const ids = rows.map((row) => row.id);
  if (ids.some((id) => typeof id !== 'string') || new Set(ids).size !== ids.length) {
    throw new Error(`${label} contains missing or duplicate IDs`);
  }
  return new Set(ids as string[]);
}

function dateFields<T extends Record<string, unknown>>(row: T, fields: string[]): T {
  const result: Record<string, unknown> = { ...row };
  for (const field of fields) {
    const value = result[field];
    if (typeof value === 'string') result[field] = new Date(value);
  }
  return result as T;
}

async function main() {
  const { values } = parseArgs({ options: { report: { type: 'string' } } });
  const reportPath = resolve(values.report ?? 'data/pilot/restore-report.json');
  const reportRelativePath = relative(resolve('data/pilot'), reportPath);
  if (!reportRelativePath || reportRelativePath.startsWith('..') || isAbsolute(reportRelativePath) || !reportPath.endsWith('.json')) {
    throw new Error('--report must be a .json file inside data/pilot');
  }
  // Validate artifacts before constructing any database client.
  const snapshot = readJson<Snapshot>('data/pilot/local-stage-snapshot.json');
  const demo = readJson<Record<string, unknown>[]>('src/server/seed/demo-colleges.json');
  const seedChecksum = createHash('sha256').update(readFileSync('src/server/seed/demo-colleges.json')).digest('hex');
  if (seedChecksum !== 'a9321b82b6f390790e09a647dfaf589b90c5736819aed6b9a5908922bfcc1637') {
    throw new Error('The original demo catalogue seed checksum changed; refusing to restore against a different catalogue');
  }
  const referenceRows = readJson<Record<string, unknown>[]>('data/pilot/official-references.json');
  const allResultFiles = [
    'staging-results.json',
    'batch-002-staging-results.json',
    'batch-003-staging-results.json',
    'batch-004-staging-results.json',
    'batch-005-006-staging-results.json',
    'batch-007-009-staging-results.json',
    'admissions-staging-results.json',
    'admissions-batch-005-009-results.json',
  ];
  const results = allResultFiles.flatMap((file) => readJson<Record<string, unknown>[]>(`data/pilot/${file}`));
  const sourceIds = uniqueIds(snapshot.sources, 'snapshot sources');
  const claimIds = uniqueIds(snapshot.claims, 'snapshot claims');
  uniqueIds(snapshot.runs, 'snapshot import runs');
  uniqueIds(snapshot.audits, 'snapshot audits');
  const resultClaimIds = results.map((row) => row.claimId);
  if (resultClaimIds.some((id) => typeof id !== 'string') || new Set(resultClaimIds).size !== resultClaimIds.length) {
    throw new Error('Replay manifests contain missing or duplicate claim IDs');
  }
  const resultSet = new Set(resultClaimIds as string[]);
  const missingClaimIds = [...resultSet].filter((id) => !claimIds.has(id));
  if (snapshot.claims.length !== 139 || results.length !== 147 || missingClaimIds.length !== 8 || snapshot.audits.length !== snapshot.claims.length) {
    throw new Error('Archived claim counts differ from the audited 139/147/8 reconciliation');
  }
  for (const claim of snapshot.claims) {
    if (!sourceIds.has(String(claim.sourceId))) throw new Error(`Claim ${claim.id} has an orphaned source`);
  }
  for (const run of snapshot.runs) {
    if (!sourceIds.has(String(run.sourceId))) throw new Error(`Import run ${run.id} has an orphaned source`);
  }
  const claimSourceIds = new Set(snapshot.claims.map((claim) => claim.sourceId));
  const runSourceIds = new Set(snapshot.runs.map((run) => run.sourceId));
  for (const sourceId of sourceIds) {
    if (!claimSourceIds.has(sourceId) && !runSourceIds.has(sourceId)) throw new Error(`Source ${sourceId} is orphaned`);
  }
  const auditCounts = new Map<string, number>();
  for (const audit of snapshot.audits) auditCounts.set(String(audit.targetId), (auditCounts.get(String(audit.targetId)) ?? 0) + 1);
  for (const claim of snapshot.claims) {
    if (auditCounts.get(String(claim.id)) !== 1) throw new Error(`Claim ${claim.id} does not have exactly one archived audit event`);
  }
  if (snapshot.audits.some((row) => !claimIds.has(String(row.targetId)))) {
    throw new Error('Snapshot has an audit event for a claim missing from the snapshot');
  }
  if (snapshot.claims.some((claim) => claim.isFixture !== false) || 'decisions' in snapshot) {
    throw new Error('Snapshot includes fixtures or decision history; refusing unsafe replay');
  }
  const slugForClaim = new Map(results.map((row) => [String(row.claimId), String(row.slug)]));
  const originalIdBySlug = new Map<string, string>();
  for (const claim of snapshot.claims) {
    const slug = slugForClaim.get(String(claim.id));
    if (!slug) throw new Error(`Snapshot claim ${claim.id} has no matching result manifest row`);
    const previous = originalIdBySlug.get(slug);
    if (previous && previous !== claim.collegeId) throw new Error(`College ID mismatch for ${slug}`);
    originalIdBySlug.set(slug, String(claim.collegeId));
  }
  const demoBySlug = new Map(demo.map((row) => [String(row.slug), row]));
  if (demo.length !== 205 || demoBySlug.size !== 205 || [...originalIdBySlug.keys()].some((slug) => !demoBySlug.has(slug))) {
    throw new Error('Catalogue seed is not the expected unique 205-record catalogue');
  }
  const missingOriginal = new Set(readJson<Record<string, unknown>[]>('data/pilot/staging-results.json').map((row) => String(row.claimId)));
  if (missingOriginal.size !== 8 || missingClaimIds.some((id) => !missingOriginal.has(id)) || [...missingOriginal].some((id) => !missingClaimIds.includes(id))) {
    throw new Error('Missing archived IDs differ from the exact original eight claim IDs');
  }
  if (missingClaimIds.some((id) => !missingOriginal.has(id)) || referenceRows.length !== 8) {
    throw new Error('Missing archived records are not exactly the original eight pilot references');
  }
  const replayRefs = referenceRows;
  if (replayRefs.some((row) => !missingOriginal.has(String(results.find((result) => result.slug === row.slug)?.claimId)))) {
    throw new Error('Original reference replay manifest does not match the unrecoverable eight claims');
  }
  const connectionString = assertDisposableTestTarget();
  const pool = new pg.Pool({ connectionString });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    await db.$transaction(async (tx) => {
      const collegeIds = new Map<string, string>();
      for (const [slug, row] of demoBySlug) {
        const archivedId = originalIdBySlug.get(slug);
        const college = await tx.college.upsert({
          where: { slug },
          update: {},
          create: { ...row, ...(archivedId ? { id: archivedId } : {}) } as never,
          select: { id: true },
        });
        if (archivedId && college.id !== archivedId) throw new Error(`Existing College ID differs from archived ID for ${slug}`);
        collegeIds.set(slug, college.id);
      }
      const actualIdByOriginal = new Map<string, string>();
      for (const [slug, id] of originalIdBySlug) actualIdByOriginal.set(id, collegeIds.get(slug)!);
      for (const raw of snapshot.sources) {
        const row = dateFields(raw, ['publishedAt', 'retrievedAt', 'createdAt']);
        await tx.source.upsert({ where: { id: String(row.id) }, update: {}, create: row as never });
      }
      for (const raw of snapshot.claims) {
        const row = dateFields(raw, ['publishedAt', 'validFrom', 'validUntil', 'createdAt']);
        row.collegeId = actualIdByOriginal.get(String(row.collegeId)) ?? String(row.collegeId);
        await tx.fieldEvidence.upsert({ where: { id: String(row.id) }, update: {}, create: row as never });
      }
      for (const raw of snapshot.runs) {
        const row = dateFields(raw, ['startedAt', 'finishedAt']);
        await tx.importRun.upsert({ where: { id: String(row.id) }, update: {}, create: row as never });
      }
      for (const raw of snapshot.audits) {
        const row = dateFields(raw, ['createdAt']);
        await tx.auditLog.upsert({ where: { id: String(row.id) }, update: {}, create: row as never });
      }
      return collegeIds;
    });

    const replayMap: Array<{ oldClaimId: string; newClaimId: string; slug: string }> = [];
    for (const input of replayRefs) {
      const old = results.find((row) => row.slug === input.slug && row.field === (input.field ?? 'website'));
      if (!old || !missingClaimIds.includes(String(old.claimId))) throw new Error(`Unexpected replay row ${input.slug}`);
      const row = { ...input, reviewState: 'UNREVIEWED' };
      const result = await importOfficialReference(db, row, false);
      if (result.status !== 'STAGED' || !('claimId' in result)) throw new Error(`Could not replay missing claim for ${input.slug}`);
      replayMap.push({ oldClaimId: String(old.claimId), newClaimId: result.claimId, slug: input.slug as string });
    }
    const counts = {
      catalogue: await db.college.count(),
      sources: await db.source.count(),
      claims: await db.fieldEvidence.count(),
      runs: await db.importRun.count(),
      audits: await db.auditLog.count(),
      decisions: await db.evidenceDecision.count(),
      fixtureClaims: await db.fieldEvidence.count({ where: { isFixture: true } }),
    };
    const report = {
      scope: 'DISPOSABLE_DB_RESTORE_ONLY',
      restoredAt: new Date().toISOString(),
      originalSnapshot: { sources: snapshot.sources.length, claims: snapshot.claims.length, runs: snapshot.runs.length, audits: snapshot.audits.length },
      missingHistoricalPayloads: missingClaimIds.length,
      replayedOriginalEightAsNewAuditedClaims: replayMap,
      preservedCollegeIdsForClaimBearingInstitutions: originalIdBySlug.size,
      testCloneCollegeIdsGeneratedForOtherCatalogueRows: 205 - originalIdBySlug.size,
      counts,
    };
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Snapshot restore failed; no credentials logged');
  process.exitCode = 1;
});

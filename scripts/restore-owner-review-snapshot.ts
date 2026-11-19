import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { assertOwnerReviewTarget } from '../src/server/owner-review-target';
import { exactJsonEqual, validateOwnerReviewArchive, type OwnerReviewManifest, type OwnerReviewRow as Row, type OwnerReviewSnapshot as Snapshot } from './owner-review-archive';

const snapshotFile = 'data/pilot/staged-evidence-after-batch-027.json';
const manifestFile = 'data/pilot/staged-evidence-after-batch-027-manifest.json';
const seedFile = 'src/server/seed/demo-colleges.json';

function dated(row: Row, fields: string[]): Row {
  const output = { ...row };
  for (const field of fields) if (typeof output[field] === 'string') output[field] = new Date(output[field] as string);
  return output;
}

async function assertRestoredRows(db: PrismaClient | Prisma.TransactionClient, snapshot: Snapshot) {
  const counts = {
    colleges: await db.college.count(), sources: await db.source.count(), claims: await db.fieldEvidence.count(),
    runs: await db.importRun.count(), audits: await db.auditLog.count(), decisions: await db.evidenceDecision.count(), users: await db.user.count(),
  };
  if (counts.colleges !== 205 || counts.sources !== snapshot.sources.length || counts.claims !== snapshot.claims.length ||
      counts.runs !== snapshot.runs.length || counts.audits !== snapshot.audits.length || counts.decisions !== 0 || counts.users !== 0) {
    throw new Error('Post-restore row counts differ from the source manifest; inspect the owner target before proceeding.');
  }
  const exactRows = [
    [snapshot.sources, await db.source.findMany({ orderBy: { id: 'asc' } }), ['publishedAt', 'retrievedAt', 'createdAt']],
    [snapshot.claims, await db.fieldEvidence.findMany({ orderBy: { id: 'asc' } }), ['publishedAt', 'validFrom', 'validUntil', 'createdAt']],
    [snapshot.runs, await db.importRun.findMany({ orderBy: { id: 'asc' } }), ['startedAt', 'finishedAt']],
    [snapshot.audits, await db.auditLog.findMany({ orderBy: { id: 'asc' } }), ['createdAt']],
  ] as const;
  for (const [archived, actualRows, dateFields] of exactRows) {
    const normalizedArchive = archived.map((row) => dated(row, [...dateFields]));
    if (!exactJsonEqual(actualRows, normalizedArchive)) throw new Error('Post-restore provenance or audit read-back differs from the checksummed snapshot.');
  }
  const actualIdentities = await db.college.findMany({ select: { id: true, slug: true }, orderBy: { slug: 'asc' } });
  if (await db.college.count() !== 205 || !exactJsonEqual(actualIdentities, [...snapshot.collegeIdentity].sort((a,b) => a.slug.localeCompare(b.slug)))) {
    throw new Error('Post-restore college ID/slug map differs from the checksummed snapshot.');
  }
  return counts;
}

async function main() {
  const { values } = parseArgs({ options: { apply: { type: 'boolean', default: false } } });
  // All file/target guards run before creating a pool or Prisma client.
  const targetUrl = assertOwnerReviewTarget();
  const payload = readFileSync(snapshotFile);
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as OwnerReviewManifest;
  const snapshot = JSON.parse(payload.toString('utf8')) as Snapshot;
  const seedPayload = readFileSync(seedFile);
  const seed = validateOwnerReviewArchive(payload, manifest, snapshot, seedPayload);
  const pool = new pg.Pool({ connectionString: targetUrl.toString(), max: 2 });
  let db: PrismaClient | undefined;
  try {
    const identity = await pool.query<{ database: string; role: string; port: number; migrations: bigint | string }>(`
      SELECT current_database() AS database, current_user AS role, inet_server_port() AS port,
        (SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS migrations`);
    const actual = identity.rows[0];
    const migrationDirectories = readdirSync(resolve('prisma/migrations'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;
    if (!actual || actual.database !== targetUrl.pathname.slice(1) || actual.role !== 'cf_owner_review' || actual.port !== 5432 || Number(actual.migrations) !== migrationDirectories) {
      throw new Error('Connected database identity or migration history does not match the explicitly confirmed owner-review target.');
    }
    const names = ['College', 'Source', 'FieldEvidence', 'ImportRun', 'AuditLog', 'EvidenceDecision', 'User'];
    const before: Record<string, number> = {};
    for (const table of names) {
      const result = await pool.query<{ count: string }>(`SELECT count(*)::text AS count FROM "${table}"`);
      before[table] = Number(result.rows[0]?.count);
    }
    if (Object.keys(before).length !== names.length) throw new Error('Expected application schema tables are unavailable; run reviewed migrations first.');
    db = new PrismaClient({ adapter: new PrismaPg(pool) });
    const expectedRows = [
      ['Source', snapshot.sources], ['FieldEvidence', snapshot.claims], ['ImportRun', snapshot.runs], ['AuditLog', snapshot.audits],
    ] as const;
    const empty = Object.values(before).every((count) => count === 0);
    if (empty) {
      if (!values.apply) {
        console.log(JSON.stringify({ mode: 'DRY_RUN', database: actual.database, role: actual.role, snapshotSha256: manifest.sha256, counts: { colleges: 205, sources: snapshot.sources.length, claims: snapshot.claims.length, runs: snapshot.runs.length, audits: snapshot.audits.length }, writes: 'none; rerun with --apply after owner confirmation' }));
        return;
      }
      const verifiedCounts = await db.$transaction(async (tx) => {
        const identity = snapshot.collegeIdentity;
        const seedBySlug = new Map(seed.map((row) => [row.slug, row]));
        await tx.college.createMany({ data: identity.map(({ id, slug }) => ({ ...seedBySlug.get(slug), id }) as never) });
        await tx.source.createMany({ data: snapshot.sources.map((row) => dated(row, ['publishedAt', 'retrievedAt', 'createdAt'])) as never });
        await tx.fieldEvidence.createMany({ data: snapshot.claims.map((row) => dated(row, ['publishedAt', 'validFrom', 'validUntil', 'createdAt'])) as never });
        await tx.importRun.createMany({ data: snapshot.runs.map((row) => dated(row, ['startedAt', 'finishedAt'])) as never });
        await tx.auditLog.createMany({ data: snapshot.audits.map((row) => dated(row, ['createdAt'])) as never });
        // Verify counts and exact provenance/audit rows before commit so any mismatch rolls back all inserts.
        return assertRestoredRows(tx, snapshot);
      }, { timeout: 60_000 });
      console.log(JSON.stringify({ mode: 'RESTORED', database: actual.database, role: actual.role, snapshotSha256: manifest.sha256, counts: verifiedCounts, humanDecisions: 0 }));
      return;
    } else {
      // Existing owner progress is never overwritten. Allow an idempotent retry only
      // when every archived row is still byte-for-byte represented in its table.
      const existingCollege = await db.college.findMany({ where: { id: { in: snapshot.collegeIdentity.map((x) => x.id) } }, select: { id: true, slug: true } });
      if (await db.college.count() !== 205 || !exactJsonEqual(existingCollege.sort((a,b) => a.slug.localeCompare(b.slug)), [...snapshot.collegeIdentity].sort((a,b) => a.slug.localeCompare(b.slug)))) {
        throw new Error('Owner-review database is neither empty nor an exact identity-preserving snapshot restore; no rows changed.');
      }
      for (const [table, rows] of expectedRows) {
        const where = { id: { in: rows.map((row) => String(row.id)) } };
        const existing: Row[] = table === 'Source' ? await db.source.findMany({ where }) as unknown as Row[]
          : table === 'FieldEvidence' ? await db.fieldEvidence.findMany({ where }) as unknown as Row[]
          : table === 'ImportRun' ? await db.importRun.findMany({ where }) as unknown as Row[]
          : await db.auditLog.findMany({ where }) as unknown as Row[];
        const normalized = rows.map((row) => table === 'Source' ? dated(row, ['publishedAt','retrievedAt','createdAt']) : table === 'FieldEvidence' ? dated(row, ['publishedAt','validFrom','validUntil','createdAt']) : table === 'ImportRun' ? dated(row, ['startedAt','finishedAt']) : dated(row, ['createdAt']));
        if (existing.length !== rows.length || !exactJsonEqual(existing.sort((a,b) => String(a.id).localeCompare(String(b.id))), normalized.sort((a,b) => String(a.id).localeCompare(String(b.id))))) {
          throw new Error(`Existing ${table} data does not match the archive; no rows changed.`);
        }
      }
      console.log(JSON.stringify({ mode: 'IDEMPOTENT_VERIFIED', database: actual.database, role: actual.role, snapshotSha256: manifest.sha256, userAndDecisionCountsPreserved: true, writes: 'none' }));
      return;
    }
  } finally {
    await db?.$disconnect();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write((error instanceof Error ? error.message : 'Owner-review snapshot operation failed') + '\n');
  process.exitCode = 1;
});

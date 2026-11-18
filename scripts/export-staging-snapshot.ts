import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { assertDisposableTestTarget } from '../tests/integration/target';

async function main() {
  const { values } = parseArgs({ options: { name: { type: 'string' } } });
  const name = values.name ?? 'current-staged-evidence-snapshot';
  if (!/^[a-z][a-z0-9-]{0,70}$/.test(name)) throw new Error('Invalid snapshot file name');
  const connectionString = assertDisposableTestTarget();
  const url = new URL(connectionString);
  if (url.hostname !== '127.0.0.1' || url.port !== '35439' || url.pathname !== '/collegefind_phase3_restore' ||
      url.username !== 'cf_phase3_test' || process.env.COLLEGEFIND_TEST_DATABASE_CONFIRMED !== 'true') {
    throw new Error('Snapshot export requires the verified CollegeFind disposable restore database');
  }
  const pool = new pg.Pool({ connectionString, max: 2 });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const [sources, claims, runs, audits, decisions, users, colleges] = await Promise.all([
      db.source.findMany({ orderBy: { id: 'asc' } }),
      db.fieldEvidence.findMany({ orderBy: { id: 'asc' } }),
      db.importRun.findMany({ orderBy: { id: 'asc' } }),
      db.auditLog.findMany({ where: { targetType: 'FieldEvidence' }, orderBy: { id: 'asc' } }),
      db.evidenceDecision.count(),
      db.user.count(),
      db.college.findMany({ select: { id: true, slug: true }, orderBy: { slug: 'asc' } }),
    ]);
    if (decisions !== 0 || users !== 0 || colleges.length !== 205 || claims.some((c) => c.isFixture)) {
      throw new Error('Refusing snapshot with reviewer decisions, users, fixtures, or unexpected catalogue');
    }
    const sourceIds = new Set(sources.map((x) => x.id));
    const claimIds = new Set(claims.map((x) => x.id));
    if (claims.some((x) => !sourceIds.has(x.sourceId)) || runs.some((x) => !sourceIds.has(x.sourceId)) ||
        audits.length !== claims.length || audits.some((x) => !claimIds.has(x.targetId))) throw new Error('Snapshot referential integrity failed');
    // Include stable catalogue IDs with slugs so new archives can restore without
    // querying the original database clone. Older V1 payloads remain readable.
    const collegeIdentity = colleges.map(({ id, slug }) => ({ id, slug }));
    const snapshot = { scope: 'COLLEGEFIND_DISPOSABLE_STAGED_EVIDENCE_V1', collegeIdentity, sources, claims, runs, audits };
    const payload = JSON.stringify(snapshot, null, 2) + '\n';
    const sha256 = createHash('sha256').update(payload).digest('hex');
    const dir = resolve('data/pilot');
    mkdirSync(dir, { recursive: true });
    const path = join(dir, name + '.json');
    writeFileSync(path, payload, { mode: 0o600, flag: 'wx' });
    writeFileSync(join(dir, name + '-manifest.json'), JSON.stringify({
      file: name + '.json', sha256, counts: {
        colleges: colleges.length, sources: sources.length, claims: claims.length, runs: runs.length, audits: audits.length,
        decisions, users, fixtures: claims.filter((x) => x.isFixture).length,
      },
      collegeSlugsSha256: createHash('sha256').update(colleges.map((x) => x.slug).join('\n')).digest('hex'),
      collegeIdentitySha256: createHash('sha256').update(JSON.stringify(collegeIdentity)).digest('hex'),
    }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    console.log(JSON.stringify({ path, sha256, counts: { colleges: colleges.length, sources: sources.length, claims: claims.length, runs: runs.length, audits: audits.length, decisions, users } }));
  } finally { await db.$disconnect(); await pool.end(); }
}
main().catch((error: unknown) => { process.stderr.write((error instanceof Error ? error.message : 'Snapshot export failed') + '\n'); process.exitCode = 1; });

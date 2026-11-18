import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { isDeepStrictEqual } from 'node:util';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { assertDisposableTestTarget } from '../tests/integration/target';

const directory = 'data/pilot';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const serializable = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

function client(database: string, connectionString: string) {
  const url = new URL(connectionString);
  if (url.hostname !== '127.0.0.1' || url.port !== '35439' ||
      url.username !== 'cf_phase3_test' || url.pathname !== '/' + database || url.search || url.hash) {
    throw new Error('Unexpected disposable snapshot target');
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

async function main() {
  const { values } = parseArgs({ options: {
    snapshot: { type: 'string', default: 'current-staged-evidence-snapshot' },
    'target-db': { type: 'string', default: 'collegefind_phase3_snapshot182_test' },
  } });
  if (!/^[a-z][a-z0-9-]{0,70}$/.test(values.snapshot)) throw new Error('Invalid snapshot name');
  if (!/^collegefind_phase3_snapshot[a-z0-9_]*_test$/.test(values['target-db'])) throw new Error('Invalid disposable snapshot target name');
  const targetUrl = assertDisposableTestTarget({
    ...process.env, TEST_DATABASE_URL: process.env.COLLEGEFIND_SNAPSHOT_TEST_DATABASE_URL,
  });
  const payload = readFileSync(`${directory}/${values.snapshot}.json`, 'utf8');
  const manifest = JSON.parse(readFileSync(`${directory}/${values.snapshot}-manifest.json`, 'utf8'));
  const snapshot = JSON.parse(payload);
  if (sha256(payload) !== manifest.sha256 || snapshot.scope !== 'COLLEGEFIND_DISPOSABLE_STAGED_EVIDENCE_V1') {
    throw new Error('Unexpected snapshot digest or format');
  }
  const archivedIdentity = Array.isArray(snapshot.collegeIdentity)
    ? snapshot.collegeIdentity as Array<{ id: string; slug: string }>
    : null;
  if (archivedIdentity && (
    archivedIdentity.length !== 205 ||
    archivedIdentity.some((row) => typeof row.id !== 'string' || typeof row.slug !== 'string') ||
    new Set(archivedIdentity.map((row) => row.id)).size !== archivedIdentity.length ||
    new Set(archivedIdentity.map((row) => row.slug)).size !== archivedIdentity.length ||
    sha256(JSON.stringify(archivedIdentity)) !== manifest.collegeIdentitySha256
  )) throw new Error('Snapshot catalogue identity mapping is invalid');
  const { sources, claims, runs, audits } = snapshot as Record<string, Record<string, unknown>[]>;
  for (const [key, rows] of Object.entries({ sources, claims, runs, audits })) {
    if (rows.length !== manifest.counts[key] || new Set(rows.map((row) => row.id)).size !== rows.length) {
      throw new Error('Snapshot count or identity mismatch');
    }
  }
  const sourceIds = new Set(sources.map((row) => row.id));
  const claimsById = new Map(claims.map((row) => [row.id, row]));
  const runsById = new Map(runs.map((row) => [row.id, row]));
  for (const audit of audits) {
    const claim = claimsById.get(audit.targetId);
    const metadata = audit.metadata as { importRunId?: string } | null;
    if (!claim || audit.actorId !== null || audit.targetType !== 'FieldEvidence' ||
        (metadata?.importRunId && runsById.get(metadata.importRunId)?.sourceId !== claim.sourceId)) {
      throw new Error('Invalid staging audit reference');
    }
  }
  if (new Set(audits.map((row) => row.targetId)).size !== claims.length ||
      claims.some((row) => row.isFixture !== false || !sourceIds.has(row.sourceId)) ||
      runs.some((row) => !sourceIds.has(row.sourceId))) throw new Error('Invalid snapshot references');

  // Backward compatibility: old V1 archives lack IDs and still use the original
  // disposable source clone to map staged claims to catalogue rows by slug.
  const source = archivedIdentity ? null : client('collegefind_phase3_restore', assertDisposableTestTarget());
  const target = client(values['target-db'], targetUrl);
  try {
    const colleges = archivedIdentity ?? await source!.college.findMany({ select: { id: true, slug: true }, orderBy: { slug: 'asc' } });
    const seed = JSON.parse(readFileSync('src/server/seed/demo-colleges.json', 'utf8')) as { slug: string }[];
    const seedBySlug = new Map(seed.map((row) => [row.slug, row]));
    const collegeIds = new Set(colleges.map((row) => row.id));
    if (colleges.length !== 205 || seedBySlug.size !== 205 ||
        sha256(colleges.map((row) => row.slug).join('\n')) !== manifest.collegeSlugsSha256 ||
        colleges.some((row) => !seedBySlug.has(row.slug)) || claims.some((row) => !collegeIds.has(String(row.collegeId)))) {
      throw new Error('Snapshot catalogue identity mismatch');
    }
    const restore = () => target.$transaction(async (tx) => {
      if (await tx.user.count() || await tx.evidenceDecision.count()) throw new Error('Unexpected users or decisions');
      const inserted = {
        colleges: (await tx.college.createMany({ data: colleges.map(({ slug, id }) => ({ ...seedBySlug.get(slug), id }) ) as never, skipDuplicates: true })).count,
        sources: (await tx.source.createMany({ data: sources as never, skipDuplicates: true })).count,
        claims: (await tx.fieldEvidence.createMany({ data: claims as never, skipDuplicates: true })).count,
        runs: (await tx.importRun.createMany({ data: runs as never, skipDuplicates: true })).count,
        audits: (await tx.auditLog.createMany({ data: audits as never, skipDuplicates: true })).count,
      };
      const actual = {
        colleges: await tx.college.findMany({ select: { id: true, slug: true }, orderBy: { slug: 'asc' } }),
        sources: await tx.source.findMany({ orderBy: { id: 'asc' } }),
        claims: await tx.fieldEvidence.findMany({ orderBy: { id: 'asc' } }),
        runs: await tx.importRun.findMany({ orderBy: { id: 'asc' } }),
        audits: await tx.auditLog.findMany({ orderBy: { id: 'asc' } }),
      };
      if (!isDeepStrictEqual(serializable(actual), { colleges, sources, claims, runs, audits })) {
        throw new Error('Restored records differ from the archive');
      }
      return inserted;
    }, { timeout: 30_000 });
    const first = await restore();
    const retry = await restore();
    if (Object.values(retry).some(Boolean)) throw new Error('Restore retry wrote records');
    const report = { snapshotSha256: manifest.sha256, first, retry, exactReadback: true, decisions: 0, users: 0 };
    writeFileSync(`${directory}/${values.snapshot}-rehearsal-report.json`, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } finally {
    await Promise.all([source?.$disconnect(), target.$disconnect()]);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message.replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, '$1[redacted]@') : 'unknown error';
  console.error(`Snapshot rehearsal failed: ${message}`);
  process.exitCode = 1;
});

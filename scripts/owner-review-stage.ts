import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdtemp, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { Prisma } from '@prisma/client';
import { assertOwnerReviewTarget } from '../src/server/owner-review-target';
import { validateOfficialFacts, type OfficialFactRows } from '../src/server/ingest/official-facts';
import archive from '../data/pilot/staged-evidence-after-batch-027.json';

export function ownerStagingTarget(env: NodeJS.ProcessEnv, rehearsal: boolean) {
  const target = assertOwnerReviewTarget(env, rehearsal ? 'rehearsal' : 'persistent');
  if (!rehearsal && target.pathname !== '/collegefind_owner_review_main') {
    throw new Error('Only collegefind_owner_review_main is approved for persistent staging.');
  }
  return target;
}

export function requireApprovedBatch(batch: Buffer, apply: boolean, approved: string | undefined) {
  const hash = createHash('sha256').update(batch).digest('hex');
  if (apply && approved !== hash) throw new Error('Apply requires explicit approval of these exact batch bytes via --approve-sha256.');
  return hash;
}

export async function verifyStagingIdentity(db: Pick<Prisma.TransactionClient, '$queryRaw' | 'college'>, target: URL) {
  const [actual] = await db.$queryRaw<{ database: string; role: string; port: number }[]>`
    SELECT current_database() AS database, current_user AS role, inet_server_port() AS port
  `;
  if (!actual || actual.database !== target.pathname.slice(1) || actual.role !== target.username || actual.port !== 5432) {
    throw new Error('Connected database does not match the independently confirmed target.');
  }
  const originals = await db.college.findMany({
    where: { id: { in: archive.collegeIdentity.map(({ id }) => id) } }, select: { id: true, slug: true },
  });
  const byId = new Map(originals.map(({ id, slug }) => [id, slug]));
  if (archive.collegeIdentity.some(({ id, slug }) => byId.get(id) !== slug)) throw new Error('Original catalogue identities do not match the owner-review archive.');
  return actual;
}

export async function planOwnerStage(db: Pick<Prisma.TransactionClient, 'fieldEvidence'>, rows: OfficialFactRows) {
  const seen = new Set<string>();
  const created: OfficialFactRows = [];
  const changes = [];
  const catalogue = new Map(archive.collegeIdentity.map(({ slug, id }) => [slug, id]));
  for (const row of rows) {
    const { claim, source, academicYear, field, scope } = row;
    const collegeId = catalogue.get(claim.institutionSlug);
    if (!collegeId) throw new Error('Batch contains an unknown original college slug.');
    const validFrom = claim.field === 'structured' && claim.validFrom ? new Date(claim.validFrom) : null;
    const validUntil = claim.field === 'structured' && claim.validUntil ? new Date(claim.validUntil + 'T23:59:59.999Z') : null;
    const sourceUrl = new URL(source.url).href;
    const existing = await db.fieldEvidence.findFirst({
      where: {
        collegeId, field, academicYear: academicYear ?? null, programScope: scope, validFrom, validUntil,
        source: { url: { in: [...new Set([sourceUrl, source.url])] } }, value: { equals: claim.value }, isFixture: false,
      }, select: { id: true }, orderBy: { id: 'asc' },
    });
    const key = JSON.stringify([collegeId, field, academicYear, scope, validFrom, validUntil, sourceUrl, claim.value]);
    const action = existing ? 'REUSE' : seen.has(key) ? 'DUPLICATE_IN_BATCH' : 'ADD_UNREVIEWED';
    if (action === 'ADD_UNREVIEWED') created.push(row);
    seen.add(key);
    changes.push({ action, collegeId, slug: claim.institutionSlug, field, value: claim.value, academicYear: claim.academicYear, scope, source: sourceUrl, evidenceLocation: claim.evidenceLocation, evidenceId: existing?.id });
  }
  return { created, changes };
}

export async function freshOwnerBackup(target: URL, directory: string, passphrase: string) {
  const dirStat = await lstat(directory);
  const passStat = await lstat(passphrase);
  if (!dirStat.isDirectory() || !passStat.isFile() || (dirStat.mode & 0o077) || (passStat.mode & 0o077)
      || dirStat.uid !== process.getuid?.() || passStat.uid !== process.getuid?.()) {
    throw new Error('Backup directory and passphrase file must be private and owner-controlled.');
  }
  const runDir = await mkdtemp(join(directory, 'before-stage-'));
  const path = join(runDir, 'owner-review.dump.gpg');
  const pgEnvironment = { NODE_ENV: process.env.NODE_ENV, PATH: process.env.PATH, HOME: homedir(),
    PGHOST: target.hostname, PGPORT: target.port, PGUSER: target.username,
    PGDATABASE: target.pathname.slice(1), PGPASSWORD: decodeURIComponent(target.password),
    PGCONNECT_TIMEOUT: '5',
  };
  try {
    // Fixed shell program. Paths are positional arguments and credentials stay in process environment.
    await promisify(execFile)('bash', ['-c', `
      set -euo pipefail
      umask 077
      pg_dump --no-password --format=custom --no-owner --no-privileges |
        env -u PGPASSWORD gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$1" --symmetric --cipher-algo AES256 --output "$2"
      env -u PGPASSWORD gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$1" --decrypt "$2" |
        env -u PGPASSWORD pg_restore --file=/dev/null
    `, 'owner-backup', passphrase, path], { env: pgEnvironment, timeout: 110_000 });
  } catch {
    throw new Error('Fresh encrypted backup or full archive readability check failed. Staging aborted.');
  }
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return { path, sha256: hash.digest('hex') };
}

export async function loadOwnerBatch(file: string) {
  return readFile(file);
}

export function validateOwnerStageBatch(payload: Buffer) {
  const manifest = JSON.parse(payload.toString());
  if (manifest?.ownerStagingReady !== true) throw new Error('Manifest is not designated for owner staging. Resolve all candidate holds before preparing a staging manifest.');
  if (Array.isArray(manifest.batches)) {
    if (manifest.batches.length < 1 || manifest.batches.length > 25) throw new Error('Owner staging bundle must contain between 1 and 25 bounded manifests.');
    const rows: OfficialFactRows = [];
    const sourceMetadata = new Map<string, string>();
    const semanticClaims = new Set<string>();
    const releaseRefs = new Set<string>();
    for (const batch of manifest.batches as unknown[]) {
      if (!batch || typeof batch !== 'object' || (batch as { ownerStagingReady?: unknown }).ownerStagingReady !== true) {
        throw new Error('Every manifest in an owner staging bundle must be explicitly marked ownerStagingReady.');
      }
      const batchRows = validateOfficialFacts(batch);
      for (const row of batchRows) {
        const sourceSignature = JSON.stringify([
          row.source.institutionSlug, row.source.publisher, row.source.title ?? null, new URL(row.source.url).href,
          row.source.publicationDate, row.source.academicYear, row.source.retrievedAt, row.source.access, row.source.reuseConditions,
        ]);
        const previousSource = sourceMetadata.get(row.source.id);
        if (previousSource && previousSource !== sourceSignature) throw new Error('Owner staging bundle reuses a source ID with conflicting provenance.');
        sourceMetadata.set(row.source.id, sourceSignature);
        const claim = row.claim;
        if (claim.field === 'structured' && claim.sourceReportedRef) {
          if (releaseRefs.has(claim.sourceReportedRef)) throw new Error('Owner staging bundle contains duplicate source-reported release references.');
          releaseRefs.add(claim.sourceReportedRef);
        }
        const semanticKey = JSON.stringify([
          claim.institutionSlug, row.field, claim.value, row.academicYear ?? null, row.scope,
          new URL(row.source.url).href,
          claim.field === 'structured' ? [claim.validFrom ?? null, claim.validUntil ?? null, claim.campusScope ?? null, claim.applicablePeriod ?? null, claim.publisherPeriod ?? null, claim.historical ?? false] : null,
        ]);
        if (semanticClaims.has(semanticKey)) throw new Error('Owner staging bundle contains a duplicate semantic claim.');
        semanticClaims.add(semanticKey);
      }
      rows.push(...batchRows);
    }
    if (rows.length > 625) throw new Error('Owner staging bundle exceeds the 625-claim safety limit.');
    return rows;
  }
  return validateOfficialFacts(manifest);
}

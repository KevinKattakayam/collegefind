import { parseArgs } from 'node:util';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { stageOfficialFactRows } from '../src/server/ingest/official-facts';
import { freshOwnerBackup, loadOwnerBatch, ownerStagingTarget, planOwnerStage, requireApprovedBatch, validateOwnerStageBatch, verifyStagingIdentity } from './owner-review-stage';

async function main() {
  const { values } = parseArgs({ options: {
    file: { type: 'string' }, apply: { type: 'boolean' }, rehearsal: { type: 'boolean' },
    'approve-sha256': { type: 'string' }, 'rehearsal-backup-directory': { type: 'string' },
  } });
  if (!values.file) throw new Error('--file is required.');
  if (values.rehearsal !== true && values['rehearsal-backup-directory']) throw new Error('Backup path override is rehearsal-only.');
  const target = ownerStagingTarget(process.env, values.rehearsal === true);
  const payload = await loadOwnerBatch(values.file);
  const batchSha256 = requireApprovedBatch(payload, values.apply === true, values['approve-sha256']);
  const rows = validateOwnerStageBatch(payload);
  const ownerDir = join(homedir(), '.local/share/collegefind-owner-review');
  const drillDir = values['rehearsal-backup-directory'];
  if (values.rehearsal && values.apply && !drillDir) throw new Error('Provide private disposable rehearsal backup storage.');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: target.toString(), connectionTimeoutMillis: 5000 }) });
  try {
    const identity = await verifyStagingIdentity(db, target);
    const preview = await planOwnerStage(db, rows);
    if (!values.apply) {
      console.log(JSON.stringify({ identity, batchSha256, mode: 'PREVIEW', writes: 0, proposedAdds: preview.created.length, changes: preview.changes }, null, 2));
      return;
    }
    let backup: Awaited<ReturnType<typeof freshOwnerBackup>> | undefined;
    let changes = preview.changes;
    const result = await stageOfficialFactRows(db, rows, async (tx, candidates) => {
      await verifyStagingIdentity(tx, target);
      const plan = await planOwnerStage(tx, candidates);
      changes = plan.changes;
      if (plan.created.length) backup = await freshOwnerBackup(target,
        drillDir ?? join(ownerDir, 'backups'),
        drillDir ? join(drillDir, 'passphrase') : join(ownerDir, 'secrets/backup-passphrase'));
      return plan.created;
    });
    console.log(JSON.stringify({ identity, batchSha256, changes, backup, ...result }, null, 2));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  // Driver and child-process errors can contain connection details.
  const message = error instanceof Error && error.constructor === Error && !error.message.includes('postgres') ? error.message : 'Owner staging failed validation or could not complete safely.';
  console.error(message);
  process.exitCode = 1;
});

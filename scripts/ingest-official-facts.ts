import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { importOfficialFacts } from '../src/server/ingest/official-facts';
import { assertDisposableTestTarget } from '../tests/integration/target';

async function main() {
  const { values } = parseArgs({ options: {
    file: { type: 'string' }, apply: { type: 'boolean', default: false }, report: { type: 'string' },
  } });
  if (!values.file) throw new Error('--file is required');
  const manifest = JSON.parse(readFileSync(values.file, 'utf8')) as unknown;
  if (!values.apply) {
    const result = await importOfficialFacts(null, manifest, true);
    const report = { ...result, sourceUse: 'manual public-source facts only; no source documents stored', databaseChanged: false };
    const output = `${JSON.stringify(report, null, 2)}\n`;
    if (values.report) writeFileSync(values.report, output);
    process.stdout.write(output);
    return;
  }

  // The test-target guard executes before constructing pg.Pool or PrismaClient.
  const connectionString = assertDisposableTestTarget();
  const pool = new pg.Pool({ connectionString, max: 4 });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const result = await importOfficialFacts(db, manifest, false);
    const report = result;
    const output = `${JSON.stringify(report, null, 2)}\n`;
    if (values.report) writeFileSync(values.report, output);
    process.stdout.write(output);
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Official fact import failed; no credentials logged'}\n`);
  process.exitCode = 1;
});

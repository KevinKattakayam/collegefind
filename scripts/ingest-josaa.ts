/**
 * Import a JoSAA opening/closing rank CSV.
 *
 *   npx tsx scripts/ingest-josaa.ts \
 *     --file data/josaa-2025-round6.csv --year 2025 --round 6 \
 *     --source-url "<exact page you downloaded from>" \
 *     --institutes data/institutes.csv [--dry-run]
 *
 * Always run with --dry-run first and read the rejected/unmatched report.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { importJosaaRows, parseInstituteMapping, parseJosaaCsv } from '../src/server/ingest/josaa';

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' },
      year: { type: 'string' },
      round: { type: 'string' },
      'source-url': { type: 'string' },
      'retrieved-at': { type: 'string' },
      license: { type: 'string', default: 'Terms not verified — check josaa.nic.in before republishing' },
      institutes: { type: 'string' },
      exam: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  const year = Number(values.year);
  const round = Number(values.round);
  if (!values.file || !Number.isInteger(year) || !Number.isInteger(round) || !values['source-url']) {
    throw new Error('Required: --file, --year, --round, --source-url');
  }
  if (values.exam && values.exam !== 'JEE_MAIN' && values.exam !== 'JEE_ADVANCED') {
    throw new Error('--exam must be JEE_MAIN or JEE_ADVANCED');
  }

  const { rows, rejected, duplicates } = parseJosaaCsv(readFileSync(values.file, 'utf8'));
  console.log(`Parsed ${rows.length} rows, rejected ${rejected.length}, duplicate keys ${duplicates}`);
  for (const r of rejected.slice(0, 50)) console.log(`  line ${r.line}: ${r.reason}`);

  const institutes = values.institutes ? parseInstituteMapping(readFileSync(values.institutes, 'utf8')) : new Map();
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const db = new PrismaClient({ adapter: new PrismaPg(new pg.Pool({ connectionString, max: 2 })) });
  try {
    const summary = await importJosaaRows(db, rows, {
      year,
      round,
      institutes,
      examOverride: values.exam as 'JEE_MAIN' | 'JEE_ADVANCED' | undefined,
      dryRun: values['dry-run'],
      source: {
        name: `JoSAA ${year} Opening & Closing Ranks, Round ${round}`,
        publisher: 'Joint Seat Allocation Authority (JoSAA)',
        url: values['source-url'],
        license: values.license,
        retrievedAt: values['retrieved-at'] ? new Date(values['retrieved-at']) : new Date(),
      },
    });
    console.log(JSON.stringify(summary, null, 2));
    if (summary.unmatchedInstitutes.length) {
      console.log('Add unmatched institutes to the --institutes mapping CSV and re-run.');
      process.exitCode = 2;
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

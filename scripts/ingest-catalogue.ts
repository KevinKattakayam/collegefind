import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { importCatalogue } from '../src/server/ingest/catalogue';
import { assertDisposableTestTarget } from '../tests/integration/target';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
async function main() {
 const { values } = parseArgs({ options: { file: { type: 'string' }, apply: { type: 'boolean', default: false } } });
 if (!values.file) throw new Error('--file required; default is dry run');
 const connectionString = assertDisposableTestTarget();
 const db = new PrismaClient({ adapter: new PrismaPg(new pg.Pool({ connectionString })) });
 try { console.log(JSON.stringify(await importCatalogue(db, JSON.parse(readFileSync(values.file, 'utf8')), !values.apply), null, 2)); }
 finally { await db.$disconnect(); }
}
main().catch(() => { console.error('Import failed; check local fixture configuration'); process.exitCode = 1; });

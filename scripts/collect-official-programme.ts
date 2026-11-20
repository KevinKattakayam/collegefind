import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { collectIitPatna } from '../src/server/ingest/official-collector';

async function main() {
  const { values } = parseArgs({
    options: { source: { type: 'string' }, output: { type: 'string' } },
  });
  if (values.source !== 'iit-patna-cse' || !values.output) {
    throw new Error('Use --source iit-patna-cse --output <new candidate manifest>');
  }
  const manifest = await collectIitPatna();
  await writeFile(values.output, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  process.stdout.write('Wrote one UNREVIEWED candidate. No database or publication change.\n');
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Official programme collection failed'}\n`);
  process.exitCode = 1;
});

import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import archive from '../data/pilot/staged-evidence-after-batch-027.json';
import { sourceReportedImportManifest } from '../src/server/source-reported';
import { validateOfficialFacts } from '../src/server/ingest/official-facts';

const { values } = parseArgs({ options: { outputDir: { type: 'string' } } });
if (!values.outputDir) throw new Error('--output-dir is required; use a new private temporary directory');
const outputDir = values.outputDir;
mkdirSync(outputDir, { recursive: false, mode: 0o700 });
const full = sourceReportedImportManifest(archive.collegeIdentity);
const written: Array<{ file: string; facts: number }> = [];
for (let offset = 0, part = 1; offset < full.candidateClaims.length; offset += 25, part += 1) {
  const candidateClaims = full.candidateClaims.slice(offset, offset + 25);
  const ids = new Set(candidateClaims.flatMap((claim) => claim.sourceIds as string[]));
  const manifest = { ...full, sources: full.sources.filter((source) => ids.has(source.id as string)), candidateClaims };
  validateOfficialFacts(manifest);
  const file = `${outputDir}/source-reported-${String(part).padStart(2, '0')}.json`;
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  written.push({ file, facts: candidateClaims.length });
}
process.stdout.write(`${JSON.stringify({ facts: full.candidateClaims.length, sourceRecords: full.sources.length, batches: written }, null, 2)}\n`);

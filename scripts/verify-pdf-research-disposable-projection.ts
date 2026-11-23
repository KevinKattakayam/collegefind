import { parseArgs } from 'node:util';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { projectPublicCollege } from '../src/server/public-evidence';
import { reviewFieldEvidence } from '../src/server/ingest/field-evidence';
import { assertDisposableTestTarget } from '../tests/integration/target';

const DB = 'collegefind_pdf_research_test';
const PORT = '35444';

async function main() {
  const { values } = parseArgs({ options: { 'synthetic-review': { type: 'boolean', default: false } } });
  const connectionString = assertDisposableTestTarget();
  const target = new URL(connectionString);
  if (target.hostname !== '127.0.0.1' || target.port !== PORT || decodeURIComponent(target.pathname.slice(1)) !== DB || target.username !== 'postgres') {
    throw new Error(`Refusing target; use only postgres@127.0.0.1:${PORT}/${DB}`);
  }
  if (!values['synthetic-review']) throw new Error('Pass --synthetic-review to write decisions; this command only supports the isolated disposable DB.');
  const pool = new pg.Pool({ connectionString, max: 3 });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const rows = await db.fieldEvidence.findMany({ include: { college: { select: { slug: true } }, source: true, decisions: true } });
    if (rows.length !== 336 || rows.some((row) => row.decisions.length)) throw new Error('Expected 336 staged, undecided PDF facts before synthetic verification');
    const find = (slug: string, kind: string, metric?: string) => rows.find((row) => {
      if (row.college.slug !== slug || row.field !== `structured.${kind}`) return false;
      const value = row.value as Record<string, unknown>;
      return !metric || value.metric === metric;
    });
    const selected = [
      find('indian-institute-of-technology-delhi', 'placement', 'MEDIAN'),
      find('indian-institute-of-technology-kanpur', 'placement', 'MEDIAN'),
      find('national-law-school-of-india-university', 'fee'),
    ];
    if (selected.some((row) => !row)) throw new Error('Required staged placement/fee examples are absent');

    // Verify staged values remain unavailable before any synthetic test decisions.
    const before = await db.college.findUniqueOrThrow({
      where: { slug: 'indian-institute-of-technology-delhi' },
      include: { evidence: { include: { source: true, decisions: true } } },
    });
    const hidden = projectPublicCollege(before as unknown as Record<string, unknown>, new Date('2026-11-23T00:00:00.000Z'));
    if ((hidden.structuredFacts as unknown[]).length !== 0) throw new Error('Unreviewed PDF data appeared in the public projection');

    const reviewer = await db.user.create({ data: {
      name: 'Disposable PDF pipeline reviewer', email: `pdf-pipeline-${Date.now()}@collegefind.test`,
      password: 'synthetic-test-only-not-a-real-credential', role: 'ADMIN',
    } });
    for (const row of selected) {
      await reviewFieldEvidence(db, {
        evidenceId: row!.id, reviewerId: reviewer.id, status: 'APPROVED',
        reason: 'Synthetic disposable integration rehearsal only; not a genuine human evidence decision',
      });
    }

    const checks: Array<{ slug: string; facts: Array<{ kind: string; value: unknown; academicYear: number | null; url: string; locator: string | null }> }> = [];
    for (const slug of ['indian-institute-of-technology-delhi', 'indian-institute-of-technology-kanpur', 'national-law-school-of-india-university']) {
      const college = await db.college.findUniqueOrThrow({
        where: { slug }, include: { evidence: { include: { source: true, decisions: true } } },
      });
      const projected = projectPublicCollege(college as unknown as Record<string, unknown>, new Date('2026-11-23T00:00:00.000Z'));
      const facts = (projected.structuredFacts as Array<{ value: { kind: string }; academicYear: number | null; source: { url: string; locator: string | null } }>).map((fact) => ({
        kind: fact.value.kind, value: fact.value, academicYear: fact.academicYear, url: fact.source.url, locator: fact.source.locator,
      }));
      if (!facts.length || facts.some((fact) => !fact.url.startsWith('https://') || !fact.locator)) throw new Error(`Approved data or provenance missing from ${slug} projection`);
      checks.push({ slug, facts });
    }
    const decisions = await db.evidenceDecision.count();
    const audits = await db.auditLog.count({ where: { action: 'evidence.review' } });
    if (decisions !== 3 || audits !== 3) throw new Error('Synthetic review audit history did not persist exactly once per example');
    process.stdout.write(`${JSON.stringify({
      status: 'DISPOSABLE_REVIEW_PROJECTION_VERIFIED',
      beforeDecision: { stagedRows: rows.length, publicStructuredFacts: (hidden.structuredFacts as unknown[]).length },
      afterSyntheticDecisions: { decisions, auditRows: audits, colleges: checks },
      syntheticOnly: true, genuineHumanApprovals: 0, persistentOwnerDatabase: 'NOT CONNECTED',
    }, null, 2)}\n`);
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Disposable projection verification failed'}\n`);
  process.exitCode = 1;
});

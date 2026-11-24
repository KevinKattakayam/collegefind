import { z } from 'zod';
import type { PrismaClient, Prisma } from '@prisma/client';
import { checksum, sourceIdentity } from './identity';

export const aliasSchema = z.object({ namespace: z.enum(['AISHE','AICTE','UGC','NIRF','JOSAA','NAME']), value: z.string().trim().min(1), campus: z.string().trim().min(1) });
const claimSchema = z.object({ collegeSlug: z.string().min(1), alias: aliasSchema.optional(), field: z.enum(['website','description','about','phone','email','establishedYear','facilities','scholarships','admissions']), value: z.string().min(1), academicYear: z.number().int().min(2000).max(2100), validUntil: z.iso.datetime(), locator: z.string().min(1), snippet: z.string().min(1) }).strict();
export const bundleSchema = z.object({ fixture: z.literal(true), source: z.object({ url: z.url().startsWith('https://'), publisher: z.string().min(1), collectedAt: z.iso.datetime() }), rows: z.array(z.unknown()).max(1000) }).strict();

/** Exact canonical slug or exact approved alias only. Ambiguity never merges records. */
export function reconcile(slug: string, canonical: { id: string; slug: string }[], aliases: { collegeId: string }[]) {
  const ids = new Set([...canonical.filter(c => c.slug === slug).map(c => c.id), ...aliases.map(a => a.collegeId)]);
  return ids.size === 1 ? { status: 'MATCHED' as const, collegeId: [...ids][0] } : { status: ids.size ? 'AMBIGUOUS' as const : 'UNMATCHED' as const };
}

/** Fixtures only until provider permission is established. No automatic publication. */
export async function importCatalogue(db: PrismaClient, raw: unknown, dryRun = true) {
  const bundle = bundleSchema.parse(raw);
  const canonical = await db.college.findMany({ select: { id: true, slug: true } });
  const accepted: { collegeId: string; row: z.infer<typeof claimSchema> }[] = [];
  const issues: { row: number; reason: string }[] = [];
  for (const [index, input] of bundle.rows.entries()) {
    const parsed = claimSchema.safeParse(input);
    if (!parsed.success) { issues.push({ row: index + 1, reason: 'Invalid claim or missing evidence' }); continue; }
    const row = parsed.data;
    const aliases = row.alias ? await db.institutionAlias.findMany({ where: row.alias }) : [];
    const match = reconcile(row.collegeSlug, canonical, aliases);
    if (match.status !== 'MATCHED') { issues.push({ row: index + 1, reason: match.status }); continue; }
    accepted.push({ collegeId: match.collegeId!, row });
  }
  const content = checksum(bundle);
  const identityKey = sourceIdentity(bundle.source, content);
  const summary = { accepted: accepted.length, rejected: issues.length, fixture: true, issues };
  if (dryRun) return { ...summary, dryRun: true };
  return db.$transaction(async tx => {
    const source = await tx.source.upsert({ where: { identityKey }, update: {}, create: { identityKey, name: 'FIXTURE catalogue import', publisher: bundle.source.publisher, url: bundle.source.url, license: 'LOCAL FIXTURE ONLY', retrievedAt: new Date(bundle.source.collectedAt) } });
    const run = await tx.importRun.upsert({ where: { identityKey }, update: {}, create: { identityKey, checksum: content, sourceId: source.id } });
    // Row lock serializes repeat attempts; a completed run is immutable.
    const locked = await tx.importRun.update({ where: { id: run.id }, data: { identityKey } });
    if (locked.status === 'STAGED' && locked.finishedAt) return locked.summary;
    for (const { collegeId, row } of accepted) {
      const key = checksum([identityKey, collegeId, row]);
      await tx.fieldEvidence.upsert({ where: { identityKey: key }, update: {}, create: { identityKey: key, collegeId, sourceId: source.id, field: row.field, value: row.value, academicYear: row.academicYear, validUntil: new Date(row.validUntil), isFixture: true, evidenceLocator: row.locator, evidenceSnippet: row.snippet } });
    }
    await tx.importRun.update({ where: { id: run.id }, data: { status: 'STAGED', finishedAt: new Date(), summary: summary as unknown as Prisma.InputJsonValue, issues: issues as unknown as Prisma.InputJsonValue } });
    await tx.auditLog.create({ data: { action: 'fixture.import', targetType: 'ImportRun', targetId: run.id, metadata: { checksum: content, accepted: accepted.length, rejected: issues.length } } });
    return summary;
  });
}

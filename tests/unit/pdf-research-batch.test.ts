import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { importOfficialFacts } from '@/server/ingest/official-facts';

const batch = JSON.parse(readFileSync('data/pilot/pdf-research-2026-batch-060.json', 'utf8')) as {
  readPageCount: number;
  catalogueIdentityHash: string;
  catalogueIdentities: Array<{ id: string; slug: string }>;
  profileExtracts: Array<{ position: number; outcomes: unknown[]; hasOfficialCutoffValues: boolean }>;
  sources: Array<{ id: string; institutionSlug: string; url: string; retrievedAt: string; reuseConditions: string; evidenceLocations: string[] }>;
  candidates: Array<{ collegeId: string; candidate: { institutionSlug: string; sourceIds: string[]; academicYear: string | null; evidenceLocation: string; status: string; reviewState: string; stageable: boolean; field: 'structured'; value: Record<string, unknown> } }>;
  dispositions: Array<{ status: string; reason: string }>;
  summary: { candidateClaimsAfterDeduplication: number; exactDuplicatesExcluded: number; heldOrExcludedDispositions: number };
};

describe('CollegeFind PDF research batch 060', () => {
  it('maps all 229 pages to the original 205 catalogue identities and retains source locators', () => {
    const hash = createHash('sha256').update(batch.catalogueIdentities.map(({ id, slug }) => `${id}|${slug}`).join('\n')).digest('hex');
    expect(batch.readPageCount).toBe(229);
    expect(batch.catalogueIdentities).toHaveLength(205);
    expect(hash).toBe(batch.catalogueIdentityHash);
    expect(batch.profileExtracts.map(({ position }) => position)).toEqual(Array.from({ length: 205 }, (_, index) => index + 1));
    expect(batch.profileExtracts.reduce((count, profile) => count + profile.outcomes.length, 0)).toBe(79);
    expect(batch.profileExtracts.some(({ hasOfficialCutoffValues }) => hasOfficialCutoffValues)).toBe(false);
    expect(batch.candidates.every(({ candidate }) => candidate.evidenceLocation.includes('PDF p.') && candidate.sourceIds.length === 1)).toBe(true);
    expect(batch.sources.every(({ url, retrievedAt, reuseConditions, evidenceLocations }) => url.startsWith('https://') && Number.isFinite(Date.parse(retrievedAt)) && reuseConditions.length > 20 && evidenceLocations.length > 0)).toBe(true);
  });

  it('dry-runs every bounded import manifest as UNREVIEWED and keeps archive holds explicit', async () => {
    expect(batch.candidates).toHaveLength(336);
    expect(batch.summary).toMatchObject({ candidateClaimsAfterDeduplication: 336, exactDuplicatesExcluded: 0, heldOrExcludedDispositions: 117 });
    const sourceById = new Map(batch.sources.map((source) => [source.id, source]));
    const ids = new Map(batch.catalogueIdentities.map((row) => [row.slug, row.id]));
    let dryRunFacts = 0;
    for (let offset = 0; offset < batch.candidates.length; offset += 25) {
      const candidates = batch.candidates.slice(offset, offset + 25);
      for (const row of candidates) {
        expect(ids.get(row.candidate.institutionSlug)).toBe(row.collegeId);
        expect(row.candidate).toMatchObject({ status: 'RESEARCHED_READY_FOR_UNREVIEWED_STAGING', reviewState: 'UNREVIEWED', stageable: true });
        expect(sourceById.get(row.candidate.sourceIds[0])?.institutionSlug).toBe(row.candidate.institutionSlug);
      }
      const used = new Set(candidates.flatMap(({ candidate }) => candidate.sourceIds));
      const result = await importOfficialFacts(null, {
        scope: 'RESEARCH_NOTES_WITH_IMPORTABLE_CANDIDATES',
        sources: [...used].map((id) => sourceById.get(id)),
        candidateClaims: candidates.map(({ candidate }) => candidate),
      }, true, new Date('2026-11-23T00:00:00.000Z'));
      expect(result.reviewState).toBe('UNREVIEWED');
      dryRunFacts += result.facts;
    }
    expect(dryRunFacts).toBe(336);
    expect(batch.dispositions.filter(({ status }) => status === 'PRESERVED_ARCHIVE_HOLD')).toHaveLength(16);
    expect(batch.dispositions.filter(({ status }) => status === 'DUPLICATE_EXISTING' || status === 'DUPLICATE_WITHIN_PDF_BATCH')).toHaveLength(0);
  });
});

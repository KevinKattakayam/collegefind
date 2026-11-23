import type { College } from '@/types';
import { prisma } from '@/lib/prisma';
import { eligibleSourceReported, suppressSourceReported } from '@/server/source-reported';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

/**
 * Resolve the public source-reported register against this college's review
 * history. This is deliberately separate from the human-reviewed projection:
 * it cannot grant VERIFIED status or add facts to scoring data.
 */
export async function publicSourceReportedFacts(college: College) {
  const facts = eligibleSourceReported(college);
  if (!facts.length) return [];
  const rows = await prisma.fieldEvidence.findMany({
    where: {
      collegeId: college.id,
      isFixture: false,
      field: { in: [...new Set(facts.flatMap(({ value }) => value.kind === 'programme'
        ? ['structured.programme', 'courses']
        : [`structured.${value.kind}`]))] },
    },
    select: {
      id: true, field: true, isFixture: true, value: true, academicYear: true,
      validFrom: true, validUntil: true, supersedesId: true,
      sourceReportedRef: true, campusScope: true, applicablePeriod: true, publisherPeriod: true,
      historical: true, evidenceLocator: true,
      source: { select: { url: true, publisher: true, retrievedAt: true, publishedAt: true, name: true } },
      decisions: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { status: true } },
    },
  });
  // Once a release fact has been imported, render the persisted typed value and
  // provenance. The checked release register remains the allow-list; a database
  // row alone can never publish a claim. Missing rows retain the legacy register
  // projection until a separately authorized persistent import occurs.
  const imported = new Map(rows.filter((row) => row.sourceReportedRef).map((row) => [row.sourceReportedRef!, row]));
  const persistedFacts = facts.flatMap<(typeof facts)[number]>((fact) => {
    const row = imported.get(fact.ref);
    if (!row) return [fact];
    const valueMatches = canonical(row.value) === canonical(fact.value);
    const expectedPeriod = fact.publisherPeriod ?? (fact.academicYear ? `Academic year ${fact.academicYear}` : 'Current at source check');
    const provenanceMatches = !row.isFixture && row.field === `structured.${fact.value.kind}` &&
      row.source.url === fact.url && row.source.publisher === fact.publisher && row.source.name === fact.sourceTitle &&
      row.campusScope === fact.campus && row.evidenceLocator === fact.evidenceLocation &&
      row.applicablePeriod === expectedPeriod && row.historical === fact.historical;
    if (!valueMatches || !provenanceMatches) return [];
    return [{ ...fact, value: row.value as typeof fact.value, collectedAt: row.source.retrievedAt.toISOString(),
      publicationDate: row.source.publishedAt?.toISOString() ?? null, sourceTitle: row.source.name,
      academicYear: row.academicYear ?? fact.academicYear, publisherPeriod: row.publisherPeriod ?? fact.publisherPeriod,
      historical: row.historical }];
  });
  return suppressSourceReported(persistedFacts, rows, college.structuredFacts ?? []);
}

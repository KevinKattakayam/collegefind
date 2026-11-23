import type { College } from '@/types';
import { prisma } from '@/lib/prisma';
import { eligibleSourceReported, suppressSourceReported } from '@/server/source-reported';

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
      decisions: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { status: true } },
    },
  });
  return suppressSourceReported(facts, rows, college.structuredFacts ?? []);
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withErrorHandling } from '@/lib/http';

/** Real counts for the homepage, replacing hard-coded marketing numbers. */
export const GET = withErrorHandling(async () => {
  const [colleges, byStatus, states, reviewedCutoffs, sources] = await Promise.all([
    prisma.college.count(),
    prisma.college.groupBy({ by: ['dataStatus'], _count: { _all: true } }),
    prisma.college.findMany({ select: { state: true }, distinct: ['state'] }),
    prisma.cutoffRecord.findMany({ where: { isPreparatory: false, program: { college: { dataStatus: { not: 'DEMO' } } } }, select: { exam: true, year: true } }),
    prisma.source.count(),
  ]);
  const status = Object.fromEntries(byStatus.map((s) => [s.dataStatus, s._count._all]));
  return NextResponse.json(
    {
      colleges,
      verifiedColleges: 0, // Field approvals do not certify whole profiles.
      demoColleges: status.DEMO ?? 0,
      states: states.length,
      cutoffRecords: reviewedCutoffs.length,
      sources,
      latestCutoffYearByExam: Object.fromEntries(reviewedCutoffs.map((r) => [r.exam, Math.max(...reviewedCutoffs.filter((c) => c.exam === r.exam).map((c) => c.year))])),
    },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
  );
});

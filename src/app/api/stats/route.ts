import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withErrorHandling } from '@/lib/http';

/** Real counts for the homepage, replacing hard-coded marketing numbers. */
export const GET = withErrorHandling(async () => {
  const [colleges, byStatus, states, cutoffRecords, sources, latest] = await Promise.all([
    prisma.college.count(),
    prisma.college.groupBy({ by: ['dataStatus'], _count: { _all: true } }),
    prisma.college.findMany({ select: { state: true }, distinct: ['state'] }),
    prisma.cutoffRecord.count({ where: { isPreparatory: false } }),
    prisma.source.count(),
    prisma.cutoffRecord.groupBy({ by: ['exam'], _max: { year: true } }),
  ]);
  const status = Object.fromEntries(byStatus.map((s) => [s.dataStatus, s._count._all]));
  return NextResponse.json(
    {
      colleges,
      verifiedColleges: status.VERIFIED ?? 0,
      demoColleges: status.DEMO ?? 0,
      states: states.length,
      cutoffRecords,
      sources,
      latestCutoffYearByExam: Object.fromEntries(latest.map((l) => [l.exam, l._max.year])),
    },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
  );
});

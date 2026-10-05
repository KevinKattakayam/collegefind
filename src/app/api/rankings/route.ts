import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { readQuery, withErrorHandling } from '@/lib/http';

const querySchema = z.object({
  category: z.string().trim().max(60).default('Overall'),
  year: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().min(2016).max(2100).optional()),
});

/** Official NIRF ranks imported from nirfindia.org — never computed by us. */
export const GET = withErrorHandling(async (request: Request) => {
  const q = readQuery(request, querySchema);
  const available = await prisma.nirfRanking.groupBy({ by: ['category', 'year'], orderBy: [{ year: 'desc' }] });
  const year = q.year ?? available.find((a) => a.category === q.category)?.year;
  const rankings = year
    ? await prisma.nirfRanking.findMany({
        where: { category: q.category, year },
        orderBy: { rank: 'asc' },
        take: 200,
        select: {
          rank: true,
          score: true,
          year: true,
          category: true,
          college: { select: { id: true, slug: true, name: true, shortName: true, city: true, state: true, type: true } },
          source: { select: { name: true, url: true, retrievedAt: true } },
        },
      })
    : [];
  return NextResponse.json(
    { category: q.category, year: year ?? null, rankings, available },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
  );
});

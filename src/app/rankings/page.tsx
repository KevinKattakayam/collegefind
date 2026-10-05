import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumb from '@/components/Breadcrumb';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = {
  title: 'NIRF rankings',
  description: 'Official NIRF ranks published by the Ministry of Education, with the source and year for each list.',
};
export const revalidate = 3600;

/**
 * The previous page sorted colleges by an invented "rating" and called it a
 * ranking. CollegeFind does not rank colleges itself; it shows official NIRF
 * ranks once they are imported into the NirfRanking table.
 */
async function load(category: string) {
  try {
    const available = await prisma.nirfRanking.groupBy({ by: ['category', 'year'], orderBy: [{ year: 'desc' }] });
    const year = available.find((a) => a.category === category)?.year;
    const rows = year
      ? await prisma.nirfRanking.findMany({
          where: { category, year },
          orderBy: { rank: 'asc' },
          take: 200,
          select: {
            rank: true,
            score: true,
            college: { select: { slug: true, name: true, city: true, state: true } },
            source: { select: { name: true, url: true } },
          },
        })
      : [];
    return { available, year: year ?? null, rows };
  } catch {
    return { available: [], year: null, rows: [] };
  }
}

export default async function RankingsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const requested = (await searchParams).category;
  const category = typeof requested === 'string' && requested.length <= 60 ? requested : 'Overall';
  const { available, year, rows } = await load(category);
  const categories = [...new Set(available.map((a) => a.category))];

  return (
    <div className="container-main py-6 max-w-4xl">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Rankings' }]} />
      <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">NIRF rankings</h1>
      <p className="text-slate-600 mb-6">
        These are the Ministry of Education&rsquo;s official National Institutional Ranking Framework ranks. CollegeFind does
        not create its own rankings and colleges cannot pay to change their position.
      </p>

      {categories.length > 1 && (
        <nav aria-label="Ranking category" className="flex flex-wrap gap-2 mb-6">
          {categories.map((c) => (
            <Link key={c} href={`/rankings?category=${encodeURIComponent(c)}`} aria-current={c === category ? 'page' : undefined}
              className={`px-3 py-1.5 rounded-full text-sm font-medium no-underline ${c === category ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-800'}`}>
              {c}
            </Link>
          ))}
        </nav>
      )}

      {rows.length === 0 ? (
        <div className="card-premium p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-2">NIRF data has not been imported yet</h2>
          <p className="text-slate-700">
            See the official lists on{' '}
            <a href="https://www.nirfindia.org" target="_blank" rel="noopener noreferrer" className="text-indigo-700 font-semibold">nirfindia.org</a>.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-600 mb-3">{category}, {year}</p>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-600">
                  <th scope="col" className="p-3">Rank</th>
                  <th scope="col" className="p-3">Institution</th>
                  <th scope="col" className="p-3">Location</th>
                  <th scope="col" className="p-3 text-right">NIRF score</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.college.slug} className="border-t border-slate-100">
                    <td className="p-3 font-bold">{r.rank}</td>
                    <td className="p-3"><Link href={`/colleges/${r.college.slug}`} className="text-indigo-700">{r.college.name}</Link></td>
                    <td className="p-3 text-slate-600">{r.college.city}, {r.college.state}</td>
                    <td className="p-3 text-right">{r.score?.toFixed(2) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Source: <a href={rows[0].source.url} target="_blank" rel="noopener noreferrer" className="text-indigo-700">{rows[0].source.name}</a>
          </p>
        </>
      )}
    </div>
  );
}

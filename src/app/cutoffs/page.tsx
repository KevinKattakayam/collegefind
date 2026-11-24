import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumb from '@/components/Breadcrumb';
import CutoffTable from '@/components/college/CutoffTable';
import CutoffFilters from '@/components/college/CutoffFilters';
import CutoffTrend from '@/components/college/CutoffTrend';
import { prisma } from '@/lib/prisma';
import { cutoffQuerySchema, listPublicCutoffTrend, listPublicCutoffs, type CutoffQuery } from '@/server/cutoffs';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Historical College Cutoff Explorer',
  description: 'Explore human-reviewed official historical college cutoffs by counselling system, exam, programme, category, quota, seat pool, year and round.',
};

type Search = Record<string, string | string[] | undefined>;
function queryHref(query: CutoffQuery, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, page })) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return `/cutoffs?${params.toString()}`;
}

export default async function CutoffExplorerPage({ searchParams }: { searchParams: Promise<Search> }) {
  const raw = Object.fromEntries(Object.entries(await searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  const parsed = cutoffQuerySchema.safeParse(raw);
  if (!parsed.success) return <main className="container-main py-8"><Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Cutoff explorer' }]} /><h1 className="text-3xl font-black">Invalid cutoff filters</h1><p role="alert" className="mt-3 text-slate-600">Check the year, page, round and filter values. Year ranges must be ordered and cannot be combined with one exact year.</p><Link href="/cutoffs" className="mt-4 inline-block text-indigo-700 underline">Clear filters</Link></main>;
  const result = await listPublicCutoffs(prisma, parsed.data);
  const trend = await listPublicCutoffTrend(prisma, parsed.data);
  const q = parsed.data;
  return <main className="container-main py-8">
    <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Cutoff explorer' }]} />
    <header className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">Historical admissions data</p>
      <h1 className="mt-2 text-3xl font-black text-slate-950 md:text-4xl">Cutoff explorer</h1>
      <p className="mt-3 text-slate-700">Browse human-reviewed records from cited counselling-authority sources. These historical outcomes are not admission predictions or guarantees. Filters and pagination are encoded in this page URL, so you can bookmark or share them.</p>
      <p className="mt-2 text-sm text-slate-600">Only approved records for non-demo colleges are included. Missing, staged, rejected, conflicting or fixture rows are not presented as official cutoffs.</p>
    </header>

    <CutoffFilters query={q} />

    <CutoffTrend state={trend.state} rows={trend.rows} selection={{ year: q.year, yearFrom: q.yearFrom, yearTo: q.yearTo, round: q.round }} />

    <section aria-live="polite" className="mt-7">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Reviewed records</h2><p className="text-sm text-slate-600">{result.total.toLocaleString('en-IN')} results · page {result.page} of {Math.max(result.totalPages, 1)}</p></div>
      <CutoffTable rows={result.items} showCollege />
      {result.items.length > 0 && <p className="mt-3 text-xs leading-5 text-slate-600">Opening and closing values use the type and rank definition shown in each row; do not compare unlike rank types or counselling systems. “P” marks a preparatory rank-list value. No values are extrapolated for missing years or rounds.</p>}
      <nav aria-label="Cutoff result pages" className="mt-5 flex items-center justify-between gap-4">
        {result.page > 1 ? <Link rel="prev" href={queryHref(q, result.page - 1)} className="rounded-lg border px-4 py-2 text-indigo-700">Previous</Link> : <span aria-disabled="true" className="rounded-lg border px-4 py-2 text-slate-400">Previous</span>}
        <span className="text-sm text-slate-600">{result.total.toLocaleString('en-IN')} matching official records</span>
        {result.page < result.totalPages ? <Link rel="next" href={queryHref(q, result.page + 1)} className="rounded-lg border px-4 py-2 text-indigo-700">Next</Link> : <span aria-disabled="true" className="rounded-lg border px-4 py-2 text-slate-400">Next</span>}
      </nav>
    </section>
  </main>;
}

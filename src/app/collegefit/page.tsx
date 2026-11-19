import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { collegeListSelect } from '@/server/colleges';
import { degrees, evaluateFit, fitQuery, fitWeight } from '@/lib/college-fit';
import CollegeActions from '@/components/college/CollegeActions';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'CollegeFit' };

export default async function CollegeFit({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const parsed = fitQuery.safeParse(raw);
  const q = parsed.success ? parsed.data : fitQuery.parse({});
  const enriched = Boolean(q.programme || q.degree || q.budget);
  const active = Boolean(q.location || q.type || enriched);
  const rows = active ? await prisma.college.findMany({ where: { NOT: { slug: { startsWith: 'synthetic-institute-' } } }, select: collegeListSelect, orderBy: [{ name: 'asc' }, { id: 'asc' }] }) : [];
  const evaluated = rows.map((college) => {
    const reasons = evaluateFit(college, q);
    return { college, reasons, weight: enriched ? fitWeight(reasons, q.priority) : null, identityMismatch: reasons.some((r) => r.dimension === 'identity' && r.state === 'MISMATCH') };
  });
  // Identity mismatches remain visible, with the reason. Unknown coverage is not a sort penalty.
  const comparable = evaluated.filter((row) => row.weight !== null).sort((a, b) => b.weight! - a.weight!);
  const discovery = evaluated.filter((row) => row.weight === null).sort((a, b) => Number(a.identityMismatch) - Number(b.identityMismatch));
  const items = [...comparable, ...discovery];
  const pageSize = 20;
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(q.page ?? 1, pages);
  const href = (n: number) => '/collegefit?' + new URLSearchParams(Object.entries({ ...q, page: n })
    .filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => [key, String(value)]));
  const visible = items.slice((page - 1) * pageSize, page * pageSize);
  const user = visible.length ? await getSessionUser() : null;
  const saved = user ? await prisma.savedCollege.findMany({
    where: { userId: user.id, collegeId: { in: visible.map(({ college }) => college.id) } },
    select: { collegeId: true },
  }) : [];
  const savedIds = new Set(saved.map(({ collegeId }) => collegeId));
  return <div className="container-main space-y-6 py-8">
    <header>
      <h1 className="text-3xl font-black">CollegeFit</h1>
      <p className="mt-2 text-slate-700">Explore colleges by your preferences. Fit compares documented facts and catalogue identity. For admission requirements and past ranks, open <Link className="underline" href="/predictor">Admission guidance</Link>.</p>
    </header>
    {!parsed.success && <p role="alert">Check your preferences and try again.</p>}
    <form action="/collegefit" className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="space-y-1">City or state<input className="input-field w-full" name="location" defaultValue={q.location} maxLength={100} /></label>
      <label className="space-y-1">Institution type<select className="input-field w-full" name="type" defaultValue={q.type}><option value="">Any</option><option value="GOVERNMENT">Government</option><option value="PRIVATE">Private</option></select></label>
      <label className="space-y-1">Programme<input className="input-field w-full" name="programme" defaultValue={q.programme} maxLength={140} /></label>
      <label className="space-y-1">Degree level<select className="input-field w-full" name="degree" defaultValue={q.degree}><option value="">Any</option>{degrees.map((degree) => <option key={degree}>{degree}</option>)}</select></label>
      <label className="space-y-1">Annual tuition budget (₹)<input className="input-field w-full" type="number" min={1} max={100000000} name="budget" defaultValue={q.budget} /></label>
      <label className="space-y-1">Published fee category<input className="input-field w-full" name="feeCategory" defaultValue={q.feeCategory} maxLength={100} /></label>
      <label className="space-y-1">Fee academic year<input className="input-field w-full" type="number" min={2000} max={2100} name="year" defaultValue={q.year} /></label>
      <label className="space-y-1">Give extra weight to<select className="input-field w-full" name="priority" defaultValue={q.priority}>
        <option value="">Equal priorities</option><option value="identity">Location and institution type</option><option value="programme">Programme and degree</option><option value="budget">Annual tuition budget</option>
      </select></label>
      <button className="btn-primary justify-self-start">Find colleges</button>
    </form>
    <p className="text-sm text-slate-700">For budget matching, enter the exact published programme, fee category and academic year. Bookmark the results to revisit your preferences.</p>
    <div className="flex flex-wrap gap-4 text-indigo-700 underline"><Link href="/colleges">Search colleges</Link><Link href="/compare">Compare colleges</Link><Link href="/saved">Open shortlist</Link></div>
    {active && <section aria-labelledby="fit-results" className="space-y-4">
      <h2 id="fit-results" className="text-xl font-bold">Preference results</h2>
      <p role="status">{items.length} colleges considered. {comparable.length ? `${comparable.length} have evidence for every selected preference.` : enriched ? 'Insufficient evidence for a comparable fit ranking.' : 'Showing catalogue identity matches. Add a programme or budget preference to check reviewed evidence.'}</p>
      {!items.length && <p>No catalogue records are available.</p>}
      {visible.map(({ college, reasons, weight }) => <article key={college.id} className="space-y-2 rounded-xl border p-4">
        <h3 className="font-bold"><Link className="text-indigo-700 underline" href={`/colleges/${college.slug}`}>{college.name}</Link></h3>
        <p>{college.city}, {college.state} · {!enriched ? 'Catalogue identity' : weight === null ? 'Insufficient evidence for ranking' : 'Comparable on selected preferences'}</p>
        <ul className="space-y-2">{reasons.map((reason) => <li key={reason.label}>
          <strong>{reason.label} · {reason.state}</strong> <span>{reason.detail}</span>
          {reason.facts?.map((fact) => <p key={fact.key} className="break-words text-sm">
            {fact.value.kind === 'programme' && `${fact.value.programme} · ${fact.value.level} · `}
            {fact.academicYear ?? 'Year not published'} · <a className="text-indigo-700 underline" href={fact.source.url}>{fact.source.publisher}</a>
          </p>)}
        </li>)}</ul>
        <CollegeActions college={college} savedOnLoad={savedIds.has(college.id)} shareUrl={`/colleges/${college.slug}`} />
      </article>)}
      <nav aria-label="CollegeFit result pages" className="flex flex-wrap gap-4">
        {page > 1 && <Link className="underline" href={href(page - 1)}>Previous</Link>}
        <span>Page {page} of {pages}</span>
        {page < pages && <Link className="underline" href={href(page + 1)}>Next</Link>}
      </nav>
    </section>}
  </div>;
}

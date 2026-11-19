import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import Breadcrumb from '@/components/Breadcrumb';
import CollegeCard from '@/components/CollegeCard';
import DataStatusBadge from '@/components/DataStatusBadge';
import CollegeActions from '@/components/college/CollegeActions';
import CutoffTable from '@/components/college/CutoffTable';
import QuestionsAndAnswers from '@/components/college/QuestionsAndAnswers';
import { prisma } from '@/lib/prisma';
import { collegeDetailSelect, collegeListSelect } from '@/server/colleges';
import { formatCount, formatINR, formatLPA, formatPct } from '@/lib/utils';
import { SITE_URL } from '@/lib/site';
import type { College } from '@/types';
import { structuredLabels } from '@/server/ingest/structured-facts';
import { listPublicCutoffs } from '@/server/cutoffs';
import { collegeSourceLinks } from '@/server/college-source-links';

export const dynamic = 'force-dynamic';

const getCollege = cache(async (key: string) => {
  if (!/^[a-z0-9_-]{1,120}$/i.test(key)) return null;
  return prisma.college.findFirst({ where: { OR: [{ slug: key }, { id: key }] }, select: collegeDetailSelect });
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const college = await getCollege((await params).id);
  // Signal 404 here too: metadata resolves before the page body streams, so
  // returning normal metadata for a missing college yields a soft 200.
  if (!college) notFound();
  return {
    title: `${college.name}, ${college.city}`,
    description: `${college.name} in ${college.city}, ${college.state}. View source-reviewed college information and historical admissions cutoffs where available.`,
    alternates: { canonical: `/colleges/${college.slug}` },
  };
}

async function getCutoffs(collegeSlug: string) {
  return listPublicCutoffs(prisma, { college: collegeSlug, page: 1, pageSize: 8 });
}

async function getSimilar(college: { id: string; state: string; type: 'GOVERNMENT' | 'PRIVATE' }) {
  return prisma.college.findMany({
    where: { state: college.state, type: college.type, id: { not: college.id }, dataStatus: { not: 'DEMO' } },
    select: collegeListSelect,
    orderBy: { name: 'asc' },
    take: 3,
  });
}

export default async function CollegeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const key = (await params).id;
  const college = await getCollege(key);
  if (!college) notFound();
  // Old links used the database id; send them to the canonical slug URL.
  if (key !== college.slug) permanentRedirect(`/colleges/${college.slug}`);

  const [cutoffs, similar] = await Promise.all([getCutoffs(college.slug), getSimilar(college)]);
  const sourceLinks = collegeSourceLinks(college.slug);
  const listCollege: College = { ...college };
  const contactFacts = (listCollege.structuredFacts ?? []).filter(({ value }) => value.kind === 'contact');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollegeOrUniversity',
    name: college.name,
    url: `${SITE_URL}/colleges/${college.slug}`,
    address: { '@type': 'PostalAddress', addressLocality: college.city, addressRegion: college.state, addressCountry: 'IN' },
    ...(college.website ? { sameAs: [college.website] } : {}),
  };

  const metrics = [
    { label: 'Annual tuition', value: college.annualFees == null ? null : formatINR(college.annualFees), year: college.metricsYear },
    { label: 'Placement rate', value: college.placementPct == null ? null : formatPct(college.placementPct) },
    { label: 'Average package', value: college.avgPackage == null ? null : formatLPA(college.avgPackage) },
    { label: 'Highest package', value: college.highestPackage == null ? null : formatLPA(college.highestPackage) },
    { label: 'Students', value: college.totalStudents == null ? null : formatCount(college.totalStudents) },
  ].filter(({ value }) => value !== null);
  const sections = [
    ['overview', 'Overview'], ['programmes-and-admissions', 'Programmes & admissions'],
    ['fees', 'Fees & aid'], ['recognition', 'Recognition'], ['placements', 'Placements & facilities'],
    ['historical-cutoffs', 'Cutoffs'], ['official-resources', 'Contacts & sources'],
  ];

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <section className="detail-hero py-10 md:py-14">
        <div className="container-main">
          <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Colleges', href: '/colleges' }, { label: college.shortName }]} />
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 mb-2 tracking-tight">{college.name}</h1>
          <p className="text-slate-600 text-sm mb-4">
            {college.city}, {college.state}
            {college.establishedYear ? ` · Established ${college.establishedYear}` : ''}
          </p>
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            {college.type === 'GOVERNMENT' ? <span className="badge-green">Government</span> : <span className="badge-purple">Private</span>}
            {college.naacGrade && <span className="badge-blue">NAAC {college.naacGrade}</span>}
            <DataStatusBadge status={college.dataStatus} />
          </div>
          <CollegeActions college={listCollege} />
          <Link className="mt-3 inline-block text-indigo-700 underline" href={`/collegefit?location=${encodeURIComponent(college.state)}`}>Explore CollegeFit in {college.state}</Link>
          <nav aria-label="On this college profile" className="mt-5">
            <ul className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
              {sections.map(([id, label]) => <li key={id}><a className="text-indigo-700 underline underline-offset-4" href={`#${id}`}>{label}</a></li>)}
            </ul>
          </nav>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-semibold">Sources and verification</summary>
            <p className="mt-2">Fields are reviewed individually. Missing, conflicting or outdated values are withheld.</p>
            <ul className="mt-2 space-y-2">
              {Object.entries(listCollege.fieldEvidence ?? {}).map(([field, evidence]) => (
                <li key={field}>
                  <span className="font-medium">{({ annualFees: 'Annual fees', naacGrade: 'NAAC grade', establishedYear: 'Established', totalStudents: 'Students', topRecruiters: 'Recruiters', description: 'Description', about: 'About', admissions: 'Admissions link', website: 'Website', phone: 'Phone', email: 'Email', courses: 'Courses' } as Record<string,string>)[field] ?? field}</span>
                  {': '}{evidence.status === 'AVAILABLE' ? 'Reviewed' : evidence.status === 'CONFLICT' ? 'Conflicting sources' : evidence.status === 'OUTDATED' ? 'Outdated' : 'Not yet verified'}
                  {(evidence.sources ?? []).map((source, index) => <a key={index} href={source.url} target="_blank" rel="noopener noreferrer" className="ml-2 underline">{source.publisher}</a>)}
                </li>
              ))}
            </ul>
          </details>
        </div>
      </section>

      <section className="container-main py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section id="overview" className="card-enterprise scroll-mt-24 p-4 sm:p-6">
            <h2 className="text-xl font-black text-slate-800">Overview</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="font-medium">Catalogue location</dt><dd>{college.city}, {college.state}</dd></div>
              <div><dt className="font-medium">Institution type</dt><dd>{college.type === 'GOVERNMENT' ? 'Government' : 'Private'}</dd></div>
            </dl>
            <p className="mt-4 text-sm leading-relaxed text-slate-700">{college.about ?? college.description ?? 'A source-reviewed institution overview is not available yet.'}</p>
            {metrics.length > 0 && <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              {metrics.map(({ label, value, year }) => <div key={label} className="rounded-lg bg-slate-50 p-3">
                <dt className="text-sm">{label}{year ? ` (${year})` : ''}</dt><dd className="font-semibold">{value}</dd>
              </div>)}
            </dl>}
          </section>
          <section id="programmes-and-admissions" className="card-enterprise scroll-mt-24 p-4 sm:p-6">
            <h2 className="text-xl font-black text-slate-800">Programmes and admissions</h2>
            {listCollege.admissions && <a href={listCollege.admissions} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-indigo-700 underline">Official admissions information</a>}
            {college.courses.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{college.courses.map((course) => <li key={course}>{course}</li>)}</ul>}
            {renderFacts(listCollege.structuredFacts ?? [], ['programme', 'admission'], 'Detailed programme requirements and admission routes are not verified yet.')}
            <Link className="mt-3 inline-block text-indigo-700 underline" href={`/predictor?college=${encodeURIComponent(college.slug)}`}>Open admission guidance</Link>
          </section>
          <section id="fees" className="card-enterprise scroll-mt-24 p-4 sm:p-6">
            <h2 className="text-xl font-black text-slate-800">Fees and scholarships</h2>
            {renderFacts(listCollege.structuredFacts ?? [], ['fee', 'scholarship'])}
          </section>
          <section id="recognition" className="card-enterprise scroll-mt-24 p-4 sm:p-6">
            <h2 className="text-xl font-black text-slate-800">Recognition and rankings</h2>
            {college.naacGrade && <p className="mt-3 text-sm">NAAC grade {college.naacGrade}</p>}
            {renderFacts(listCollege.structuredFacts ?? [], ['recognition', 'nirfRanking'], 'Detailed recognition and ranking records are not verified yet.')}
          </section>
          <section id="placements" className="card-enterprise scroll-mt-24 p-4 sm:p-6">
            <h2 className="text-xl font-black text-slate-800">Placements, facilities and contacts</h2>
            {renderFacts(listCollege.structuredFacts ?? [], ['placement', 'facility'], 'Placement outcomes and campus facilities are not verified yet.')}
            {college.topRecruiters.length > 0 && <p className="mt-3 text-sm">Reported recruiters: {college.topRecruiters.join(', ')}</p>}
          </section>
          <section id="historical-cutoffs" className="card-enterprise scroll-mt-24 p-4 sm:p-6">
            <h2 className="text-xl font-black text-slate-800 mb-1">Reviewed historical cutoffs</h2>
            <p className="text-sm text-slate-600 mb-4">Official records are shown with counselling system, rank definition, category, quota, seat pool, round and source. Historical cutoffs are not admission predictions.</p>
            <CutoffTable rows={cutoffs.items} />
            <Link href={`/cutoffs?college=${encodeURIComponent(college.slug)}`} className="mt-4 inline-block font-semibold text-indigo-700 underline">
              {cutoffs.total > cutoffs.items.length ? `Explore all ${cutoffs.total.toLocaleString('en-IN')} reviewed cutoff records for this college` : 'Open the cutoff explorer for this college'}
            </Link>
          </section>
        </div>

        <aside className="space-y-6">
          <section id="official-resources" className="detail-sidebar-card scroll-mt-24">
            <h2 className="font-bold text-base text-slate-800 mb-4">Contacts and official sources</h2>
            {college.website || college.phone || college.email ? (
              <dl className="space-y-3 text-sm">
                {college.website && (
                  <div>
                    <dt className="text-xs text-slate-500">Website</dt>
                    <dd><a href={college.website} target="_blank" rel="noopener noreferrer" className="text-indigo-700 break-all">{college.website}</a></dd>
                  </div>
                )}
                {college.phone && (<div><dt className="text-xs text-slate-500">Phone</dt><dd>{college.phone}</dd></div>)}
                {college.email && (<div><dt className="text-xs text-slate-500">Email</dt><dd className="break-all">{college.email}</dd></div>)}
              </dl>
            ) : contactFacts.length === 0 ? (
              <p className="text-sm text-slate-600">
                We have not verified contact details for this college. Search for its official website, or find it in the{' '}
                <a href="https://aishe.gov.in" target="_blank" rel="noopener noreferrer" className="text-indigo-700">AISHE directory</a>.
              </p>
            ) : null}
            {renderFacts(contactFacts, ['contact'], null)}
            {sourceLinks.length > 0 && <>
              <h3 className="mt-5 text-sm font-semibold">Read on the institution’s site</h3>
              <p className="mt-1 text-xs text-slate-600">Check the campus and admission cycle on the source page. CollegeFind reviews details separately before publishing them here.</p>
              <ul className="mt-2 space-y-2 text-sm">
                {sourceLinks.map(({ url, label }) => <li key={url}><a className="text-indigo-700 underline underline-offset-4" href={url} target="_blank" rel="noopener noreferrer">{label}</a></li>)}
              </ul>
            </>}
          </section>
        </aside>
      </section>

      {similar.length > 0 && (
        <section className="container-main py-6">
          <h2 className="section-heading mb-6">Other {college.type === 'GOVERNMENT' ? 'government' : 'private'} colleges in {college.state}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {similar.map((c) => <CollegeCard key={c.id} college={c as College} />)}
          </div>
        </section>
      )}

      <QuestionsAndAnswers collegeId={college.id} collegeSlug={college.slug} />
    </div>
  );
}

function reviewedDate(value: Date | string | null | undefined) {
  if (!value) return 'Not recorded';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
}

function renderFacts(facts: NonNullable<College['structuredFacts']>, kinds: string[], unavailable: string | null = 'Not verified yet. Check the institution for current details.') {
  const selected = facts.filter(({ value }) => kinds.includes(value.kind));
  if (!selected.length) return unavailable && <p className="mt-3 text-sm text-slate-600">{unavailable}</p>;
  return <ul className="mt-4 grid gap-4 sm:grid-cols-2">
    {selected.map(({ key, value, academicYear, validUntil, source }) => (
      <li key={key} className="min-w-0 rounded-lg border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-900">{structuredLabels[value.kind]}{academicYear !== null ? ` · ${academicYear}` : ''}</h3>
        <dl className="mt-2 space-y-1 break-words text-sm text-slate-700">
          {Object.entries(value).filter(([label]) => label !== 'kind').map(([label, item]) => (
            <div key={label}>
              <dt className="inline font-medium capitalize">{label.replace(/([A-Z])/g, ' $1')}: </dt>
              <dd className="inline">{label === 'amountInr' && typeof item === 'number' ? formatINR(item)
                : label === 'durationMonths' && typeof item === 'number' ? (item % 12 === 0 ? `${item / 12} ${item === 12 ? 'year' : 'years'}` : `${item} months`)
                : label === 'url' || label === 'applicationUrl' ? <a href={String(item)} target="_blank" rel="noopener noreferrer" className="text-indigo-700 underline">Open official link</a>
                : String(item)}</dd>
            </div>
          ))}
          {validUntil && <div><dt className="inline font-medium">Valid through: </dt><dd className="inline">{reviewedDate(validUntil)}</dd></div>}
        </dl>
        <p className="mt-3 border-t pt-2 text-xs leading-5 text-slate-600">
          Source: <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-700 underline">{source.publisher}</a><br />
          Published: {reviewedDate(source.publishedAt)} · Collected: {reviewedDate(source.retrievedAt)} · Reviewed: {reviewedDate(source.reviewedAt)}
        </p>
      </li>
    ))}
  </ul>;
}

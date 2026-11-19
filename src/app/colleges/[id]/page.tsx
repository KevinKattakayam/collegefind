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
  const isDemo = college.dataStatus === 'DEMO';
  const listCollege: College = { ...college };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollegeOrUniversity',
    name: college.name,
    url: `${SITE_URL}/colleges/${college.slug}`,
    address: { '@type': 'PostalAddress', addressLocality: college.city, addressRegion: college.state, addressCountry: 'IN' },
    ...(college.website ? { sameAs: [college.website] } : {}),
  };

  const metrics = [
    { label: 'Annual fees', value: formatINR(college.annualFees) },
    { label: 'Placement rate', value: formatPct(college.placementPct) },
    { label: 'Average package', value: formatLPA(college.avgPackage) },
    { label: 'Highest package', value: formatLPA(college.highestPackage) },
    { label: 'Students', value: formatCount(college.totalStudents) },
    { label: 'Established', value: college.establishedYear ? String(college.establishedYear) : 'Not available' },
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
          {listCollege.admissions && <p><a href={listCollege.admissions} target="_blank" rel="noopener noreferrer">Official admissions information</a></p>}
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
          <section className="card-enterprise p-6">
            <h2 className="text-xl font-black text-slate-800">Programmes and admissions</h2>
            {renderFacts(listCollege.structuredFacts ?? [], ['programme', 'admission'])}
          </section>
          <section className="card-enterprise p-6">
            <h2 className="text-xl font-black text-slate-800">Fees and scholarships</h2>
            {renderFacts(listCollege.structuredFacts ?? [], ['fee', 'scholarship'])}
          </section>
          <section className="card-enterprise p-6">
            <h2 className="text-xl font-black text-slate-800">Recognition and rankings</h2>
            {renderFacts(listCollege.structuredFacts ?? [], ['recognition', 'nirfRanking'])}
          </section>
          <section className="card-enterprise p-6">
            <h2 className="text-xl font-black text-slate-800">Placements, facilities and contacts</h2>
            {renderFacts(listCollege.structuredFacts ?? [], ['placement', 'facility', 'contact'])}
          </section>
          <div className="card-enterprise p-6">
            <h2 className="text-xl font-black text-slate-800 mb-1">Key numbers</h2>
            {isDemo ? (
              <p role="note" className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                These are <strong>demo values</strong> entered for testing, not figures from the college. Check the
                college&rsquo;s official website and NIRF data before relying on any of them.
              </p>
            ) : (
              <p className="text-sm text-slate-600 mb-4">{college.metricsYear ? `Figures for ${college.metricsYear}.` : 'Year not recorded.'}</p>
            )}
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {metrics.map((m) => (
                <div key={m.label} className="bg-slate-50 rounded-xl p-3">
                  <dt className="text-xs text-slate-600">{m.label}{isDemo ? ' (demo)' : ''}</dt>
                  <dd className="font-bold text-slate-900">{m.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {college.about && (
            <div className="card-enterprise p-6">
              <h2 className="text-xl font-black text-slate-800 mb-3">About</h2>
              <p className="text-slate-700 leading-relaxed">{college.about}</p>
            </div>
          )}

          {college.courses.length > 0 && (
            <div className="card-enterprise p-6">
              <h2 className="text-xl font-black text-slate-800 mb-3">Courses listed</h2>
              <ul className="flex flex-wrap gap-2">
                {college.courses.map((c) => (
                  <li key={c} className="bg-slate-100 text-slate-800 px-3 py-1.5 rounded-lg text-sm font-medium">{c}</li>
                ))}
              </ul>
              <p className="text-xs text-slate-500 mt-3">Course-wise fees and durations are not yet available. Confirm on the college website.</p>
            </div>
          )}

          {college.topRecruiters.length > 0 && (
            <div className="card-enterprise p-6">
              <h2 className="text-xl font-black text-slate-800 mb-3">Recruiters{isDemo ? ' (demo list)' : ''}</h2>
              <p className="text-slate-700">{college.topRecruiters.join(', ')}</p>
            </div>
          )}

          <div className="card-enterprise p-6">
            <h2 className="text-xl font-black text-slate-800 mb-1">Reviewed historical cutoffs</h2>
            <p className="text-sm text-slate-600 mb-4">Official records are shown with counselling system, rank definition, category, quota, seat pool, round and source. Historical cutoffs are not admission predictions.</p>
            <CutoffTable rows={cutoffs.items} />
            <Link href={`/cutoffs?college=${encodeURIComponent(college.slug)}`} className="mt-4 inline-block font-semibold text-indigo-700 underline">
              {cutoffs.total > cutoffs.items.length ? `Explore all ${cutoffs.total.toLocaleString('en-IN')} reviewed cutoff records for this college` : 'Open the cutoff explorer for this college'}
            </Link>
          </div>

          <div className="card-enterprise p-6">
            <h2 className="text-xl font-black text-slate-800 mb-1">Student reviews</h2>
            <p className="text-slate-600 text-sm">
              We only publish reviews from verified students after moderation, and none have been published for this college yet.
            </p>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="detail-sidebar-card lg:sticky lg:top-24">
            <h2 className="font-bold text-base text-slate-800 mb-4">Contact</h2>
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
            ) : (
              <p className="text-sm text-slate-600">
                We have not verified contact details for this college. Search for its official website, or find it in the{' '}
                <a href="https://aishe.gov.in" target="_blank" rel="noopener noreferrer" className="text-indigo-700">AISHE directory</a>.
              </p>
            )}
            <p className="text-xs text-slate-500 mt-4">
              Last updated {new Date(college.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
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

function renderFacts(facts: NonNullable<College['structuredFacts']>, kinds: string[]) {
  const selected = facts.filter(({ value }) => kinds.includes(value.kind));
  if (!selected.length) return <p className="mt-3 text-sm text-slate-600">Not yet available as reviewed, source-backed information. Check the institution or relevant authority for current details.</p>;
  return <ul className="mt-4 grid gap-4 sm:grid-cols-2">
    {selected.map(({ key, value, academicYear, validUntil, source }) => (
      <li key={key} className="min-w-0 rounded-lg border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-900">{structuredLabels[value.kind]}{academicYear !== null ? ` · ${academicYear}` : ''}</h3>
        <dl className="mt-2 space-y-1 break-words text-sm text-slate-700">
          {Object.entries(value).filter(([label]) => label !== 'kind').map(([label, item]) => (
            <div key={label}>
              <dt className="inline font-medium capitalize">{label.replace(/([A-Z])/g, ' $1')}: </dt>
              <dd className="inline">{label === 'amountInr' && typeof item === 'number' ? formatINR(item)
                : label === 'durationMonths' && typeof item === 'number' ? `${item} months`
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

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import Breadcrumb from '@/components/Breadcrumb';
import CollegeCard from '@/components/CollegeCard';
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
import { logger, errorFields } from '@/lib/logger';
import { eligibleSourceReported, suppressSourceReported, type SourceReportedFact } from '@/server/source-reported';

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

async function getSourceReported(college: College) {
  const facts = eligibleSourceReported(college);
  if (!facts.length) return [];
  const rows = await prisma.fieldEvidence.findMany({
    where: { collegeId: college.id, isFixture: false, field: { in: [...new Set(facts.flatMap(({ value }) => value.kind === 'programme' ? ['structured.programme', 'courses'] : [`structured.${value.kind}`]))] } },
    select: {
      id: true, field: true, isFixture: true, value: true, academicYear: true, validFrom: true, validUntil: true, supersedesId: true,
      decisions: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { status: true } },
    },
  });
  return suppressSourceReported(facts, rows, college.structuredFacts ?? []);
}

export default async function CollegeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const key = (await params).id;
  const college = await getCollege(key);
  if (!college) notFound();
  // Old links used the database id; send them to the canonical slug URL.
  if (key !== college.slug) permanentRedirect(`/colleges/${college.slug}`);

  // Optional queries must not make the institution identity and source links unavailable.
  const listCollege: College = { ...college };
  const [cutoffs, similar, sourceReported] = await Promise.all([
    getCutoffs(college.slug).catch((error: unknown) => {
      logger.warn('college_profile_cutoffs_unavailable', errorFields(error));
      return null;
    }),
    getSimilar(college).catch((error: unknown) => {
      logger.warn('college_profile_related_unavailable', errorFields(error));
      return [];
    }),
    getSourceReported(listCollege).catch((error: unknown) => {
      logger.warn('college_profile_source_reported_unavailable', errorFields(error));
      return [];
    }),
  ]);
  const sourceLinks = collegeSourceLinks(college.slug);
  const sectionSource = (categories: string[]) => {
    const index = sourceLinks.findIndex(({ category }) => categories.includes(category));
    if (index === -1) return null;
    return <a className="mt-3 inline-block text-sm text-indigo-700 underline" href={`#official-source-${index}`}>
      Source guide: {sourceLinks[index].label}
    </a>;
  };
  const website = college.website ?? sourceLinks.find(({ category }) => category === 'website')?.url;
  const hasReviewedSummary = Object.values(listCollege.fieldEvidence ?? {}).some(({ status }) => status === 'AVAILABLE');
  const hasReviewedDetails = hasReviewedSummary || Boolean(listCollege.structuredFacts?.length);
  const reviewedFields = Object.entries(listCollege.fieldEvidence ?? {}).filter(([, evidence]) =>
    ['AVAILABLE', 'CONFLICT', 'OUTDATED'].includes(evidence.status));
  const contactFacts = (listCollege.structuredFacts ?? []).filter(({ value }) => value.kind === 'contact');
  const hasSourceReportedProgrammeDetails = sourceReported.some(({ value }) => value.kind === 'programme' || value.kind === 'admission');
  const hasSourceReportedFacilities = sourceReported.some(({ value }) => value.kind === 'facility');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollegeOrUniversity',
    name: college.name,
    url: `${SITE_URL}/colleges/${college.slug}`,
    address: { '@type': 'PostalAddress', addressLocality: college.city, addressRegion: college.state, addressCountry: 'IN' },
    ...(college.website ? { sameAs: [college.website] } : {}),
  };

  const metrics = [
    { label: 'Placement rate', value: college.placementPct == null ? null : formatPct(college.placementPct) },
    { label: 'Average package', value: college.avgPackage == null ? null : formatLPA(college.avgPackage) },
    { label: 'Highest package', value: college.highestPackage == null ? null : formatLPA(college.highestPackage) },
    { label: 'Students', value: college.totalStudents == null ? null : formatCount(college.totalStudents) },
  ].filter(({ value }) => value !== null);
  const sections = [
    ['overview', 'Overview'], ['programmes-and-admissions', 'Programmes & admissions'],
    ['fees', 'Fees & aid'], ['recognition', 'Recognition'], ['placements', 'Placements'], ['facilities', 'Hostels & facilities'],
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
            <span className="badge-blue">Catalogue identity</span>
            <span className="text-xs text-slate-700">{hasReviewedDetails ? 'Reviewed facts are marked with sources' : sourceReported.length ? 'Institution-reported details available below' : 'Detailed facts awaiting verification'}</span>
          </div>
          <CollegeActions college={listCollege} />
          <Link className="mt-3 inline-block text-indigo-700 underline" href={`/collegefit?location=${encodeURIComponent(college.state)}`}>Explore CollegeFit in {college.state}</Link>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {website &&
              <a className="text-indigo-700 underline" href={website} target="_blank" rel="noopener noreferrer">Official institution website</a>}
            <a className="text-indigo-700 underline" href="#official-resources">Find programmes, admissions and contact sources</a>
          </div>
          <nav aria-label="On this college profile" className="mt-5">
            <ul className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
              {sections.map(([id, label]) => <li key={id}><a className="text-indigo-700 underline underline-offset-4" href={`#${id}`}>{label}</a></li>)}
            </ul>
          </nav>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-semibold">Sources and verification</summary>
            <p className="mt-2">Fields are reviewed individually. Missing, conflicting or outdated values are withheld.</p>
            {sourceReported.length > 0 && <p className="mt-2">Source-reported details come from a named institution page. Use the linked source to check the applicable intake.</p>}
            {reviewedFields.length === 0 && <p className="mt-2">No reviewed profile summary fields are available yet. Source details for reviewed programme records appear with each record.</p>}
            <ul className="mt-2 space-y-2">
              {reviewedFields.map(([field, evidence]) => (
                <li key={field}>
                  <span className="font-medium">{({ annualFees: 'Annual fees', naacGrade: 'NAAC grade', establishedYear: 'Established', totalStudents: 'Students', topRecruiters: 'Recruiters', description: 'Description', about: 'About', admissions: 'Admissions link', website: 'Website', phone: 'Phone', email: 'Email', courses: 'Courses' } as Record<string,string>)[field] ?? field}</span>
                  {': '}{evidence.status === 'AVAILABLE' ? 'Reviewed' : evidence.status === 'CONFLICT' ? 'Conflicting sources' : evidence.status === 'OUTDATED' ? 'Outdated' : 'Not yet verified'}
                  {(evidence.sources ?? []).map((source, index) => <p key={index} className="mt-1 break-words text-xs text-slate-600">
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-indigo-700 underline">{source.publisher}</a>
                    {' · Published '}{reviewedDate(source.publishedAt)}{' · Reviewed '}{reviewedDate(source.reviewedAt)}
                  </p>)}
                </li>
              ))}
            </ul>
          </details>
        </div>
      </section>

      <section className="container-main py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <aside className="min-w-0 space-y-6 lg:col-start-3 lg:row-start-1">
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
            ) : null}
            {renderFacts(contactFacts, ['contact'], null)}
            {renderSourceReported(sourceReported, 'contact')}
            {sourceLinks.length > 0 ? <>
              <h3 className="mt-4 text-sm font-semibold">Official pages and documents</h3>
              <p className="mt-1 text-xs text-slate-600">Use the linked institution pages to check your programme, campus and intake. Each link is checked separately from the facts on it.</p>
              <ul className="mt-3 divide-y divide-slate-200 text-sm">
                {sourceLinks.map(({ url, label, scope, checkedAt }, index) => <li key={url} id={`official-source-${index}`} className="scroll-mt-24 py-2">
                  <a className="break-words text-indigo-700 underline underline-offset-4" href={url} target="_blank" rel="noopener noreferrer">{label}</a>
                  <p className="mt-1 text-xs text-slate-600">{scope} · Link checked <time dateTime={checkedAt}>{reviewedDate(checkedAt)}</time></p>
                </li>)}
              </ul>
            </> : !website && !listCollege.admissions ? <p className="text-sm text-slate-600">
              An institution-specific source link is not available yet. Look up the institution by name and state in the{' '}
              <a href="https://dashboard.aishe.gov.in/" target="_blank" rel="noopener noreferrer" className="text-indigo-700 underline">AISHE directory</a>.
            </p> : null}
            {!college.phone && !college.email && contactFacts.length === 0 &&
              <p className="mt-3 text-xs text-slate-600">{sourceReported.some(({ value }) => value.kind === 'contact')
                ? 'The contact listed above is source-reported and not independently verified; other contact details may be unavailable.'
                : 'Phone and email details are not verified yet.'}</p>}
          </section>
        </aside>
        <div className="min-w-0 lg:col-span-2 space-y-8 lg:col-start-1 lg:row-start-1">
          <section id="overview" className="card-enterprise scroll-mt-24 p-4 sm:p-6">
            <h2 className="text-xl font-black text-slate-800">Overview</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="font-medium">Catalogue location</dt><dd>{college.city}, {college.state}</dd></div>
              <div><dt className="font-medium">Catalogue name</dt><dd>{college.shortName}</dd></div>
              <div><dt className="font-medium">Institution type</dt><dd>{college.type === 'GOVERNMENT' ? 'Government' : 'Private'}</dd></div>
            </dl>
            <p className="mt-4 text-sm leading-relaxed text-slate-700">{college.about ?? college.description ?? 'For campus-specific information, check the institution’s pages or contact its admissions office.'}</p>
            {metrics.length > 0 && <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              {metrics.map(({ label, value }) => <div key={label} className="rounded-lg bg-slate-50 p-3">
                <dt className="text-sm">{label}</dt><dd className="font-semibold">{value}</dd>
              </div>)}
            </dl>}
          </section>
          <section id="programmes-and-admissions" className="card-enterprise scroll-mt-24 p-4 sm:p-6">
            <h2 className="text-xl font-black text-slate-800">Programmes and admissions</h2>
            {listCollege.admissions && <a href={listCollege.admissions} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-indigo-700 underline">Official admissions information</a>}
            {college.courses.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{college.courses.map((course) => <li key={course}>{course}</li>)}</ul>}
            {renderFacts(listCollege.structuredFacts ?? [], ['programme', 'admission'], hasSourceReportedProgrammeDetails
              ? 'Official pages report the details below; CollegeFind has not independently verified them.'
              : college.courses.length ? 'Programme eligibility and admission routes are not verified yet.' : 'Programme details and admission routes are not verified yet.')}
            {renderSourceReported(sourceReported, 'programme')}
            {renderSourceReported(sourceReported, 'admission')}
            {sectionSource(['admissions', 'programmes'])}
            <Link className="mt-3 block text-indigo-700 underline" href={`/predictor?college=${encodeURIComponent(college.slug)}`}>Open admission guidance</Link>
          </section>
          <section id="fees" className="card-enterprise scroll-mt-24 p-4 sm:p-6">
            <h2 className="text-xl font-black text-slate-800">Fees and scholarships</h2>
            {college.annualFees != null && <div className="mt-3 text-sm">
              <p><strong>Annual tuition</strong>{college.metricsYear ? ` · ${college.metricsYear}` : ''}: {formatINR(college.annualFees)}</p>
              {(listCollege.fieldEvidence?.annualFees?.sources ?? []).map(({ url, publisher }) => <a
                className="mr-3 text-indigo-700 underline" key={url} href={url} target="_blank" rel="noopener noreferrer">{publisher}</a>)}
            </div>}
            {renderFacts(listCollege.structuredFacts ?? [], ['fee', 'scholarship'],
              college.annualFees != null ? 'Programme-level fees and scholarship details are not verified yet.' : 'Not verified yet. Ask for the fee schedule and aid rules for your intake.')}
            {sectionSource(['fees', 'scholarships'])}
          </section>
          <section id="recognition" className="card-enterprise scroll-mt-24 p-4 sm:p-6">
            <h2 className="text-xl font-black text-slate-800">Recognition and rankings</h2>
            {college.naacGrade && <p className="mt-3 text-sm">NAAC grade {college.naacGrade}</p>}
            {renderFacts(listCollege.structuredFacts ?? [], ['recognition', 'nirfRanking'], 'Detailed recognition and ranking records are not verified yet.')}
            {sectionSource(['recognition', 'accreditation'])}
          </section>
          <section id="placements" className="card-enterprise scroll-mt-24 p-4 sm:p-6">
            <h2 className="text-xl font-black text-slate-800">Placements and career outcomes</h2>
            {renderFacts(listCollege.structuredFacts ?? [], ['placement'], 'Placement figures are not verified yet. Look for a report that specifies the graduating class and reporting year.')}
            {sectionSource(['placements'])}
            {college.topRecruiters.length > 0 && <p className="mt-3 text-sm">Reported recruiters: {college.topRecruiters.join(', ')}</p>}
          </section>
          <section id="facilities" className="card-enterprise scroll-mt-24 p-4 sm:p-6">
            <h2 className="text-xl font-black text-slate-800">Hostels and facilities</h2>
            {renderFacts(listCollege.structuredFacts ?? [], ['facility'], hasSourceReportedFacilities
              ? 'Official pages report the facilities below; CollegeFind has not independently verified them. Hostel availability may need separate confirmation.'
              : 'Hostel availability and campus facilities are not verified yet. Check with the institution for your campus.')}
            {renderSourceReported(sourceReported, 'facility')}
            {sectionSource(['facilities'])}
          </section>
          <section id="historical-cutoffs" className="card-enterprise scroll-mt-24 p-4 sm:p-6">
            <h2 className="text-xl font-black text-slate-800 mb-1">Reviewed historical cutoffs</h2>
            <p className="text-sm text-slate-600 mb-4">Official records are shown with counselling system, rank definition, category, quota, seat pool, round and source. Historical cutoffs are not admission predictions.</p>
            {cutoffs ? <CutoffTable rows={cutoffs.items} /> : <p className="text-sm text-slate-600">Cutoff history could not load. You can retry in the cutoff explorer.</p>}
            <Link href={`/cutoffs?college=${encodeURIComponent(college.slug)}`} className="mt-4 inline-block font-semibold text-indigo-700 underline">
              {cutoffs && cutoffs.total > cutoffs.items.length ? `Explore all ${cutoffs.total.toLocaleString('en-IN')} reviewed cutoff records for this college` : 'Open the cutoff explorer for this college'}
            </Link>
          </section>
        </div>

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

const factFieldLabels: Record<string, string> = {
  amountInr: 'Amount (INR)', durationMonths: 'Duration', feeType: 'Fee type',
  applicationUrl: 'Application page', url: 'Official page', denominator: 'Cohort size',
};

const factFieldValues: Record<string, Record<string, string>> = {
  level: { UG: 'Undergraduate', PG: 'Postgraduate', DOCTORAL: 'Doctoral', DIPLOMA: 'Diploma' },
  period: { SEMESTER: 'Per semester', YEAR: 'Per year', MONTH: 'Per month', ONE_TIME: 'One-time payment' },
  feeType: { TUITION: 'Tuition', HOSTEL: 'Hostel or residence' },
  metric: { MEDIAN: 'Median', MEAN: 'Mean', HIGHEST: 'Highest', PLACED_COUNT: 'Students placed' },
};

function renderFacts(facts: NonNullable<College['structuredFacts']>, kinds: string[], unavailable: string | null = 'Not verified yet. Check the institution for current details.') {
  const selected = facts.filter(({ value }) => kinds.includes(value.kind));
  if (!selected.length) return unavailable && <p className="mt-3 text-sm text-slate-600">{unavailable}</p>;
  return <ul className="mt-4 grid gap-4 sm:grid-cols-2">
    {selected.map(({ key, value, academicYear, validUntil, source }) => (
      <li key={key} data-evidence-status="VERIFIED" className="min-w-0 rounded-lg border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-900">{structuredLabels[value.kind]}{academicYear !== null ? ` · ${academicYear}` : ''}</h3>
        <p className="mt-1 text-xs font-semibold text-emerald-800">Independently reviewed</p>
        <dl className="mt-2 space-y-1 break-words text-sm text-slate-700">
          {Object.entries(value).filter(([label]) => label !== 'kind').map(([label, item]) => (
            <div key={label}>
              <dt className="inline font-medium capitalize">{factFieldLabels[label] ?? label.replace(/([A-Z])/g, ' $1')}: </dt>
              <dd className="inline">{label === 'amountInr' && typeof item === 'number' ? formatINR(item)
                : label === 'durationMonths' && typeof item === 'number' ? (item % 12 === 0 ? `${item / 12} ${item === 12 ? 'year' : 'years'}` : `${item} months`)
                : label === 'url' || label === 'applicationUrl' ? <a href={String(item)} target="_blank" rel="noopener noreferrer" className="text-indigo-700 underline">Open official link</a>
                : (factFieldValues[label]?.[String(item)] ?? String(item))}</dd>
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

function renderSourceReported(facts: SourceReportedFact[], kind: SourceReportedFact['value']['kind']) {
  const selected = facts.filter(({ value }) => value.kind === kind);
  if (!selected.length) return null;
  return <ul className="mt-4 grid gap-4 sm:grid-cols-2" aria-label={`Institution-reported ${structuredLabels[kind].toLowerCase()}`}>
    {selected.map(({ ref, value, campus, publisher, url, evidenceLocation, sourceTitle, collectedAt, publicationDate, checkedAt, academicYear, validFrom, validUntil, historical, publisherPeriod, scopeVerification }) => (
      <li key={ref} data-evidence-status="OFFICIAL_SOURCE_REPORTED" className="min-w-0 space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-slate-800">
        <p className="text-xs font-semibold text-amber-950">Source-reported; not independently verified</p>
        <h3 className="break-words font-semibold">{value.kind === 'programme' || value.kind === 'admission' ? value.programme : value.kind === 'contact' ? value.office : value.facility}</h3>
        <p>{campus}</p>
        {value.kind === 'programme' ? <p>{factFieldValues.level[value.level]}
          {value.durationMonths && ` · ${value.durationMonths % 12 === 0 ? `${value.durationMonths / 12} ${value.durationMonths === 12 ? 'year' : 'years'}` : `${value.durationMonths} months`}`}
          {value.durationSemesters && ` · ${value.durationSemesters} semesters`}
        </p> : value.kind === 'facility' ? <p>{value.description}</p> : value.kind === 'contact' ? (
          <p>{value.channel === 'EMAIL' ? 'Email' : value.channel === 'PHONE' ? 'Phone' : 'Address'} · {value.contact}</p>
        ) : (
          <div className="space-y-1">
            <p>{value.route}</p>
            {value.exam && <p>Exam · {value.exam}</p>}
            {value.counselling && <p>Counselling · {value.counselling}</p>}
            <p>Applicant scope · {value.category}</p>
          </div>
        )}
        <div className="space-y-1 break-words border-t border-amber-200 pt-2 text-xs leading-5">
          <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-800 underline">{publisher} · {sourceTitle}</a>
          <p>Evidence location: {evidenceLocation}</p>
          {scopeVerification && <p>Campus scope cross-check: <a href={scopeVerification.url} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-800 underline">{scopeVerification.title}</a> · {scopeVerification.evidenceLocation}</p>}
          <p>Collected <time dateTime={collectedAt}>{reviewedDate(collectedAt)}</time> · Checked <time dateTime={checkedAt}>{reviewedDate(checkedAt)}</time></p>
          {publicationDate && <p>Published {reviewedDate(publicationDate)}</p>}
          {(historical || academicYear !== null) && <p>{historical
            ? (kind === 'admission' ? 'Historical admission cycle' : kind === 'programme' ? 'Historical programme listing' : 'Historical source information')
            : 'Publisher’s period'} · {publisherPeriod ?? academicYear ?? 'publisher-dated source context'}. Check the source for current availability.</p>}
          {(validFrom || validUntil) && <p>Applicable period{validFrom ? ` from ${reviewedDate(validFrom)}` : ''}{validUntil ? ` through ${reviewedDate(validUntil)}` : ''}</p>}
          {kind === 'programme' && academicYear === null && !validFrom && !validUntil && <p>The institution does not specify an intake for this detail.</p>}
        </div>
      </li>
    ))}
  </ul>;
}

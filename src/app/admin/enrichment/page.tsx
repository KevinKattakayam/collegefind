import { evidenceQueue, queueQuery } from '@/server/evidence-queue';
import { evidenceReviewHold } from '@/server/review-holds';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import ReviewDecision from './review-decision';
import SourceUseAssessment from './source-use-assessment';
import { sourceRequiresExplicitUseAssessment } from '@/server/source-use-review';
import reviewBatch from '../../../../data/pilot/first-human-review-batch.json';

export const dynamic = 'force-dynamic';

type Search = Record<string, string | string[] | undefined>;
const firstInspection = [
  ['cmwm4060u0003lftv8hj4ur0o', 'IIT Roorkee first-year tuition'],
  ['cmwm406100005lftvhno5hr3x', 'IIT Roorkee SC/ST/PwD tuition waiver'],
  ['cmwm4trd200073otvpjb30qsw', 'CMC Vellore annual MBBS tuition'],
] as const;
const prioritySourceChecks: Record<string, string> = {
  cmwlqtg7i001qgvtvfvd0j4ev: 'The linked All India admissions page describes the closed 2026 cycle. Inspect the school-location and board scope in the Eligibility section before deciding whether a historical claim is appropriate.',
  cmwlpjrzh001syttvn05nz1d4: 'Keep on hold pending confirmation of the final applicable fee. The All India fee table describes tuition per semester and says the proposal is subject to appellate consideration and revision.',
  cmwm4060u0003lftv8hj4ur0o: 'Inspect the U.G. I Year fee schedule, page 1. The Autumn and Spring tuition row applies to the named categories. The amount excludes other semester charges.',
  cmwm406100005lftvhno5hr3x: 'Inspect the U.G. I Year fee schedule, page 1. The SC/ST/PwD row waives the tuition component in both semesters. Other charges still apply.',
  cmwm3rj75000bhxtvbr105oe7: 'Keep on hold pending direct inspection of the complete report. Verify the B.Tech total row on printed page 11, including both the number placed and the eligible cohort.',
  cmwm4trd200073otvpjb30qsw: 'Inspect the MBBS row in Annexure I of the revised 2026–27 prospectus, printed page 177. The amount covers annual tuition only.',
};
const date = (value: Date | null | undefined) => value ? value.toISOString().slice(0, 10) : 'Not recorded';
function pageLink(page: number, filters: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== '') params.set(key, String(value));
  return `/admin/enrichment?${params.toString()}`;
}

export default async function Enrichment({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await getSessionUser();
  if (!user) redirect('/login?callbackUrl=%2Fadmin%2Fenrichment');
  if (user.role !== 'ADMIN') return <main className="container-page py-8"><h1>Access denied</h1><p>An administrator account is required to review evidence.</p><Link href="/">Return home</Link></main>;
  const raw = Object.fromEntries(Object.entries(await searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  const parsed = queueQuery.safeParse(raw);
  if (!parsed.success) return <main className="container-page py-8"><h1>Invalid queue filters</h1><p>Choose a valid page, year and filter value.</p></main>;

  const [result, packetRows] = await Promise.all([
    evidenceQueue(prisma, parsed.data),
    prisma.fieldEvidence.findMany({ where: { id: { in: reviewBatch.claimIds } }, select: { id: true, decisions: { take: 1, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { status: true } } } }),
  ]);
  const packetStates = new Map<string, string>(packetRows.map((row) => [
    row.id,
    evidenceReviewHold(row.id) ? 'PENDING' : row.decisions[0]?.status ?? 'UNREVIEWED',
  ]));
  const priorityId = firstInspection.find(([id]) => packetStates.get(id) === 'UNREVIEWED' && id !== parsed.data.q)?.[0];
  const next = reviewBatch.claims.find(({ evidenceId }) => evidenceId === priorityId) ??
    reviewBatch.claims.find(({ evidenceId }) => packetStates.get(evidenceId) === 'UNREVIEWED' && evidenceId !== parsed.data.q);
  const { page, pageSize, status, q, batch, college, campus, program, source, field, factType, historical, sourceUse, academicYear, freshness, total, items, placementCohorts } = result;
  const filters = { status, q, batch, college, campus, program, source, field, factType, historical, sourceUse, academicYear, freshness };
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const runs = await prisma.importRun.findMany({ orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], take: 10 });

  return <main className="container-page min-w-0 overflow-x-hidden py-8">
    <h1>Enrichment review</h1>
    <p>Retrieval is not verification. Only an authorized reviewer decision can publish evidence. Fixture claims are never publishable.</p>
    {firstInspection.some(([id]) => packetStates.has(id)) && <nav aria-label="Priority tuition review" className="my-4">
      <h2>Inspect the tuition evidence first</h2>
      <ul className="list-disc space-y-1 pl-5">
        {firstInspection.filter(([id]) => packetStates.has(id)).map(([id, label]) => <li key={id}>
          <Link href={pageLink(1, { status: 'ALL', q: id })}>{label}</Link>
          {' · '}{packetStates.get(id) === 'UNREVIEWED' ? 'Awaiting review' : packetStates.get(id) === 'PENDING' ? 'Held' : packetStates.get(id)}
        </li>)}
      </ul>
    </nav>}
    {next && <p className="mt-4"><Link href={pageLink(1, { status: 'ALL', q: next.evidenceId })}>Next unreviewed packet claim: {next.institutionName} · {next.field}</Link></p>}
    <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" action="/admin/enrichment">
      <label>Research batch<select name="batch" defaultValue={batch} className="block w-full"><option value="ALL">All batches</option><option value="060">Batch 060 · supplied PDFs</option></select></label>
      <label>Review state<select name="status" defaultValue={status} className="block w-full">
        {['STAGED', 'ALL', 'HELD', 'CONFLICTED', 'EXPIRED', 'NOT_YET_VALID', 'VERIFIED', 'REJECTED', 'DEMO'].map((value) => <option key={value}>{value}</option>)}
      </select></label>
      <label>Page size<select name="pageSize" defaultValue={String(pageSize)} className="block w-full">{[25, 50, 100].map((size) => <option key={size}>{size}</option>)}</select></label>
      <label>Search college, claim ID, field or programme<input name="q" defaultValue={q} className="block w-full" /></label>
      <label>College<input name="college" defaultValue={college} className="block w-full" /></label>
      <label>Campus, city or state<input name="campus" defaultValue={campus} className="block w-full" /></label>
      <label>Programme or cohort<input name="program" defaultValue={program} className="block w-full" /></label>
      <label>Source / publisher / domain<input name="source" defaultValue={source} className="block w-full" /></label>
      <label>Field<input name="field" defaultValue={field} className="block w-full" /></label>
      <label>Fact type<select name="factType" defaultValue={factType} className="block w-full">{['ALL', 'programme', 'admission', 'seatIntake', 'fee', 'placement'].map((value) => <option key={value} value={value}>{value === 'ALL' ? 'All fact types' : value}</option>)}</select></label>
      <label>Academic year<input name="academicYear" inputMode="numeric" defaultValue={academicYear ?? ''} className="block w-full" /></label>
      <label>Evidence freshness<select name="freshness" defaultValue={freshness} className="block w-full">
        {['ALL', 'CURRENT', 'UNDATED', 'SOURCE_UNDATED', 'OLDER', 'EXPIRED', 'FUTURE'].map((value) => <option key={value}>{value}</option>)}
      </select></label>
      <label>Time scope<select name="historical" defaultValue={historical} className="block w-full"><option value="ALL">All time scopes</option><option value="HISTORICAL">Historical</option><option value="CURRENT">Not marked historical</option></select></label>
      <label>Source-use clearance<select name="sourceUse" defaultValue={sourceUse} className="block w-full">{['ALL', 'UNASSESSED', 'CLEARED', 'RESTRICTED', 'UNRESOLVED'].map((value) => <option key={value}>{value}</option>)}</select></label>
      <div className="flex items-end gap-2"><button type="submit">Apply filters</button><a href="/admin/enrichment">Clear</a></div>
    </form>
    <details className="my-5 break-words border p-4" open={!/^c[a-z0-9]{24}$/i.test(q)}>
      <summary className="cursor-pointer font-semibold">First owner review batch · {reviewBatch.claims.length} claims · staged for inspection, not approval</summary>
      <p className="my-2">Review each source and institution/campus independently. These entries are a prioritized handoff; opening the source or passing automated checks is not approval.</p>
      <ol className="space-y-3">
        {reviewBatch.claims.map((item) => <li key={item.evidenceId} className="border-t pt-3">
          <p><strong>{item.order}. {item.institutionName}</strong> ({item.institutionSlug}) · <code>{item.evidenceId}</code> · {packetStates.get(item.evidenceId) === 'PENDING' ? 'Held' : packetStates.get(item.evidenceId) ?? 'Unavailable'}</p>
          <p><strong>Field:</strong> {item.field} · <strong>Academic year:</strong> {item.academicYear ?? 'Not recorded'}{item.programScope ? ` · ${item.programScope}` : ''}</p>
          <p><strong>Proposed value:</strong> <code className="whitespace-pre-wrap">{JSON.stringify(item.value)}</code>{item.unit ? ` ${item.unit}` : ''}</p>
          <p><strong>College location:</strong> {item.collegeCity}, {item.collegeState} · <strong>Campus check:</strong> {item.campusReviewQuestion}</p>
          <p><strong>Source:</strong> {item.sourcePublisher} · <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Open official source</a> · <strong>Published:</strong> {item.sourcePublishedAt ? date(new Date(item.sourcePublishedAt)) : 'Not recorded'} · <strong>Retrieved:</strong> {date(new Date(item.sourceRetrievedAt))}</p>
          <p><strong>Evidence location:</strong> {item.evidenceLocation ?? 'Not recorded'}</p>
          {prioritySourceChecks[item.evidenceId] && <p role="note"><strong>Priority source check:</strong> {prioritySourceChecks[item.evidenceId]}</p>}
          <details><summary>Source access, reuse and collection notes</summary><p role="note"><strong>Source-use review:</strong> {item.sourceUseWarning}</p><p>{item.sourceNotes}</p></details>
          {item.freshnessWarning && <p role="note"><strong>Freshness review:</strong> {item.freshnessWarning}</p>}
          {item.conflictWarning && <p role="alert"><strong>Conflict warning:</strong> {item.conflictWarning} {item.conflictPeerIds.join(', ')}</p>}
          <p><strong>Reviewer question:</strong> {item.recommendedQuestion}</p>
          <Link href={pageLink(1, { status: 'ALL', q: item.evidenceId })}>Open this claim in the queue</Link>
        </li>)}
      </ol>
    </details>
    <nav aria-label="Review queue pages" className="my-5 flex items-center gap-4">
      {page > 1 ? <a href={pageLink(page - 1, filters)}>Previous page</a> : <span aria-disabled="true">Previous page</span>}
      <span>Page {page} of {pages} · {total} matching claims</span>
      {page < pages ? <a href={pageLink(page + 1, filters)}>Next page</a> : <span aria-disabled="true">Next page</span>}
    </nav>
    <h2>Claims for review</h2>
    {placementCohorts.length > 0 && <section aria-label="Placement cohort grouping" className="my-4 rounded border p-4">
      <details>
        <summary className="cursor-pointer font-semibold">Batch 060 placement cohorts · {placementCohorts.length} matching source/cohort groups</summary>
        <p className="my-2">Grouped by exact college, recorded cohort/programme scope, reporting year and source. Each metric remains an individual claim and needs its own accuracy decision. NIRF denominators here are not placement-eligible counts; no placement percentage is calculated.</p>
        <div className="overflow-x-auto"><table className="min-w-full border-collapse text-left text-sm">
          <thead><tr><th className="border p-2">College / campus</th><th className="border p-2">Cohort / year</th><th className="border p-2">Metrics captured</th><th className="border p-2">Source / use status</th><th className="border p-2">Review</th></tr></thead>
          <tbody>{placementCohorts.map((group) => <tr key={`${group.collegeId}-${group.sourceId}-${group.programScope}-${group.academicYear}-${group.cohort}`}>
            <td className="border p-2">{group.collegeName} ({group.collegeSlug})<br />{group.campusScope ?? 'Campus scope not recorded'}</td>
            <td className="border p-2">{group.cohort}<br />Reporting year: {group.academicYear ?? 'not recorded'} · {group.publisherPeriod ?? 'publisher period not recorded'}</td>
            <td className="border p-2"><ul className="space-y-2">{group.claims.map((claim) => <li key={claim.id}>
              <strong>{claim.metric}</strong>: {claim.value.toLocaleString('en-IN')}{claim.metric === 'MEDIAN' ? ' INR/year' : ''} · denominator {claim.denominator.toLocaleString('en-IN')} · <strong>{claim.reviewState}</strong>
              <p>{claim.definition}</p><p>{claim.evidenceLocation ?? 'Evidence location not recorded'}</p>
              {claim.holdReason && <p role="note"><strong>Hold:</strong> {claim.holdReason}</p>}
              <Link href={pageLink(1, { status: 'ALL', batch: '060', factType: 'placement', q: claim.id })}>Open claim {claim.id}</Link>
            </li>)}</ul></td>
            <td className="border p-2"><a href={group.sourceUrl} target="_blank" rel="noopener noreferrer">{group.sourcePublisher}</a><br />Retrieved {date(group.sourceRetrievedAt)}<br />Source-use: {group.sourceUseStatus}</td>
            <td className="border p-2">{group.claims.length < 3 ? 'Incomplete metric group; no missing value inferred.' : 'Three candidate metrics present.'}<br /><Link href={pageLink(1, { status: 'ALL', batch: '060', factType: 'placement', college: group.collegeSlug, program: group.cohort, academicYear: group.academicYear ?? undefined, sourceUse: group.sourceUseStatus })}>Filter this cohort’s claims</Link></td>
          </tr>)}</tbody>
        </table></div>
      </details>
    </section>}
    {items.length === 0 && <p>No claims match these filters.</p>}
    <div className="space-y-4">
      {items.map((claim) => {
        const hold = evidenceReviewHold(claim.id);
        const campusAliases = claim.college.aliases.filter((alias) => alias.campus);
        const state = claim.queueState;
        return <article key={claim.id} className="min-w-0 break-words border p-4" data-claim-id={claim.id}>
          <header className="mb-3 flex flex-wrap items-center gap-2">
            <h3>{claim.college.name}</h3>
            <span>{state}</span><span>{claim.freshness}</span>
            {claim.isFixture && <span>DEMO FIXTURE</span>}
          </header>
          <p><strong>Stable institution:</strong> {claim.college.slug} · {claim.college.city}, {claim.college.state}</p>
          <p><strong>Campus identity:</strong> {campusAliases.length ? campusAliases.map((alias) => `${alias.campus} (${alias.namespace}: ${alias.value}; valid ${date(alias.validFrom)} to ${date(alias.validUntil)})`).join('; ') : 'No campus alias recorded; confirm the source applies to this institution/campus.'}</p>
          <p><strong>Field:</strong> {claim.field}{claim.programScope ? ` · ${claim.programScope}` : ''}</p>
          {claim.value && typeof claim.value === 'object' && !Array.isArray(claim.value) && 'kind' in claim.value && <p><strong>Fact type:</strong> {String(claim.value.kind)}{claim.historical ? ' · Historical' : ''}</p>}
          <p><strong>Proposed value:</strong> <code className="whitespace-pre-wrap">{JSON.stringify(claim.value)}</code>{claim.unit ? ` ${claim.unit}` : ''}</p>
          <p><strong>Academic year:</strong> {claim.academicYear ?? 'Not recorded'} · <strong>Validity:</strong> {date(claim.validFrom)} to {date(claim.validUntil)}</p>
          <p><strong>Publisher:</strong> {claim.source.publisher} · <strong>Published:</strong> {date(claim.publishedAt ?? claim.source.publishedAt)} · <strong>Retrieved:</strong> {date(claim.source.retrievedAt)}</p>
          <p><strong>Official source:</strong> {safeSource(claim.source.url)}</p>
          <p><strong>Access / reuse record:</strong> {claim.source.license ?? 'Not recorded'}{claim.source.notes ? ` · ${claim.source.notes}` : ''}</p>
          {claim.historical && <p role="note"><strong>Historical scope:</strong> {claim.applicablePeriod ?? claim.publisherPeriod ?? claim.academicYear ?? 'Period not recorded'} · do not present as current.</p>}
          <p><strong>Evidence location:</strong> {claim.evidenceLocator ?? 'Not recorded'}</p>
          {prioritySourceChecks[claim.id] && <p role="note"><strong>Priority source check:</strong> {prioritySourceChecks[claim.id]}</p>}
          {claim.evidenceSnippet && <blockquote className="border-l-2 pl-3">{claim.evidenceSnippet}</blockquote>}
          {hold && <p role="note"><strong>Manual hold:</strong> {hold}</p>}
          {claim.conflicts.length > 0 && <section aria-label="Conflicting evidence" className="my-3 border-l-4 border-amber-600 pl-3">
            <h4>Conflicting evidence ({claim.conflicts.length})</h4>
            {claim.conflicts.map((peer) => <p key={peer.id}>
              {peer.id} · {JSON.stringify(peer.value)} · year {peer.academicYear ?? 'not recorded'} · published {date(peer.source.publishedAt)} · {peer.source.publisher} · {safeSource(peer.source.url, 'Open conflicting source')}
            </p>)}
          </section>}
          <SourceUseAssessment sourceId={claim.sourceId} required={sourceRequiresExplicitUseAssessment(claim.source)} status={claim.sourceUseStatus} assessment={claim.sourceUseAssessment} />
          <details className="my-3"><summary>Reviewer decision history</summary>
            {claim.decisions.length ? <ol>{claim.decisions.map((decision) => <li key={decision.id}>{decision.status} by {decision.reviewer.name ?? decision.reviewerId} on {date(decision.createdAt)} — {decision.reason}</li>)}</ol> : <p>No reviewer decisions recorded.</p>}
          </details>
          <ReviewDecision id={claim.id} currentDecisionId={claim.decisions[0]?.id ?? null} fixture={claim.isFixture} held={Boolean(hold)} expired={state === 'EXPIRED'} future={state === 'NOT_YET_VALID'} conflicted={state === 'CONFLICTED'} sourceUseRequired={sourceRequiresExplicitUseAssessment(claim.source)} sourceUseStatus={claim.sourceUseStatus} />
        </article>;
      })}
    </div>
    <p className="my-4">“Older” means the source publication date is more than two years old; it is a review prompt, not an automatic expiry. Only the validity dates or the source/field review determine whether a claim can be approved.</p>
    <details className="mt-8"><summary>Recent import runs</summary>{runs.map((run) => <p key={run.id}>{run.id}: {run.status} {JSON.stringify(run.summary)}</p>)}</details>
  </main>;
}


function safeSource(url: string, label = url) {
  try {
    if (new URL(url).protocol === 'https:' && !new URL(url).username && !new URL(url).password) return <a href={url} target="_blank" rel="noopener noreferrer">{label}</a>;
  } catch { /* show malformed source as text for reviewer correction */ }
  return <span>{label} (invalid or non-HTTPS source URL)</span>;
}

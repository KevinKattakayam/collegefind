import { evidenceQueue, queueQuery } from '@/server/evidence-queue';
import { evidenceReviewHold } from '@/server/review-holds';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import ReviewDecision from './review-decision';
import reviewBatch from '../../../../data/pilot/first-human-review-batch.json';

export const dynamic = 'force-dynamic';

type Search = Record<string, string | string[] | undefined>;
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

  const result = await evidenceQueue(prisma, parsed.data);
  const { page, pageSize, status, q, college, campus, field, academicYear, freshness, total, items } = result;
  const filters = { status, q, college, campus, field, academicYear, freshness };
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const runs = await prisma.importRun.findMany({ orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], take: 10 });

  return <main className="container-page min-w-0 overflow-x-hidden py-8">
    <h1>Enrichment review</h1>
    <p>Retrieval is not verification. Only an authorized reviewer decision can publish evidence. Fixture claims are never publishable.</p>
    <details className="my-5 border p-4" open>
      <summary className="cursor-pointer font-semibold">First owner review batch · {reviewBatch.claims.length} claims · staged for inspection, not approval</summary>
      <p className="my-2">Review each source and institution/campus independently. These entries are a prioritized handoff; opening the source or passing automated checks is not approval.</p>
      <ol className="space-y-3">
        {reviewBatch.claims.map((item) => <li key={item.evidenceId} className="border-t pt-3">
          <p><strong>{item.order}. {item.institutionName}</strong> ({item.institutionSlug}) · <code>{item.evidenceId}</code></p>
          <p><strong>Field:</strong> {item.field} · <strong>Academic year:</strong> {item.academicYear ?? 'Not recorded'}{item.programScope ? ` · ${item.programScope}` : ''}</p>
          <p><strong>Proposed value:</strong> <code className="whitespace-pre-wrap">{JSON.stringify(item.value)}</code>{item.unit ? ` ${item.unit}` : ''}</p>
          <p><strong>College location:</strong> {item.collegeCity}, {item.collegeState} · <strong>Campus check:</strong> {item.campusReviewQuestion}</p>
          <p><strong>Source:</strong> {item.sourcePublisher} · <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Open official source</a> · <strong>Published:</strong> {item.sourcePublishedAt ? date(new Date(item.sourcePublishedAt)) : 'Not recorded'} · <strong>Retrieved:</strong> {date(new Date(item.sourceRetrievedAt))}</p>
          <p><strong>Evidence location:</strong> {item.evidenceLocation ?? 'Not recorded'}</p>
          <details><summary>Source access, reuse and collection notes</summary><p role="note"><strong>Source-use review:</strong> {item.sourceUseWarning}</p><p>{item.sourceNotes}</p></details>
          {item.freshnessWarning && <p role="note"><strong>Freshness review:</strong> {item.freshnessWarning}</p>}
          {item.conflictWarning && <p role="alert"><strong>Conflict warning:</strong> {item.conflictWarning} {item.conflictPeerIds.join(', ')}</p>}
          <p><strong>Reviewer question:</strong> {item.recommendedQuestion}</p>
          <Link href={pageLink(1, { status: 'ALL', q: item.evidenceId })}>Open this claim in the queue</Link>
        </li>)}
      </ol>
    </details>
    <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" action="/admin/enrichment">
      <label>Review state<select name="status" defaultValue={status} className="block w-full">
        {['STAGED', 'ALL', 'CONFLICTED', 'EXPIRED', 'NOT_YET_VALID', 'VERIFIED', 'REJECTED', 'DEMO'].map((value) => <option key={value}>{value}</option>)}
      </select></label>
      <label>Search college, claim ID, field or programme<input name="q" defaultValue={q} className="block w-full" /></label>
      <label>College<input name="college" defaultValue={college} className="block w-full" /></label>
      <label>Campus, city or state<input name="campus" defaultValue={campus} className="block w-full" /></label>
      <label>Field<input name="field" defaultValue={field} className="block w-full" /></label>
      <label>Academic year<input name="academicYear" inputMode="numeric" defaultValue={academicYear ?? ''} className="block w-full" /></label>
      <label>Evidence freshness<select name="freshness" defaultValue={freshness} className="block w-full">
        {['ALL', 'CURRENT', 'UNDATED', 'SOURCE_UNDATED', 'OLDER', 'EXPIRED', 'FUTURE'].map((value) => <option key={value}>{value}</option>)}
      </select></label>
      <div className="flex items-end gap-2"><button type="submit">Apply filters</button><a href="/admin/enrichment">Clear</a></div>
    </form>
    <nav aria-label="Review queue pages" className="my-5 flex items-center gap-4">
      {page > 1 ? <a href={pageLink(page - 1, filters)}>Previous page</a> : <span aria-disabled="true">Previous page</span>}
      <span>Page {page} of {pages} · {total} matching claims</span>
      {page < pages ? <a href={pageLink(page + 1, filters)}>Next page</a> : <span aria-disabled="true">Next page</span>}
    </nav>
    <h2>Claims for review</h2>
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
          <p><strong>Proposed value:</strong> <code className="whitespace-pre-wrap">{JSON.stringify(claim.value)}</code>{claim.unit ? ` ${claim.unit}` : ''}</p>
          <p><strong>Academic year:</strong> {claim.academicYear ?? 'Not recorded'} · <strong>Validity:</strong> {date(claim.validFrom)} to {date(claim.validUntil)}</p>
          <p><strong>Publisher:</strong> {claim.source.publisher} · <strong>Published:</strong> {date(claim.publishedAt ?? claim.source.publishedAt)} · <strong>Retrieved:</strong> {date(claim.source.retrievedAt)}</p>
          <p><strong>Official source:</strong> {safeSource(claim.source.url)}</p>
          <p><strong>Access / reuse record:</strong> {claim.source.license ?? 'Not recorded'}{claim.source.notes ? ` · ${claim.source.notes}` : ''}</p>
          <p><strong>Evidence location:</strong> {claim.evidenceLocator ?? 'Not recorded'}</p>
          {claim.evidenceSnippet && <blockquote className="border-l-2 pl-3">{claim.evidenceSnippet}</blockquote>}
          {hold && <p role="note"><strong>Manual hold:</strong> {hold}</p>}
          {claim.conflicts.length > 0 && <section aria-label="Conflicting evidence" className="my-3 border-l-4 border-amber-600 pl-3">
            <h4>Conflicting evidence ({claim.conflicts.length})</h4>
            {claim.conflicts.map((peer) => <p key={peer.id}>
              {peer.id} · {JSON.stringify(peer.value)} · year {peer.academicYear ?? 'not recorded'} · published {date(peer.source.publishedAt)} · {peer.source.publisher} · {safeSource(peer.source.url, 'Open conflicting source')}
            </p>)}
          </section>}
          <details className="my-3"><summary>Reviewer decision history</summary>
            {claim.decisions.length ? <ol>{claim.decisions.map((decision) => <li key={decision.id}>{decision.status} by {decision.reviewer.name ?? decision.reviewerId} on {date(decision.createdAt)} — {decision.reason}</li>)}</ol> : <p>No reviewer decisions recorded.</p>}
          </details>
          <ReviewDecision id={claim.id} currentDecisionId={claim.decisions[0]?.id ?? null} fixture={claim.isFixture} held={Boolean(hold)} expired={state === 'EXPIRED'} future={state === 'NOT_YET_VALID'} conflicted={state === 'CONFLICTED'} />
        </article>;
      })}
    </div>
    <p className="my-4">“Older” means the source publication date is more than two years old; it is a review prompt, not an automatic expiry. Only the validity dates or the source/field review determine whether a claim can be approved.</p>
    <details className="mt-8"><summary>Recent import runs</summary>{runs.map((run) => <p key={run.id}>{run.id}: {run.status} {JSON.stringify(run.summary)}</p>)}</details>
  </main>;
}

function safeSource(url: string, label = url) {
  try {
    if (new URL(url).protocol === 'https:') return <a href={url} target="_blank" rel="noopener noreferrer">{label}</a>;
  } catch { /* show malformed source as text for reviewer correction */ }
  return <span>{label} (invalid or non-HTTPS source URL)</span>;
}

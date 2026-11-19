'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';

type CollegeRef = { id: string; slug: string; name: string; };
type QuestionRef = { id: string; text: string; status: string; createdAt: string; college: CollegeRef; };
type Report = {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
  resolutionReason: string | null;
  question: QuestionRef | null;
  answer: {
    id: string;
    text: string;
    status: string;
    createdAt: string;
    question: QuestionRef;
  } | null;
};

export default function CommunityModeration() {
  const [reports, setReports] = useState<Report[]>([]);
  const [status, setStatus] = useState('OPEN');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async (nextPage = page) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ status, q: query, page: String(nextPage), limit: '20' });
      const data = await apiJson<{ reports: Report[]; total: number; }>(`/api/admin/moderation?${params}`);
      setReports(data.reports);
      setTotal(data.total);
      setPage(nextPage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Moderation queue unavailable');
    } finally {
      setLoading(false);
    }
  }, [page, query, status]);

  useEffect(() => {
    let active = true;
    apiJson<{ reports: Report[]; total: number; }>('/api/admin/moderation?status=OPEN&page=1&limit=20')
      .then(data => {
        if (active) {
          setReports(data.reports);
          setTotal(data.total);
        }
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'Moderation queue unavailable');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function send(body: unknown, reportId?: string) {
    setBusy(true);
    setError('');
    try {
      await apiJson('/api/admin/moderation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (reportId) setReasons(current => ({ ...current, [reportId]: '' }));
      await load(page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Action failed; no moderation change was confirmed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 space-y-4">
      <form className="grid gap-3 rounded border bg-white p-4 sm:grid-cols-3" onSubmit={event => { event.preventDefault(); void load(1); }}>
        <label>Status
          <select className="input-field" value={status} onChange={event => setStatus(event.target.value)}>
            <option>OPEN</option><option>RESOLVED</option><option>DISMISSED</option><option>ALL</option>
          </select>
        </label>
        <label>Search text or report reason
          <input className="input-field" maxLength={120} value={query} onChange={event => setQuery(event.target.value)} />
        </label>
        <button className="btn-primary self-end">Search</button>
      </form>

      {error && <p role="alert">{error} <button className="underline" onClick={() => void load(page)}>Retry</button></p>}
      {loading ? <p role="status">Loading moderation reports…</p> : reports.length === 0 ? (
        <p className="rounded border border-dashed p-6">No reports in this queue.</p>
      ) : (
        <>
          <nav aria-label="Moderation pages" className="flex items-center gap-4">
            <button disabled={page <= 1 || busy} onClick={() => void load(page - 1)}>Previous</button>
            <span aria-live="polite">Page {page} · {total} reports</span>
            <button disabled={page * 20 >= total || busy} onClick={() => void load(page + 1)}>Next</button>
          </nav>
          <ol className="space-y-4">
            {reports.map(report => {
              const question = report.question ?? report.answer?.question;
              const text = report.question?.text ?? report.answer?.text ?? 'Target content is unavailable';
              const type = report.question ? 'question' : 'answer';
              const contentId = report.question?.id ?? report.answer?.id ?? '';
              const contentStatus = report.question?.status ?? report.answer?.status;
              const reason = reasons[report.id] ?? '';
              return (
                <li key={report.id} className="rounded-xl border bg-white p-4">
                  <header className="flex flex-wrap justify-between gap-2">
                    <h2 className="font-semibold">{type === 'question' ? 'Question' : 'Answer'} report · {report.status}</h2>
                    <time className="text-sm text-slate-600">{new Date(report.createdAt).toLocaleString()}</time>
                  </header>
                  <p className="mt-2"><strong>Reason:</strong> {report.reason}</p>
                  <blockquote className="my-3 border-l-4 pl-3">{text}</blockquote>
                  {question && <p>College: <a className="underline" href={`/colleges/${question.college.slug}`}>{question.college.name}</a> · content status {contentStatus}</p>}
                  {report.resolutionReason && <p>Moderator note: {report.resolutionReason}</p>}
                  {report.status === 'OPEN' && (
                    <div className="mt-3 space-y-2">
                      <label className="block">Moderator reason
                        <input
                          className="input-field"
                          minLength={3}
                          maxLength={500}
                          value={reason}
                          onChange={event => setReasons(current => ({ ...current, [report.id]: event.target.value }))}
                          placeholder="Required for audit"
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {contentStatus === 'VISIBLE' ? (
                          <button disabled={busy || reason.trim().length < 3} className="btn-danger" onClick={() => void send({ type, id: contentId, status: 'HIDDEN', expectedStatus: contentStatus, reportId: report.id, reason }, report.id)}>Hide and resolve</button>
                        ) : (
                          <button disabled={busy || reason.trim().length < 3} className="btn-outlined" onClick={() => void send({ type, id: contentId, status: 'VISIBLE', expectedStatus: contentStatus, reportId: report.id, reason }, report.id)}>Restore and resolve</button>
                        )}
                        <button disabled={busy || reason.trim().length < 3} className="underline" onClick={() => void send({ reportId: report.id, reportStatus: 'DISMISSED', reason }, report.id)}>Dismiss report</button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}

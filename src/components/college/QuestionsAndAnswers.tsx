'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import type { Answer, Question } from '@/types';
import { apiJson, postJson } from '@/lib/api';
import { timeAgo } from '@/lib/utils';

type CommunityQuestion = Question & { canEdit?: boolean };
type CommunityAnswer = Answer & { canEdit?: boolean };

export default function QuestionsAndAnswers({ collegeId, collegeSlug }: { collegeId: string; collegeSlug: string }) {
  const { data: session } = useSession();
  const [questions, setQuestions] = useState<CommunityQuestion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [newQuestion, setNewQuestion] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, CommunityAnswer[]>>({});
  const [answerTotals, setAnswerTotals] = useState<Record<string, number>>({});
  const [answerPages, setAnswerPages] = useState<Record<string, number>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [editingAnswer, setEditingAnswer] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('SPAM');
  const [reportDetails, setReportDetails] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    apiJson<{ questions: CommunityQuestion[]; total: number; page: number }>(`/api/questions/${collegeId}?page=1&limit=20`)
      .then(data => {
        if (!active) return;
        setQuestions(data.questions);
        setTotal(data.total);
        setPage(data.page);
      })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [collegeId]);

  async function loadQuestions(nextPage = 1, append = false) {
    setLoadError(false);
    try {
      const data = await apiJson<{ questions: CommunityQuestion[]; total: number; page: number }>(`/api/questions/${collegeId}?page=${nextPage}&limit=20`);
      setQuestions(current => append ? [...current, ...data.questions] : data.questions);
      setTotal(data.total);
      setPage(nextPage);
    } catch {
      setLoadError(true);
    } finally {
      setLoaded(true);
    }
  }

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await postJson<{ question: CommunityQuestion }>('/api/questions', { collegeId, text: newQuestion });
      setQuestions(current => [data.question, ...current]);
      setTotal(value => value + 1);
      setNewQuestion('');
      toast.success('Question posted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not post question');
    } finally {
      setBusy(false);
    }
  }

  async function toggleAnswers(questionId: string) {
    if (expanded === questionId) {
      setExpanded(null);
      return;
    }
    setExpanded(questionId);
    if (answers[questionId]) return;
    try {
      const data = await apiJson<{ answers: CommunityAnswer[]; total: number }>(`/api/answers/${questionId}?page=1&limit=20`);
      setAnswers(current => ({ ...current, [questionId]: data.answers }));
      setAnswerTotals(current => ({ ...current, [questionId]: data.total }));
      setAnswerPages(current => ({ ...current, [questionId]: 1 }));
    } catch {
      toast.error('Answers could not be loaded. Try again.');
    }
  }

  async function loadMoreAnswers(questionId: string) {
    const nextPage = (answerPages[questionId] ?? 1) + 1;
    try {
      const data = await apiJson<{ answers: CommunityAnswer[]; total: number }>(`/api/answers/${questionId}?page=${nextPage}&limit=20`);
      setAnswers(current => ({ ...current, [questionId]: [...(current[questionId] ?? []), ...data.answers] }));
      setAnswerPages(current => ({ ...current, [questionId]: nextPage }));
      setAnswerTotals(current => ({ ...current, [questionId]: data.total }));
    } catch {
      toast.error('More answers could not be loaded. Try again.');
    }
  }

  async function reply(questionId: string, event: React.FormEvent) {
    event.preventDefault();
    const text = (drafts[questionId] ?? '').trim();
    setBusy(true);
    try {
      const data = await postJson<{ answer: CommunityAnswer }>('/api/answers', { questionId, text });
      setAnswers(current => ({ ...current, [questionId]: [...(current[questionId] ?? []), data.answer] }));
      setAnswerTotals(current => ({ ...current, [questionId]: (current[questionId] ?? 0) + 1 }));
      setDrafts(current => ({ ...current, [questionId]: '' }));
      toast.success('Answer posted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not post answer');
    } finally {
      setBusy(false);
    }
  }

  async function editQuestion(question: CommunityQuestion, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = String(new FormData(event.currentTarget).get('text') ?? '');
    setBusy(true);
    try {
      const data = await postJson<{ question: CommunityQuestion }>(`/api/questions/${collegeId}/${question.id}`, { collegeId, text }, 'PATCH');
      setQuestions(current => current.map(item => item.id === question.id ? data.question : item));
      setEditingQuestion(null);
      toast.success('Question updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not edit question');
    } finally {
      setBusy(false);
    }
  }

  async function editAnswer(questionId: string, answer: CommunityAnswer, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = String(new FormData(event.currentTarget).get('text') ?? '');
    setBusy(true);
    try {
      const data = await postJson<{ answer: CommunityAnswer }>(`/api/answers/${questionId}/${answer.id}`, { questionId, text }, 'PATCH');
      setAnswers(current => ({ ...current, [questionId]: (current[questionId] ?? []).map(item => item.id === answer.id ? data.answer : item) }));
      setEditingAnswer(null);
      toast.success('Answer updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not edit answer');
    } finally {
      setBusy(false);
    }
  }

  async function removeQuestion(questionId: string) {
    if (!window.confirm('Remove this contribution from public view?')) return;
    setBusy(true);
    try {
      await apiJson(`/api/questions/${collegeId}/${questionId}`, { method: 'DELETE' });
      setQuestions(current => current.filter(question => question.id !== questionId));
      setTotal(value => Math.max(0, value - 1));
      toast.success('Contribution removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove contribution');
    } finally {
      setBusy(false);
    }
  }

  async function removeAnswer(questionId: string, answerId: string) {
    if (!window.confirm('Remove this contribution from public view?')) return;
    setBusy(true);
    try {
      await apiJson(`/api/answers/${questionId}/${answerId}`, { method: 'DELETE' });
      setAnswers(current => ({ ...current, [questionId]: (current[questionId] ?? []).filter(answer => answer.id !== answerId) }));
      setAnswerTotals(current => ({ ...current, [questionId]: Math.max(0, (current[questionId] ?? 1) - 1) }));
      toast.success('Contribution removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove contribution');
    } finally {
      setBusy(false);
    }
  }

  async function report(type: 'question' | 'answer', id: string) {
    setBusy(true);
    try {
      const target = type === 'question' ? { questionId: id } : { answerId: id };
      await postJson('/api/community/reports', { ...target, reason: reportReason, details: reportDetails });
      setReporting(null);
      setReportDetails('');
      toast.success('Report sent to moderators');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Report could not be sent');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="qa-heading" className="container-main mb-8 py-6">
      <h2 id="qa-heading" className="section-heading mb-2">Questions and answers</h2>
      <p className="mb-6 text-sm text-slate-600">Community contributions are personal experiences and opinions, not official or verified CollegeFind facts. Contributors are not identity-verified students or alumni.</p>

      {session ? (
        <form onSubmit={ask} className="mb-6 rounded-lg border bg-white p-4">
          <label htmlFor="new-question" className="mb-2 block font-semibold">Ask a question</label>
          <textarea id="new-question" required minLength={10} maxLength={500} value={newQuestion} onChange={event => setNewQuestion(event.target.value)} className="input-field mb-3 !h-auto min-h-[80px] resize-y" placeholder="Ask about your college research" />
          <button disabled={busy} className="btn-primary text-sm">Post question</button>
        </form>
      ) : (
        <p className="mb-6 rounded-lg bg-slate-100 p-4 text-sm">
          <Link href={`/login?callbackUrl=${encodeURIComponent(`/colleges/${collegeSlug}`)}`} className="font-semibold text-indigo-700">Sign in</Link> to ask, answer or report content.
        </p>
      )}

      {!loaded ? <p role="status">Loading questions…</p> : loadError ? (
        <p role="alert">Questions are unavailable. <button onClick={() => void loadQuestions()} className="underline">Retry</button></p>
      ) : questions.length === 0 ? (
        <p>No questions yet.</p>
      ) : (
        <>
          <ul className="space-y-3">
            {questions.map(question => (
              <li key={question.id} className="rounded-lg border bg-white p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <button type="button" onClick={() => void toggleAnswers(question.id)} aria-expanded={expanded === question.id} className="min-w-0 flex-1 text-left">
                    <span className="block whitespace-pre-line font-medium">{question.text}</span>
                    <span className="text-xs text-slate-500">{question.user?.name ?? 'Account deactivated'} · {timeAgo(question.createdAt)} · {question._count?.answers ?? 0} answers</span>
                  </button>
                  {session && <div className="flex gap-2">
                    {question.canEdit ? <>
                      <button type="button" className="underline" onClick={() => setEditingQuestion(editingQuestion === question.id ? null : question.id)}>Edit</button>
                      <button type="button" className="text-red-700 underline" disabled={busy} onClick={() => void removeQuestion(question.id)}>Remove</button>
                    </> : <button type="button" className="underline" onClick={() => setReporting(reporting === `q:${question.id}` ? null : `q:${question.id}`)}>Report</button>}
                  </div>}
                </div>

                {editingQuestion === question.id && <form className="mt-3" onSubmit={event => void editQuestion(question, event)}>
                  <label className="block">Edit question<textarea name="text" required minLength={10} maxLength={500} defaultValue={question.text} className="input-field min-h-20" /></label>
                  <button disabled={busy} className="btn-primary mt-2">Save edit</button>
                </form>}
                {reporting === `q:${question.id}` && <ReportForm busy={busy} reason={reportReason} details={reportDetails} setReason={setReportReason} setDetails={setReportDetails} onCancel={() => setReporting(null)} onSubmit={() => void report('question', question.id)} />}

                {expanded === question.id && <div className="mt-4 border-l-2 pl-4">
                  {(answers[question.id] ?? []).map(answer => <article key={answer.id} className="mb-4">
                    <p className="whitespace-pre-line">{answer.text}</p>
                    <p className="text-xs text-slate-500">{answer.user?.name ?? 'Account deactivated'} · {timeAgo(answer.createdAt)}</p>
                    {session && <div className="flex gap-3 text-sm">
                      {answer.canEdit ? <>
                        <button type="button" className="underline" onClick={() => setEditingAnswer(editingAnswer === answer.id ? null : answer.id)}>Edit</button>
                        <button type="button" className="text-red-700 underline" disabled={busy} onClick={() => void removeAnswer(question.id, answer.id)}>Remove</button>
                      </> : <button type="button" className="underline" onClick={() => setReporting(reporting === `a:${answer.id}` ? null : `a:${answer.id}`)}>Report</button>}
                    </div>}
                    {editingAnswer === answer.id && <form onSubmit={event => void editAnswer(question.id, answer, event)}>
                      <label className="block">Edit answer<textarea name="text" required minLength={5} maxLength={1000} defaultValue={answer.text} className="input-field" /></label>
                      <button disabled={busy} className="btn-primary mt-2">Save edit</button>
                    </form>}
                    {reporting === `a:${answer.id}` && <ReportForm busy={busy} reason={reportReason} details={reportDetails} setReason={setReportReason} setDetails={setReportDetails} onCancel={() => setReporting(null)} onSubmit={() => void report('answer', answer.id)} />}
                  </article>)}
                  {(answers[question.id]?.length ?? 0) < (answerTotals[question.id] ?? 0) && <button type="button" className="underline" onClick={() => void loadMoreAnswers(question.id)}>Load more answers</button>}
                  {session && <form onSubmit={event => void reply(question.id, event)} className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <label htmlFor={`reply-${question.id}`} className="sr-only">Your answer</label>
                    <input id={`reply-${question.id}`} required minLength={5} maxLength={1000} value={drafts[question.id] ?? ''} onChange={event => setDrafts(current => ({ ...current, [question.id]: event.target.value }))} placeholder="Write an answer" className="input-field flex-1" />
                    <button disabled={busy} className="btn-primary">Reply</button>
                  </form>}
                </div>}
              </li>
            ))}
          </ul>
          {questions.length < total && <button className="btn-outlined mt-4" onClick={() => void loadQuestions(page + 1, true)}>Load more questions</button>}
        </>
      )}
    </section>
  );
}

function ReportForm({ busy, reason, details, setReason, setDetails, onCancel, onSubmit }: {
  busy: boolean;
  reason: string;
  details: string;
  setReason: (value: string) => void;
  setDetails: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <form className="mt-3 rounded border bg-amber-50 p-3" onSubmit={event => { event.preventDefault(); onSubmit(); }}>
      <label className="block">Reason
        <select className="input-field" value={reason} onChange={event => setReason(event.target.value)}>
          <option value="SPAM">Spam</option>
          <option value="ABUSE">Abuse or harassment</option>
          <option value="MISLEADING">Misleading or unsafe claim</option>
          <option value="OTHER">Other</option>
        </select>
      </label>
      <label className="mt-2 block">Details (optional)
        <textarea maxLength={500} value={details} onChange={event => setDetails(event.target.value)} className="input-field" />
      </label>
      <div className="mt-2 flex gap-3">
        <button disabled={busy} className="btn-primary">Send report</button>
        <button type="button" onClick={onCancel} className="underline">Cancel</button>
      </div>
    </form>
  );
}

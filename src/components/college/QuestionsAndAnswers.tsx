'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import type { Answer, Question } from '@/types';
import { apiJson, postJson } from '@/lib/api';
import { timeAgo } from '@/lib/utils';

/**
 * Community Q&A. All user text is rendered as React text nodes (escaped);
 * never switch this to dangerouslySetInnerHTML.
 */
export default function QuestionsAndAnswers({ collegeId, collegeSlug }: { collegeId: string; collegeSlug: string }) {
  const { data: session } = useSession();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiJson<{ questions: Question[] }>(`/api/questions/${collegeId}`)
      .then((d) => setQuestions(d.questions))
      .catch(() => setQuestions([]))
      .finally(() => setLoaded(true));
  }, [collegeId]);

  const ask = async () => {
    if (newQuestion.trim().length < 10) return toast.error('Questions need at least 10 characters');
    setBusy(true);
    try {
      const d = await postJson<{ question: Question }>('/api/questions', { collegeId, text: newQuestion });
      setQuestions((prev) => [d.question, ...prev]);
      setNewQuestion('');
      toast.success('Question posted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not post question');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (id: string) => {
    if (expanded === id) return setExpanded(null);
    setExpanded(id);
    if (!answers[id]) {
      try {
        const d = await apiJson<{ answers: Answer[] }>(`/api/answers/${id}`);
        setAnswers((prev) => ({ ...prev, [id]: d.answers }));
      } catch {
        toast.error('Could not load answers');
      }
    }
  };

  const reply = async (questionId: string) => {
    const text = (drafts[questionId] ?? '').trim();
    if (text.length < 5) return toast.error('Answers need at least 5 characters');
    try {
      const d = await postJson<{ answer: Answer }>('/api/answers', { questionId, text });
      setAnswers((prev) => ({ ...prev, [questionId]: [...(prev[questionId] ?? []), d.answer] }));
      setDrafts((prev) => ({ ...prev, [questionId]: '' }));
      toast.success('Answer posted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not post answer');
    }
  };

  return (
    <section aria-labelledby="qa-heading" className="container-main py-6 mb-8">
      <h2 id="qa-heading" className="section-heading mb-2">Questions and answers</h2>
      <p className="text-sm text-slate-600 mb-6">Answers come from other users and are not checked by CollegeFind.</p>

      {session ? (
        <div className="mb-6 bg-white p-4 rounded-lg border border-slate-200">
          <label htmlFor="new-question" className="block text-sm font-semibold text-slate-700 mb-2">Ask a question</label>
          <textarea id="new-question" value={newQuestion} maxLength={500} onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="For example: Is hostel accommodation guaranteed for first-year students?"
            className="input-field !h-auto min-h-[80px] resize-none mb-3" />
          <button type="button" onClick={ask} disabled={busy} className="btn-primary text-sm">Post question</button>
        </div>
      ) : (
        <p className="mb-6 p-4 bg-slate-100 rounded-lg text-sm text-slate-700">
          <Link href={`/login?callbackUrl=${encodeURIComponent(`/colleges/${collegeSlug}`)}`} className="font-semibold text-indigo-700">Sign in</Link> to ask or answer questions.
        </p>
      )}

      {!loaded ? (
        <p className="text-slate-500 text-sm">Loading questions…</p>
      ) : questions.length === 0 ? (
        <p className="text-slate-600">No questions yet.</p>
      ) : (
        <ul className="space-y-3">
          {questions.map((q) => (
            <li key={q.id} className="bg-white rounded-lg border border-slate-200 p-4">
              <button type="button" onClick={() => toggle(q.id)} aria-expanded={expanded === q.id} className="w-full text-left">
                <span className="block font-medium text-slate-800 text-sm mb-1 whitespace-pre-line">{q.text}</span>
                <span className="text-xs text-slate-500">
                  {q.user?.name ?? 'Anonymous'} · {timeAgo(q.createdAt)} · {q._count?.answers ?? 0} answers
                </span>
              </button>
              {expanded === q.id && (
                <div className="mt-4 pl-4 border-l-2 border-slate-200">
                  {(answers[q.id] ?? []).map((a) => (
                    <div key={a.id} className="mb-3">
                      <p className="text-sm text-slate-700 whitespace-pre-line">{a.text}</p>
                      <p className="text-xs text-slate-500 mt-1">{a.user?.name} · {timeAgo(a.createdAt)}</p>
                    </div>
                  ))}
                  {session && (
                    <div className="flex gap-2 mt-3">
                      <label htmlFor={`reply-${q.id}`} className="sr-only">Your answer</label>
                      <input id={`reply-${q.id}`} value={drafts[q.id] ?? ''} maxLength={1000}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Write an answer" className="input-field !h-[36px] text-sm flex-1" />
                      <button type="button" onClick={() => reply(q.id)} className="btn-primary text-sm !h-[36px]">Reply</button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

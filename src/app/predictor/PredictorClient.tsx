'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import Breadcrumb from '@/components/Breadcrumb';
import DataStatusBadge from '@/components/DataStatusBadge';
import { ApiClientError, apiJson } from '@/lib/api';
import { getCategoryLabel } from '@/lib/utils';
import { INDIAN_STATES_AND_UTS } from '@/content/states';
import type { DataStatus } from '@/types';

type Exam = 'JEE_MAIN' | 'JEE_ADVANCED' | 'NEET' | 'CAT' | 'GATE';
type Band = 'SAFE' | 'TARGET' | 'REACH' | 'UNLIKELY';

interface Result {
  program: { id: string; name: string; branch: string | null };
  college: { id: string; slug: string; name: string; city: string; state: string; dataStatus: DataStatus };
  seat: { quota: string; category: string; isPwd: boolean; seatPool: string; valueUsed: number; valueLabel: string };
  probability: number;
  band: Band;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  estimate: { expected: number; low: number; high: number; targetYear: number };
  history: { year: number; round: number; closing: number; source: { name: string; url: string } }[];
  explanation: string;
}
interface Response {
  meta: { hasData: boolean; latestDataYear: number | null; targetYear: number | null; assumptions: string[]; method: string; disclaimer: string };
  results: Result[];
  total: number;
}

const EXAMS: { value: Exam; label: string; kind: 'rank' | 'percentile' | 'score' }[] = [
  { value: 'JEE_MAIN', label: 'JEE Main (JoSAA: NITs, IIITs, GFTIs)', kind: 'rank' },
  { value: 'JEE_ADVANCED', label: 'JEE Advanced (JoSAA: IITs)', kind: 'rank' },
  { value: 'NEET', label: 'NEET UG (MCC)', kind: 'rank' },
  { value: 'CAT', label: 'CAT', kind: 'percentile' },
  { value: 'GATE', label: 'GATE', kind: 'score' },
];
const CATEGORIES = ['OPEN', 'EWS', 'OBC_NCL', 'SC', 'ST'];
const BAND_STYLE: Record<Band, { label: string; className: string; help: string }> = {
  SAFE: { label: 'Safe', className: 'bg-emerald-50 text-emerald-800 border-emerald-300', help: 'Estimated chance 75% or higher' },
  TARGET: { label: 'Target', className: 'bg-sky-50 text-sky-800 border-sky-300', help: 'Estimated chance 40–75%' },
  REACH: { label: 'Reach', className: 'bg-amber-50 text-amber-900 border-amber-300', help: 'Estimated chance 15–40%' },
  UNLIKELY: { label: 'Unlikely', className: 'bg-slate-100 text-slate-700 border-slate-300', help: 'Estimated chance below 15%' },
};

const FIELDS = ['exam', 'rank', 'categoryRank', 'pwdRank', 'score', 'category', 'isPwd', 'gender', 'homeState', 'branches', 'maxFees', 'includeUnlikely'] as const;
type Form = Record<(typeof FIELDS)[number], string>;
const EMPTY: Form = { exam: 'JEE_MAIN', rank: '', categoryRank: '', pwdRank: '', score: '', category: 'OPEN', isPwd: 'false', gender: 'UNSPECIFIED', homeState: '', branches: '', maxFees: '', includeUnlikely: 'false' };

function toQuery(f: Form) {
  const p = new URLSearchParams();
  for (const k of FIELDS) if (f[k] && f[k] !== EMPTY[k]) p.set(k, f[k]);
  p.set('exam', f.exam);
  return p.toString();
}

export default function PredictorClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initial = useMemo(() => {
    const f = { ...EMPTY };
    for (const k of FIELDS) {
      const v = searchParams.get(k);
      if (v !== null) f[k] = v;
    }
    return f;
  }, [searchParams]);
  const [form, setForm] = useState<Form>(initial);
  const [data, setData] = useState<Response | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const exam = EXAMS.find((e) => e.value === form.exam) ?? EXAMS[0];

  const run = async (f: Form) => {
    setLoading(true);
    setErrors({});
    try {
      setData(await apiJson<Response>(`/api/predict?${toQuery(f)}`));
    } catch (err) {
      setData(null);
      if (err instanceof ApiClientError && err.details) setErrors(err.details);
      else toast.error(err instanceof Error ? err.message : 'Prediction failed');
    } finally {
      setLoading(false);
    }
  };

  // Shared links (?exam=...&rank=...) run automatically.
  // Runs once on mount; deferred so no state is set synchronously in the effect.
  useEffect(() => {
    if (!searchParams.get('rank') && !searchParams.get('score')) return;
    const t = setTimeout(() => void run(initial), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: keyof Form, v: string) => setForm((prev) => ({ ...prev, [k]: v }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    router.replace(`/predictor?${toQuery(form)}`, { scroll: false });
    void run(form);
  };

  const grouped = useMemo(() => {
    const g: Record<Band, Result[]> = { SAFE: [], TARGET: [], REACH: [], UNLIKELY: [] };
    data?.results.forEach((r) => g[r.band].push(r));
    return g;
  }, [data]);

  const err = (k: string) => (errors[k] ? <p className="text-xs text-red-700 mt-1" role="alert">{errors[k]}</p> : null);

  return (
    <div className="container-main py-6">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Admission chances' }]} />
      <header className="mb-6 max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Estimate your admission chances</h1>
        <p className="text-slate-600">
          We compare your rank with official closing ranks from past years and show how likely each seat is next year.
          Estimates are not guarantees.
        </p>
      </header>

      <form onSubmit={submit} className="card-premium p-6 max-w-3xl mb-8 grid gap-4 md:grid-cols-2" noValidate>
        <div className="md:col-span-2">
          <label htmlFor="exam" className="text-sm font-semibold text-slate-700 block mb-1">Exam</label>
          <select id="exam" value={form.exam} onChange={(e) => set('exam', e.target.value)} className="input-field">
            {EXAMS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </div>

        {exam.kind === 'rank' ? (
          <div>
            <label htmlFor="rank" className="text-sm font-semibold text-slate-700 block mb-1">
              {form.exam === 'NEET' ? 'All India Rank' : 'CRL (Common Rank List) rank'}
            </label>
            <input id="rank" inputMode="numeric" value={form.rank} onChange={(e) => set('rank', e.target.value.replace(/\D/g, ''))}
              className="input-field" placeholder="e.g. 15000" aria-invalid={Boolean(errors.rank)} />
            {err('rank')}
          </div>
        ) : (
          <div>
            <label htmlFor="score" className="text-sm font-semibold text-slate-700 block mb-1">
              {exam.kind === 'percentile' ? 'Percentile (0–100)' : 'GATE score (0–1000)'}
            </label>
            <input id="score" inputMode="decimal" value={form.score} onChange={(e) => set('score', e.target.value)}
              className="input-field" aria-invalid={Boolean(errors.score)} />
            {err('score')}
          </div>
        )}

        <div>
          <label htmlFor="category" className="text-sm font-semibold text-slate-700 block mb-1">Category</label>
          <select id="category" value={form.category} onChange={(e) => set('category', e.target.value)} className="input-field">
            {CATEGORIES.map((c) => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
          </select>
        </div>

        {exam.kind === 'rank' && form.category !== 'OPEN' && (
          <div>
            <label htmlFor="categoryRank" className="text-sm font-semibold text-slate-700 block mb-1">Category rank</label>
            <input id="categoryRank" inputMode="numeric" value={form.categoryRank}
              onChange={(e) => set('categoryRank', e.target.value.replace(/\D/g, ''))} className="input-field" />
            <p className="text-xs text-slate-500 mt-1">Reserved seats are allotted on category rank, not CRL.</p>
          </div>
        )}

        <div>
          <label htmlFor="gender" className="text-sm font-semibold text-slate-700 block mb-1">Gender</label>
          <select id="gender" value={form.gender} onChange={(e) => set('gender', e.target.value)} className="input-field">
            <option value="UNSPECIFIED">Prefer not to say</option>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">Female candidates also compete for female-only seats.</p>
        </div>

        <div>
          <label htmlFor="homeState" className="text-sm font-semibold text-slate-700 block mb-1">Home state (for state quotas)</label>
          <select id="homeState" value={form.homeState} onChange={(e) => set('homeState', e.target.value)} className="input-field">
            <option value="">Not specified</option>
            {INDIAN_STATES_AND_UTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="branches" className="text-sm font-semibold text-slate-700 block mb-1">Preferred branches (optional)</label>
          <input id="branches" value={form.branches} onChange={(e) => set('branches', e.target.value)} className="input-field"
            placeholder="e.g. Computer, Electronics" />
        </div>

        <div>
          <label htmlFor="maxFees" className="text-sm font-semibold text-slate-700 block mb-1">Maximum annual fees in ₹ (optional)</label>
          <input id="maxFees" inputMode="numeric" value={form.maxFees} onChange={(e) => set('maxFees', e.target.value.replace(/\D/g, ''))}
            className="input-field" placeholder="e.g. 300000" />
        </div>

        <div className="md:col-span-2 flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.isPwd === 'true'} onChange={(e) => set('isPwd', String(e.target.checked))} />
            I am a PwD candidate
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.includeUnlikely === 'true'} onChange={(e) => set('includeUnlikely', String(e.target.checked))} />
            Also show unlikely options
          </label>
        </div>
        {form.isPwd === 'true' && exam.kind === 'rank' && (
          <div>
            <label htmlFor="pwdRank" className="text-sm font-semibold text-slate-700 block mb-1">PwD rank (within your category)</label>
            <input id="pwdRank" inputMode="numeric" value={form.pwdRank} onChange={(e) => set('pwdRank', e.target.value.replace(/\D/g, ''))} className="input-field" />
            {err('pwdRank')}
          </div>
        )}

        <div className="md:col-span-2">
          <button type="submit" disabled={loading} className="btn-primary w-full !h-[48px]">
            {loading ? 'Estimating…' : 'Estimate my chances'}
          </button>
        </div>
      </form>

      {data && !data.meta.hasData && (
        <div className="card-premium p-6 max-w-3xl">
          <h2 className="text-lg font-bold text-slate-900 mb-2">No official cutoff data loaded for this exam yet</h2>
          <p className="text-slate-700">
            We only make estimates from published closing ranks, and none have been imported for this exam. Until then, use
            the opening and closing ranks published on{' '}
            <a href="https://josaa.nic.in" target="_blank" rel="noopener noreferrer" className="text-indigo-700 font-semibold">JoSAA</a> or{' '}
            <a href="https://mcc.nic.in" target="_blank" rel="noopener noreferrer" className="text-indigo-700 font-semibold">MCC</a>.
          </p>
        </div>
      )}

      {data && data.meta.hasData && (
        <section aria-live="polite">
          <div role="note" className="max-w-3xl mb-6 p-4 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-950">
            <p className="font-semibold mb-1">Read this first</p>
            <p>{data.meta.disclaimer}</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              {data.meta.assumptions.map((a) => <li key={a}>{a}</li>)}
            </ul>
            <p className="mt-2">Data up to {data.meta.latestDataYear}; estimates are for {data.meta.targetYear}.</p>
            <details className="mt-1">
              <summary className="cursor-pointer underline">How this works</summary>
              <p className="mt-1">{data.meta.method}</p>
            </details>
          </div>

          {data.results.length === 0 ? (
            <p className="text-slate-700">No matching seats with a meaningful chance. Try removing filters or showing unlikely options.</p>
          ) : (
            (Object.keys(grouped) as Band[]).filter((b) => grouped[b].length).map((band) => (
              <div key={band} className="mb-8">
                <h2 className="text-xl font-bold text-slate-900 mb-1">
                  {BAND_STYLE[band].label} <span className="text-slate-500 font-normal text-base">({grouped[band].length})</span>
                </h2>
                <p className="text-sm text-slate-600 mb-3">{BAND_STYLE[band].help}</p>
                <ul className="grid gap-4 md:grid-cols-2">
                  {grouped[band].map((r) => (
                    <li key={r.program.id} className="card-enterprise p-5">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <Link href={`/colleges/${r.college.slug}`} className="font-bold text-slate-900 hover:text-indigo-700 no-underline">
                          {r.college.name}
                        </Link>
                        <span className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-semibold ${BAND_STYLE[r.band].className}`}>
                          {BAND_STYLE[r.band].label} · ~{Math.round(r.probability * 100)}%
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{r.program.branch ?? r.program.name}</p>
                      <p className="text-xs text-slate-500 mb-2">
                        {r.college.city}, {r.college.state} · {r.seat.quota} quota · {getCategoryLabel(r.seat.category)}
                        {r.seat.isPwd ? ' (PwD)' : ''} · {r.seat.seatPool === 'FEMALE_ONLY' ? 'Female-only' : 'Gender-neutral'} ·
                        confidence {r.confidence.toLowerCase()}
                      </p>
                      {r.college.dataStatus === 'DEMO' && <DataStatusBadge status="DEMO" className="mb-2" />}
                      <details>
                        <summary className="text-sm text-indigo-700 cursor-pointer">Why this estimate?</summary>
                        <p className="text-sm text-slate-700 mt-2">{r.explanation}</p>
                        <p className="text-xs text-slate-500 mt-2">
                          Sources:{' '}
                          {[...new Map(r.history.map((h) => [h.source.url + h.source.name, h.source])).values()].map((s, i) => (
                            <span key={i}>
                              {i > 0 && '; '}
                              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-indigo-700">{s.name}</a>
                            </span>
                          ))}
                        </p>
                      </details>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
          {data.total > data.results.length && (
            <p className="text-sm text-slate-600">Showing {data.results.length} of {data.total} options. Narrow by branch or state to see others.</p>
          )}
        </section>
      )}
    </div>
  );
}

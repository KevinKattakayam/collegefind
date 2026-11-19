'use client';

export default function CutoffsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="container-main py-8">
    <h1 className="text-3xl font-black">Cutoff records are temporarily unavailable</h1>
    <p role="alert" className="mt-3 text-slate-700">The explorer could not load reviewed cutoff data. Your filters are still in the address bar; retry in a moment.</p>
    <button type="button" onClick={() => reset()} className="btn-primary mt-5">Retry loading cutoff records</button>
  </main>;
}

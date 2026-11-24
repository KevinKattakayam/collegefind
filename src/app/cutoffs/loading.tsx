export default function CutoffsLoading() {
  return <main className="container-main py-8" aria-busy="true" aria-live="polite">
    <h1 className="text-3xl font-black">Loading cutoff explorer</h1>
    <p role="status" className="mt-3 text-sm text-slate-600">Loading reviewed cutoff records and filters…</p>
    <div aria-hidden="true" className="mt-7 h-48 animate-pulse rounded-xl bg-slate-100" />
  </main>;
}

export default function CollegeProfileLoading() {
  return <main className="container-main py-10" aria-busy="true" aria-live="polite">
    <h1 className="text-3xl font-black">Loading college profile</h1>
    <p role="status" className="mt-3 text-sm text-slate-600">Loading reviewed college information and sources…</p>
    <div aria-hidden="true" className="mt-7 grid gap-4 md:grid-cols-2"><div className="h-40 animate-pulse rounded-xl bg-slate-100" /><div className="h-40 animate-pulse rounded-xl bg-slate-100" /></div>
  </main>;
}

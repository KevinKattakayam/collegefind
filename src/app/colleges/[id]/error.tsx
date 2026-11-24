'use client';

export default function CollegeProfileError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="container-main py-10">
    <h1 className="text-3xl font-black">College profile is temporarily unavailable</h1>
    <p role="alert" className="mt-3 text-slate-700">Reviewed profile information could not be loaded. Try again shortly; we will not substitute missing or demo facts.</p>
    <button type="button" onClick={() => reset()} className="btn-primary mt-5">Retry loading profile</button>
  </main>;
}

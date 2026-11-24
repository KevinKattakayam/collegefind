'use client';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="container-main space-y-4 py-8">
    <h1 className="text-2xl font-bold">College evidence is temporarily unavailable</h1>
    <p role="alert">Try loading this page again.</p>
    <button type="button" className="btn-primary" onClick={reset}>Try again</button>
  </div>;
}

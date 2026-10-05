import type { Metadata } from 'next';
import Breadcrumb from '@/components/Breadcrumb';
import { OFFICIAL_RESOURCES } from '@/content/exams';

export const metadata: Metadata = {
  title: 'Official sources',
  description: 'Official government and counselling websites for Indian college admissions.',
};

/**
 * Replaces a page of invented news headlines. Until there is an editorial
 * process (author, date, sources, review), we link to primary sources only.
 */
export default function ArticlesPage() {
  return (
    <div className="container-main py-6 max-w-3xl">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Official sources' }]} />
      <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Official sources</h1>
      <p className="text-slate-600 mb-8">
        For dates, rules and results, go to the source. These are the official websites our data is built from or that
        decide admissions.
      </p>
      <ul className="space-y-4">
        {OFFICIAL_RESOURCES.map((r) => (
          <li key={r.url} className="card-premium p-5">
            <h2 className="text-lg font-bold text-slate-900">
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-indigo-700">{r.name}</a>
            </h2>
            <p className="text-sm text-slate-700">{r.what}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumb from '@/components/Breadcrumb';
import { EXAMS } from '@/content/exams';

export const metadata: Metadata = {
  title: 'Entrance exams',
  description: 'What each major entrance exam leads to, how its score is used, and links to official websites.',
};

export default function ExamsPage() {
  return (
    <div className="container-main py-6">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Exams' }]} />
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Entrance exams</h1>
        <p className="text-base text-slate-600 max-w-2xl">
          We do not list exam dates here because they change every year. Use the official websites below for dates,
          eligibility and registration.
        </p>
      </header>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {EXAMS.map((e) => (
          <li key={e.id} className="card-premium p-5">
            <h2 className="text-lg font-bold text-slate-900">
              <Link href={`/exams/${e.id}`} className="no-underline text-slate-900 hover:text-indigo-700">{e.name}</Link>
            </h2>
            <p className="text-sm text-slate-600 mb-2">Conducted by {e.conductingBody}</p>
            <p className="text-sm text-slate-700">{e.leadsTo}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

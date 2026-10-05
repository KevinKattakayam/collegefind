import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Breadcrumb from '@/components/Breadcrumb';
import { EXAMS } from '@/content/exams';

export function generateStaticParams() {
  return EXAMS.map((e) => ({ id: e.id }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const exam = EXAMS.find((e) => e.id === id);
  return exam ? { title: exam.name, description: exam.leadsTo } : {};
}

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exam = EXAMS.find((e) => e.id === id);
  if (!exam) notFound();
  const predictorSupported = exam.type === 'JEE_MAIN' || exam.type === 'JEE_ADVANCED' || exam.type === 'NEET';

  return (
    <div className="container-main py-6 max-w-3xl">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Exams', href: '/exams' }, { label: exam.name }]} />
      <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-1">{exam.name}</h1>
      <p className="text-slate-600 mb-6">Conducted by {exam.conductingBody}</p>

      <section className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 mb-2">What it leads to</h2>
        <p className="text-slate-700 leading-relaxed">{exam.leadsTo}</p>
      </section>
      <section className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 mb-2">How your result is used</h2>
        <p className="text-slate-700 leading-relaxed">{exam.howToReadScore}</p>
        {exam.notes && <p className="text-slate-700 leading-relaxed mt-2">{exam.notes}</p>}
      </section>
      <section className="card-premium p-5 mb-6">
        <h2 className="text-lg font-bold text-slate-900 mb-3">Official links</h2>
        <ul className="space-y-2 text-sm">
          {exam.officialSite ? (
            <li>
              Exam website:{' '}
              <a href={exam.officialSite.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-700">
                {exam.officialSite.label}
              </a>
            </li>
          ) : (
            <li>The exam website changes each year; find it through the organising institute.</li>
          )}
          {exam.counselling.map((c) => (
            <li key={c.url}>
              Counselling:{' '}
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-700">{c.label}</a>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500 mt-3">
          Link last checked: {exam.verified}. If a link is wrong, please report it.
        </p>
      </section>
      {predictorSupported && (
        <Link href={`/predictor?exam=${exam.type}`} className="btn-primary inline-flex no-underline">
          Estimate my chances with {exam.name} cutoffs
        </Link>
      )}
    </div>
  );
}

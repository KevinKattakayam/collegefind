import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumb from '@/components/Breadcrumb';
import { COURSES } from '@/content/courses';

export const metadata: Metadata = {
  title: 'Courses',
  description: 'What common Indian degree courses involve, typical eligibility and the entrance exams they use.',
};

export default function CoursesPage() {
  return (
    <div className="container-main py-6">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Courses' }]} />
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Courses</h1>
        <p className="text-base text-slate-600 max-w-2xl">
          A plain-language overview of common degrees. Eligibility rules change every year, so always confirm with the
          official information bulletin.
        </p>
      </header>
      <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {COURSES.map((c) => (
          <li key={c.slug}>
            <Link href={`/courses/${c.slug}`} className="card-premium p-5 block no-underline h-full">
              <h2 className="text-lg font-bold text-slate-900">{c.name}</h2>
              <p className="text-sm text-slate-600 mb-2">{c.fullName} · {c.level} · {c.duration}</p>
              <p className="text-sm text-slate-700">{c.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

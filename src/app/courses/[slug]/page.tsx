import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Breadcrumb from '@/components/Breadcrumb';
import CollegeCard from '@/components/CollegeCard';
import { COURSES, getCourse } from '@/content/courses';
import { prisma } from '@/lib/prisma';
import { collegeListSelect } from '@/server/colleges';
import type { College } from '@/types';

export const revalidate = 3600;

export function generateStaticParams() {
  return COURSES.map((c) => ({ slug: c.slug }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const course = getCourse((await params).slug);
  return course ? { title: `${course.name} — ${course.fullName}`, description: course.description } : {};
}

async function collegesOffering(filter: string): Promise<College[] | null> {
  try {
    const rows = await prisma.college.findMany({
      where: { courses: { has: filter } },
      select: collegeListSelect,
      orderBy: [{ dataStatus: 'desc' }, { name: 'asc' }],
      take: 9,
    });
    return rows as College[];
  } catch {
    return null; // DB unavailable at build/render time: page still renders its content
  }
}

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const course = getCourse((await params).slug);
  if (!course) notFound();
  const colleges = await collegesOffering(course.courseFilter);

  return (
    <div className="container-main py-6">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Courses', href: '/courses' }, { label: course.name }]} />
      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">{course.name}</h1>
        <p className="text-slate-600">{course.fullName} · {course.level} · {course.duration}</p>
      </header>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">What it involves</h2>
            <p className="text-slate-700 leading-relaxed">{course.description}</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Eligibility (summary)</h2>
            <p className="text-slate-700 leading-relaxed">{course.eligibility}</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Common career paths</h2>
            <p className="text-slate-700">{course.careerPaths.join(', ')}.</p>
          </section>
        </div>
        <aside className="card-premium p-5 h-fit">
          <h2 className="text-base font-bold text-slate-900 mb-2">Typical entrance exams</h2>
          <p className="text-sm text-slate-700 mb-3">{course.typicalExams.join(', ')}</p>
          <Link href="/exams" className="text-sm font-semibold text-indigo-700">Official exam links</Link>
        </aside>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Colleges listing {course.name}</h2>
        {colleges === null ? (
          <p className="text-slate-600">College list is temporarily unavailable.</p>
        ) : colleges.length === 0 ? (
          <p className="text-slate-600">No colleges in our catalogue list this course yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {colleges.map((c) => <CollegeCard key={c.id} college={c} />)}
            </div>
            <Link href={`/colleges?courses=${encodeURIComponent(course.courseFilter)}`} className="inline-block mt-6 font-semibold text-indigo-700">
              See all colleges listing {course.name}
            </Link>
          </>
        )}
      </section>
    </div>
  );
}

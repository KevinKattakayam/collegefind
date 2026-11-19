import type { Metadata } from 'next';
import type { College } from '@/types';
import Link from 'next/link';
import CutoffTable from '@/components/college/CutoffTable';
import { prisma } from '@/lib/prisma';
import { collegeKeySchema, guidanceQuerySchema } from '@/lib/validation';
import { cutoffQuerySchema, findPublicRankObservation } from '@/server/cutoffs';
import { getExamLabel } from '@/lib/utils';
import { collegeListSelect } from '@/server/colleges';
import RankComparison from './RankComparison';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admission guidance', description: 'Check documented requirements and compare your rank with a reviewed historical cutoff.' };

export default async function PredictorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const selected = guidanceQuerySchema.safeParse(raw);
  const row = selected.success ? await findPublicRankObservation(prisma, selected.data.cutoff) : null;
  const collegeKey = collegeKeySchema.safeParse(raw.college);
  const slug = row?.college.slug ?? (collegeKey.success ? collegeKey.data : undefined);
  const college: College | null = slug ? await prisma.college.findUnique({ where: { slug }, select: collegeListSelect }) : null;
  const programme = row?.program.name.trim().toLowerCase();
  const requirements = (college?.dataStatus !== 'DEMO' ? college?.structuredFacts ?? [] : []).flatMap((fact) => {
    const value = fact.value;
    return value.kind === 'admission' && value.eligibility &&
      (!programme || programme === value.programme.trim().toLowerCase()) ? [{ ...fact, value }] : [];
  });
  const exam = cutoffQuerySchema.safeParse({ exam: raw.exam });
  const examCode = exam.success ? exam.data.exam : undefined;
  const filters = new URLSearchParams({ ...(examCode ? { exam: examCode } : {}), metric: 'RANK', ...(college ? { college: college.slug } : {}) });
  const explorer = `/cutoffs?${filters}`;
  return <div className="container-main space-y-6 py-8">
    <h1 className="text-3xl font-black">Admission guidance</h1>
    <section className="space-y-2 rounded-xl border p-4">
      <h2 className="text-xl font-bold">Eligibility Not Confirmed</h2>
      <p>Check the published requirements for your programme, campus and application cycle. Confirm exam, qualifications, documents and quota rules with the counselling authority or institution.</p>
      {requirements.length > 0 && <ul className="space-y-3">
        {requirements.map(({ key, value, source, academicYear }) => <li key={key} className="break-words">
          <strong>{value.programme} · {value.category} · {academicYear ?? 'Year not published'}</strong>
          <p>{value.route}{value.exam ? ` · ${value.exam}` : ''}</p>
          <p>{value.eligibility}</p>
          <a className="text-indigo-700 underline" href={source.url}>{source.publisher}</a>
        </li>)}
      </ul>}
      {college ? <Link className="text-indigo-700 underline" href={`/colleges/${college.slug}#programmes-and-admissions`}>Open {college.name} programmes and admissions</Link>
        : <Link className="text-indigo-700 underline" href="/colleges">Find a college and its published admission requirements</Link>}
    </section>
    <section className="space-y-3 rounded-xl border p-4">
      <h2 className="text-xl font-bold">Historical rank comparison{examCode && !row ? ` · ${getExamLabel(examCode)}` : ''}</h2>
      {row ? <>
        <CutoffTable rows={[row]} showCollege showGuidance={false} />
        <RankComparison key={row.id} opening={row.openingValue} closing={row.closingValue} />
      </> : <>
        <h3 className="font-bold">Insufficient Verified Evidence</h3>
        {raw.cutoff && !selected.success && <p role="alert">The cutoff link is invalid.</p>}
        <p>Select a reviewed rank record in the cutoff explorer. A comparison requires a published rank definition and counselling system.</p>
      </>}
      <Link className="inline-block text-indigo-700 underline" href={row ? `/cutoffs?college=${row.college.slug}&exam=${row.exam}&metric=RANK` : explorer}>Open the cutoff explorer</Link>
    </section>
    <section className="space-y-2">
      <h2 className="text-xl font-bold">Future admission</h2>
      <p>Future admission probability is unavailable. Ranks and seat allocation can change each cycle.</p>
      <Link className="text-indigo-700 underline" href="/collegefit">Explore colleges by preference</Link>
    </section>
  </div>;
}

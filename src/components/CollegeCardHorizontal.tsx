'use client';
import Link from 'next/link';
import type { College } from '@/types';
import { formatINR, formatPct, formatLPA } from '@/lib/utils';
import { useCompare } from '@/context/CompareContext';
import { useSaveCollege } from '@/hooks/useSaveCollege';
import DataStatusBadge from './DataStatusBadge';

interface Props {
  college: College;
  savedIds?: string[];
  onToggleSave?: (id: string, saved: boolean) => void;
}

export default function CollegeCardHorizontal({ college, savedIds = [], onToggleSave }: Props) {
  const { addToCompare, isInCompare } = useCompare();
  const { isSaved, pending, toggle } = useSaveCollege(college.id, savedIds.includes(college.id), onToggleSave);
  const href = `/colleges/${college.slug ?? college.id}`;
  const inCompare = isInCompare(college.id);

  return (
    <article className="card-enterprise p-5 flex flex-col md:flex-row gap-4 md:items-center">
      <div className="flex-1 min-w-0">
        <Link href={href} className="no-underline">
          <h3 className="text-lg font-bold text-slate-800 hover:text-indigo-700">{college.name}</h3>
        </Link>
        <p className="text-sm text-slate-600 mt-1">
          {college.city}, {college.state}
          {college.establishedYear ? ` · Est. ${college.establishedYear}` : ''}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {college.type === 'GOVERNMENT' ? <span className="badge-green">Government</span> : <span className="badge-gray">Private</span>}
          {college.naacGrade && <span className="badge-blue">NAAC {college.naacGrade}</span>}
          <DataStatusBadge status={college.dataStatus} />
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-4 text-center md:w-[360px]">
        <div>
          <dt className="text-xs text-slate-500">Fees / yr</dt>
          <dd className="font-bold text-slate-800">{formatINR(college.annualFees)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Placement</dt>
          <dd className="font-bold text-slate-800">{formatPct(college.placementPct)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Avg package</dt>
          <dd className="font-bold text-slate-800">{formatLPA(college.avgPackage)}</dd>
        </div>
      </dl>
      <div className="flex gap-2 md:flex-col md:w-[130px]">
        <Link href={href} className="btn-primary text-sm flex-1 text-center no-underline">Details</Link>
        <button type="button" onClick={() => addToCompare(college)} aria-pressed={inCompare}
          className={`flex-1 text-sm rounded-lg h-[40px] font-semibold ${inCompare ? 'bg-indigo-600 text-white' : 'border-2 border-indigo-400 text-indigo-700 hover:bg-indigo-50'}`}>
          {inCompare ? 'In compare' : 'Compare'}
        </button>
        <button type="button" onClick={toggle} disabled={pending} aria-pressed={isSaved}
          className="flex-1 text-sm rounded-lg h-[40px] font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50">
          {isSaved ? 'Saved' : 'Save'}
        </button>
      </div>
    </article>
  );
}

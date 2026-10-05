'use client';
import Link from 'next/link';
import type { College } from '@/types';
import { formatINR, formatPct } from '@/lib/utils';
import { useCompare } from '@/context/CompareContext';
import { useSaveCollege } from '@/hooks/useSaveCollege';
import DataStatusBadge from './DataStatusBadge';

interface Props {
  college: College;
  savedIds?: string[];
  onToggleSave?: (id: string, saved: boolean) => void;
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill={filled ? '#4F46E5' : 'none'} stroke={filled ? '#4F46E5' : '#64748B'} strokeWidth="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function CollegeCard({ college, savedIds = [], onToggleSave }: Props) {
  const { addToCompare, isInCompare } = useCompare();
  const { isSaved, pending, toggle } = useSaveCollege(college.id, savedIds.includes(college.id), onToggleSave);
  const href = `/colleges/${college.slug ?? college.id}`;
  const inCompare = isInCompare(college.id);
  const coursesShown = college.courses.slice(0, 3);
  const moreCount = college.courses.length - coursesShown.length;
  const isDemo = college.dataStatus === 'DEMO';

  return (
    <article className="card-enterprise relative flex flex-col p-5 min-h-[300px]">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={isSaved}
        aria-label={isSaved ? `Remove ${college.name} from saved` : `Save ${college.name}`}
        className="absolute top-4 right-4 z-10 p-1.5 rounded-lg hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
      >
        <BookmarkIcon filled={isSaved} />
      </button>

      <Link href={href} className="no-underline flex-1 flex flex-col">
        <h3 className="text-lg font-bold text-slate-800 hover:text-indigo-700 line-clamp-2 pr-10 mb-2">{college.name}</h3>
        <p className="text-sm text-slate-600 mb-3">
          {college.city}, {college.state}
        </p>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {college.type === 'GOVERNMENT' ? <span className="badge-green">Government</span> : <span className="badge-gray">Private</span>}
          {college.naacGrade && <span className="badge-blue">NAAC {college.naacGrade}</span>}
          <DataStatusBadge status={college.dataStatus} />
        </div>

        <dl className="grid grid-cols-2 gap-2 text-sm mb-3">
          <div>
            <dt className="text-xs text-slate-500">Annual fees{isDemo ? ' (demo)' : ''}</dt>
            <dd className="font-semibold text-slate-800">{formatINR(college.annualFees)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Placement{isDemo ? ' (demo)' : ''}</dt>
            <dd className="font-semibold text-slate-800">{formatPct(college.placementPct)}</dd>
          </div>
        </dl>

        {coursesShown.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {coursesShown.map((c) => (
              <span key={c} className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-medium">{c}</span>
            ))}
            {moreCount > 0 && <span className="text-xs text-slate-500 self-center">+{moreCount} more</span>}
          </div>
        )}
      </Link>

      <div className="flex gap-2.5 mt-auto">
        <Link href={href} className="btn-primary flex-1 text-sm no-underline text-center">View details</Link>
        <button
          type="button"
          onClick={() => addToCompare(college)}
          aria-pressed={inCompare}
          className={`flex-1 text-sm rounded-lg h-[40px] font-semibold transition-colors ${
            inCompare ? 'bg-indigo-600 text-white' : 'border-2 border-indigo-400 text-indigo-700 hover:bg-indigo-50'
          }`}
        >
          {inCompare ? 'In compare' : 'Compare'}
        </button>
      </div>
    </article>
  );
}

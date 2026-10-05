'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useCompare } from '@/context/CompareContext';
import SearchModal from '@/components/SearchModal';
import RadarChart from '@/components/RadarChart';
import type { College } from '@/types';
import { postJson } from '@/lib/api';
import { formatCount, formatINR, formatLPA, formatPct } from '@/lib/utils';
import Link from 'next/link';
import Breadcrumb from '@/components/Breadcrumb';
import toast from 'react-hot-toast';

type Best = 'min' | 'max';
interface Metric {
  key: string;
  label: string;
  format: (c: College) => string;
  value?: (c: College) => number | null;
  best?: Best;
}

const METRICS: Metric[] = [
  { key: 'dataStatus', label: 'Data status', format: (c) => (c.dataStatus === 'DEMO' ? 'Demo values' : c.dataStatus === 'VERIFIED' ? 'Verified' : 'Unverified') },
  { key: 'city', label: 'Location', format: (c) => `${c.city}, ${c.state}` },
  { key: 'type', label: 'Type', format: (c) => (c.type === 'GOVERNMENT' ? 'Government' : 'Private') },
  { key: 'naacGrade', label: 'NAAC grade', format: (c) => c.naacGrade ?? 'Not available' },
  { key: 'establishedYear', label: 'Established', format: (c) => (c.establishedYear ? String(c.establishedYear) : 'Not available') },
  { key: 'totalStudents', label: 'Students', format: (c) => formatCount(c.totalStudents) },
  { key: 'annualFees', label: 'Annual fees', format: (c) => formatINR(c.annualFees), value: (c) => c.annualFees, best: 'min' },
  { key: 'placementPct', label: 'Placement %', format: (c) => formatPct(c.placementPct), value: (c) => c.placementPct, best: 'max' },
  { key: 'avgPackage', label: 'Average package', format: (c) => formatLPA(c.avgPackage), value: (c) => c.avgPackage, best: 'max' },
  { key: 'highestPackage', label: 'Highest package', format: (c) => formatLPA(c.highestPackage), value: (c) => c.highestPackage, best: 'max' },
  { key: 'topRecruiters', label: 'Recruiters', format: (c) => c.topRecruiters.slice(0, 3).join(', ') || 'Not available' },
  { key: 'coursesList', label: 'Courses listed', format: (c) => c.courses.slice(0, 4).join(', ') || 'Not available' },
];

/** Index of the best known value, or -1 if fewer than two colleges have a value. */
function bestIndex(list: College[], m: Metric): number {
  if (!m.value || !m.best) return -1;
  const known = list.map((c, i) => ({ i, v: m.value!(c) })).filter((x): x is { i: number; v: number } => x.v !== null);
  if (known.length < 2) return -1;
  return known.reduce((best, x) => ((m.best === 'min' ? x.v < best.v : x.v > best.v) ? x : best)).i;
}

export default function ComparePage() {
  const { compareList, addToCompare, removeFromCompare, clearCompare } = useCompare();
  const [modalSlot, setModalSlot] = useState<number | null>(null);
  const { data: session } = useSession();
  const [saving, setSaving] = useState(false);
  const hasDemo = compareList.some((c) => c.dataStatus === 'DEMO');

  const getBestIndex = (key: string) => {
    const m = METRICS.find((x) => x.key === key);
    return m ? bestIndex(compareList, m) : -1;
  };

  // Plain factual statements only where every compared college has a value.
  const generateVerdict = () => {
    if (compareList.length < 2) return [];
    const out: string[] = [];
    const fees = METRICS.find((m) => m.key === 'annualFees')!;
    const i = bestIndex(compareList, fees);
    if (i >= 0) out.push(`Lowest listed annual fees: ${compareList[i].shortName} (${formatINR(compareList[i].annualFees)})`);
    const placement = METRICS.find((m) => m.key === 'placementPct')!;
    const j = bestIndex(compareList, placement);
    if (j >= 0) out.push(`Highest listed placement rate: ${compareList[j].shortName} (${formatPct(compareList[j].placementPct)})`);
    const pkg = METRICS.find((m) => m.key === 'avgPackage')!;
    const k = bestIndex(compareList, pkg);
    if (k >= 0) out.push(`Highest listed average package: ${compareList[k].shortName} (${formatLPA(compareList[k].avgPackage)})`);
    return out;
  };

  const handleShareComparison = () => {
    const names = compareList.map(c => c.shortName).join(' vs ');
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: `Compare: ${names}`, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Comparison link copied!', { icon: '📋' });
    }
  };

  const slots = [0, 1, 2];

  const handleSaveComparison = async () => {
    if (!session) {
      toast.error('Please login to save comparisons', { icon: '🔒' });
      return;
    }
    if (compareList.length < 2) {
      toast.error('Add at least 2 colleges to save', { icon: '⚠️' });
      return;
    }

    setSaving(true);
    try {
      await postJson('/api/comparisons', { collegeIds: compareList.map((c) => c.id) });
      toast.success('Comparison saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save comparison');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-main py-6">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Compare' }]} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1E293B]">Compare Colleges</h1>
          <p className="text-sm text-slate-600 mt-1">Side by side. Highlights only compare values that are known for every college.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {compareList.length >= 2 && (
            <>
              <button onClick={handleShareComparison} className="btn-outlined text-sm !h-[36px] !px-3 flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                Share
              </button>
              <button onClick={handleSaveComparison} disabled={saving} className="btn-primary text-sm !h-[36px]">
                {saving ? 'Saving...' : '💾 Save'}
              </button>
            </>
          )}
          {compareList.length > 0 && <button onClick={clearCompare} className="btn-danger text-sm">Clear All</button>}
        </div>
      </div>

      {/* Slots */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {slots.map(i => {
          const college = compareList[i];
          return college ? (
            <div key={college.id} className="card-premium p-4 relative">
              <button onClick={() => removeFromCompare(college.id)} className="absolute top-2 right-2 text-[#94A3B8] hover:text-[#DC2626] transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
              <h3 className="font-bold text-lg text-[#1E293B] pr-6">{college.name}</h3>
              <p className="text-sm text-[#64748B]">{college.city}, {college.state}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-sm font-bold text-[#F97316]">★ {college.rating}</span>
                {college.type === 'GOVERNMENT' ? <span className="badge-green text-[10px]">Govt</span> : <span className="badge-red text-[10px]">Pvt</span>}
                <span className="badge-blue text-[10px]">{college.naacGrade}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#E2E8F0]">
                <div className="text-center">
                  <div className="text-xs text-[#64748B]">Fees</div>
                  <div className="text-xs font-bold text-[#1E3A8A]">{formatINR(college.annualFees)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-[#64748B]">Placed</div>
                  <div className="text-xs font-bold text-[#16A34A]">{college.placementPct}%</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-[#64748B]">Avg Pkg</div>
                  <div className="text-xs font-bold text-[#2563EB]">{formatLPA(college.avgPackage)}</div>
                </div>
              </div>
            </div>
          ) : (
            <button key={i} onClick={() => setModalSlot(i)}
              className="border-2 border-dashed border-[#CBD5E1] rounded-lg p-8 text-center hover:border-[#2563EB] hover:bg-[#F8FAFC] transition-all">
              <div className="text-3xl text-[#CBD5E1] mb-2">+</div>
              <div className="text-sm text-[#94A3B8] font-medium">{i === 2 ? 'Add a 3rd College' : 'Add College'}</div>
            </button>
          );
        })}
      </div>

      {/* Radar Chart */}
      {compareList.length >= 2 && (
        <div className="mb-8">
          <RadarChart colleges={compareList} />
        </div>
      )}

      {/* Verdict */}
      {compareList.length >= 2 && (
        <div className="card-premium p-6 mb-8">
          <h3 className="font-bold text-lg text-[#1E293B] mb-4 flex items-center gap-2">
            At a glance
          </h3>
          {hasDemo && (
            <p role="note" className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
              At least one college here has demo values. These comparisons are illustrative only.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {generateVerdict().map((v, i) => (
              <div key={i} className="bg-[#F8FAFC] rounded-lg p-3 text-sm text-[#475569]">
                {v}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparison Table */}
      {compareList.length >= 2 && (
        <div className="overflow-x-auto rounded-lg border border-[#E2E8F0]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1E3A8A]">
                <th className="text-left p-3 text-white font-bold text-xs min-w-[150px] sticky left-0 bg-[#1E3A8A] z-10">Metric</th>
                {compareList.map(c => (
                  <th key={c.id} className="text-center p-3 text-white font-bold text-xs min-w-[180px]">{c.shortName}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m, rowIdx) => {
                const bestIdx = getBestIndex(m.key);
                return (
                  <tr key={m.key} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'}>
                    <td className="p-3 font-medium text-[#475569] sticky left-0 bg-inherit z-10 border-r border-[#E2E8F0]">{m.label}</td>
                    {compareList.map((c, colIdx) => (
                      <td key={c.id} className={`p-3 text-center font-medium ${colIdx === bestIdx ? 'bg-[#F0FDF4] text-[#16A34A] font-bold' : 'text-[#1E293B]'}`}>
                        {m.format(c)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#E2E8F0]">
                <td className="p-3 sticky left-0 bg-white z-10" />
                {compareList.map(c => (
                  <td key={c.id} className="p-3 text-center">
                    <Link href={`/colleges/${c.id}`} className="text-[#2563EB] text-sm font-medium hover:underline no-underline">View Details</Link>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {compareList.length < 2 && (
        <div className="text-center py-12 text-[#94A3B8]">
          <p className="text-lg">Add at least 2 colleges to compare</p>
          <p className="text-sm mt-1">Click the + cards above or use the Compare button on college cards</p>
        </div>
      )}

      <SearchModal isOpen={modalSlot !== null} onClose={() => setModalSlot(null)} onSelect={(c) => { addToCompare(c); setModalSlot(null); }} />
    </div>
  );
}

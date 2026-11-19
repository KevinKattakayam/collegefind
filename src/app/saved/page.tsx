'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import CollegeCard from '@/components/CollegeCard';
import CollegeCardSkeleton from '@/components/CollegeCardSkeleton';
import Breadcrumb from '@/components/Breadcrumb';
import EmptyState from '@/components/EmptyState';
import { College, SavedComparison } from '@/types';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { apiJson } from '@/lib/api';
import { useShortlist } from '@/context/ShortlistContext';

function loadGuestColleges(slugs: string[]) {
  const pages: string[][] = [];
  for (let index = 0; index < slugs.length; index += 25) pages.push(slugs.slice(index, index + 25));
  return Promise.all(pages.map((page) => {
    const params = new URLSearchParams({ slugs: page.join(',') });
    return apiJson<{ colleges: College[] }>(`/api/colleges?${params}`);
  })).then((results) => results.flatMap((result) => result.colleges));
}

export default function SavedPage() {
  const { status } = useSession();
  const shortlist = useShortlist();
  const [saved, setSaved] = useState<College[]>([]);
  const [comparisons, setComparisons] = useState<SavedComparison[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      if (!shortlist.hydrated) return;
      const lookup = loadGuestColleges(shortlist.guestSlugs);
      lookup
        .then((colleges) => { setSaved(colleges); setComparisons([]); })
        .catch(() => setLoadError(true))
        .finally(() => setLoading(false));
      return;
    }
    if (status === 'authenticated') {
      const guestLookup = loadGuestColleges(shortlist.guestSlugs);
      Promise.all([
        apiJson<{ saved: College[] }>('/api/saved'),
        apiJson<{ comparisons: SavedComparison[] }>('/api/comparisons'),
        guestLookup,
      ])
        .then(([savedData, comparisonData, guestColleges]) => {
          const merged = [...savedData.saved, ...guestColleges.filter((college) => !savedData.saved.some((savedCollege) => savedCollege.id === college.id))];
          setSaved(merged);
          setComparisons(comparisonData.comparisons);
        })
        .catch(() => { setLoadError(true); toast.error('Could not load your saved items'); })
        .finally(() => setLoading(false));
    }
  }, [status, shortlist.hydrated, shortlist.guestSlugs]);

  const handleToggleSave = (id: string) => {
    setSaved(prev => prev.filter(c => c.id !== id));
  };

  const handleDeleteComparison = async (id: string) => {
    try {
      await apiJson(`/api/comparisons/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setComparisons(prev => prev.filter(c => c.id !== id));
      toast.success('Comparison removed');
    } catch {
      toast.error('Failed to delete comparison');
    }
  };

  if (status === 'loading' || (status === 'unauthenticated' && !shortlist.hydrated)) {
    return <div className="container-main py-6"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{Array(6).fill(0).map((_, i) => <CollegeCardSkeleton key={i} />)}</div></div>;
  }

  return (
    <div className="container-main py-6">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Saved Colleges' }]} />
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-3xl font-bold text-[#1E293B]">📑 My Saved Colleges</h1>
      </div>
      <p className="text-sm text-[#64748B] mb-6">{status === 'authenticated' ? `You have saved ${saved.length} colleges` : `${saved.length} saved on this device`}</p>
      {status === 'unauthenticated' && <p role="status" className="mb-5 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-900">This temporary shortlist is stored on this device. Sign in to sync it across your devices.</p>}

      {loadError ? <div role="alert" className="rounded-lg border border-red-200 p-4">Saved items are temporarily unavailable. <button type="button" className="underline" onClick={() => window.location.reload()}>Retry</button></div> : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => <CollegeCardSkeleton key={i} />)}
        </div>
      ) : saved.length === 0 && comparisons.length === 0 ? (
        <EmptyState icon="🔖" title="Nothing saved yet" description="Browse colleges, save your favorites, or save a comparison to see them here" actionLabel="Browse Colleges" actionHref="/colleges" />
      ) : (
        <div className="space-y-10">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#1E293B]">Saved Colleges</h2>
              <Link href="/colleges" className="text-sm text-[#2563EB] hover:underline no-underline">Browse more</Link>
            </div>
            {saved.length === 0 ? (
              <EmptyState icon="🔖" title="No saved colleges yet" description="Save a college from the listing or detail page" actionLabel="Browse Colleges" actionHref="/colleges" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {saved.map(c => (
                  <CollegeCard key={c.id} college={c} savedIds={saved.map(s => s.id)} onToggleSave={(id) => handleToggleSave(id)} />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#1E293B]">Saved Comparisons</h2>
            </div>
            {comparisons.length === 0 ? (
              <EmptyState icon="⚖️" title="No saved comparisons yet" description="Save a 2–3 college comparison from the compare page" actionLabel="Compare Colleges" actionHref="/compare" />
            ) : (
              <div className="space-y-3">
                {comparisons.map(comp => (
                  <div key={comp.id} className="bg-white rounded-lg border border-[#E2E8F0] p-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-[#1E293B] mb-1">Comparison of {comp.collegeIds.length} colleges</div>
                      <div className="text-sm text-[#64748B] mb-2">
                        {(comp.colleges || []).map(c => c.name).join(' • ')}
                      </div>
                      {comp.colleges?.length === comp.collegeIds.length && comp.colleges.length >= 2 ? (<Link href={`/compare?colleges=${(comp.colleges ?? []).map((c) => encodeURIComponent(c.slug)).join(',')}`} className="text-sm text-[#2563EB] hover:underline no-underline">Open compare page</Link>) : <p role="status" className="text-sm text-slate-600">One or more colleges are no longer available. Create a new comparison.</p>}
                    </div>
                    <button onClick={() => handleDeleteComparison(comp.id)} className="text-sm text-[#DC2626] hover:underline">Delete</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

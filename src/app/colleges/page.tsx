'use client';
import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import CollegeCard from '@/components/CollegeCard';
import CollegeCardHorizontal from '@/components/CollegeCardHorizontal';
import CollegeCardSkeleton from '@/components/CollegeCardSkeleton';
import FilterSidebar from '@/components/FilterSidebar';
import Pagination from '@/components/Pagination';
import CompareBar from '@/components/CompareBar';
import Breadcrumb from '@/components/Breadcrumb';
import EmptyState from '@/components/EmptyState';
import type { College, CollegesResponse, ViewMode } from '@/types';
import { apiJson } from '@/lib/api';
import { useSession } from 'next-auth/react';
import { useShortlist } from '@/context/ShortlistContext';

interface Filters {
  search: string;
  city: string;
  state: string;
  type: string;
  minFees: string;
  maxFees: string;
  naac: string[];
  minRating: string;
  courses: string[];
  programme: string;
  degrees: string[];
  eligibility: string;
  exams: string[];
  established: string;
  page: number;
  sort: string;
}

function parseFilters(sp: URLSearchParams): Filters {
  const list = (k: string) => (sp.get(k) ? sp.get(k)!.split(',').filter(Boolean) : []);
  const page = Number.parseInt(sp.get('page') ?? '1', 10);
  return {
    search: sp.get('search') ?? '',
    city: sp.get('city') ?? '',
    state: sp.get('state') ?? '',
    type: sp.get('type') ?? '',
    minFees: sp.get('minFees') ?? '',
    maxFees: sp.get('maxFees') ?? '',
    naac: list('naac'),
    minRating: sp.get('minRating') ?? '',
    courses: list('courses'),
    programme: sp.get('programme') ?? '',
    degrees: list('degrees'),
    eligibility: sp.get('eligibility') ?? '',
    exams: list('exams'),
    established: sp.get('established') ?? '',
    page: Number.isFinite(page) && page > 0 ? page : 1,
    sort: sp.get('sort') ?? 'name',
  };
}

function toApiQuery(f: Filters): string {
  const p = new URLSearchParams();
  (['search', 'city', 'state', 'type', 'minFees', 'maxFees', 'minRating', 'established', 'programme', 'eligibility'] as const).forEach((k) => {
    if (f[k]) p.set(k, f[k]);
  });
  (['naac', 'courses', 'exams', 'degrees'] as const).forEach((k) => {
    if (f[k].length) p.set(k, f[k].join(','));
  });
  p.set('page', String(f.page));
  p.set('sort', f.sort);
  return p.toString();
}

function hasTrustedFilter(filters: Filters) {
  return Boolean(filters.minFees || filters.maxFees || filters.naac.length || filters.courses.length || filters.programme || filters.degrees.length || filters.eligibility || filters.established || filters.exams.length || filters.minRating);
}

function CollegesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  const shortlist = useShortlist();

  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const mobileFilterRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const queryKey = searchParams.toString();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const [searchInput, setSearchInput] = useState(filters.search);
  const [result, setResult] = useState<{ key: string | null; data: CollegesResponse | null }>({ key: null, data: null });
  const [retry, setRetry] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const loading = result.key !== queryKey;
  const colleges = result.data?.colleges ?? [];
  const total = result.data?.total ?? 0;
  const totalPages = result.data?.totalPages ?? 0;

  const updateURL = useCallback((patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    const params = new URLSearchParams();
    Object.entries(next).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        if (value.length) params.set(key, value.join(','));
      } else if (key === 'page') {
        if (Number(value) > 1) params.set(key, String(value));
      } else if (key === 'sort') {
        if (value && value !== 'name') params.set(key, String(value));
      } else if (value) {
        params.set(key, String(value));
      }
    });
    router.push(`/colleges?${params.toString()}`, { scroll: false });
  }, [filters, router]);

  useEffect(() => {
    const controller = new AbortController();
    apiJson<CollegesResponse>(`/api/colleges?${toApiQuery(filters)}`, { signal: controller.signal })
      .then((data) => { setLoadError(false); setResult({ key: queryKey, data }); })
      .catch(() => {
        if (!controller.signal.aborted) { setLoadError(true); setResult({ key: queryKey, data: null }); }
      });
    return () => controller.abort();
  }, [filters, queryKey, retry]);

  useEffect(() => {
    apiJson<{ states: string[] }>('/api/colleges?distinct=states')
      .then((d) => setStates(d.states))
      .catch(() => setStates([]));
  }, []);

  useEffect(() => {
    if (!session) return;
    apiJson<{ saved: College[] }>('/api/saved')
      .then((d) => setSavedIds(d.saved.map((c) => c.id)))
      .catch(() => setSavedIds([]));
  }, [session, shortlist.guestSlugs]);

  useEffect(() => {
    if (searchInput === filters.search) return;
    const timer = setTimeout(() => updateURL({ search: searchInput, page: 1 }), 300);
    return () => clearTimeout(timer);
  }, [searchInput, filters.search, updateURL]);

  useEffect(() => {
    const syncFromLocation = () => setSearchInput(new URLSearchParams(window.location.search).get('search') ?? '');
    window.addEventListener('popstate', syncFromLocation);
    return () => window.removeEventListener('popstate', syncFromLocation);
  }, []);

  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = mobileFilterRef.current;
    const focusable = () => dialog ? [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')] : [];
    focusable()[0]?.focus();
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMobileFiltersOpen(false); return; }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    };
    window.addEventListener('keydown', handleKeys);
    return () => { window.removeEventListener('keydown', handleKeys); previousFocus?.focus(); };
  }, [mobileFiltersOpen]);

  const handleFilterChange = (newValues: Partial<Filters>) => {
    updateURL({ ...newValues, page: 1 });
  };

  const clearFilters = () => {
    router.push('/colleges');
    setSearchInput('');
  };

  return (
    <div className="container-main py-6">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Colleges' }]} />

      {/* Search bar */}
      <div className="search-premium relative mb-6">
        <svg className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input type="search" aria-label="Search colleges, cities, or states" value={searchInput} onChange={e => setSearchInput(e.target.value)}
          placeholder="Search colleges, cities, or states..."
          className="w-full h-[52px] pl-14 pr-5 text-base bg-transparent rounded-xl border-0 focus:outline-none text-slate-800 placeholder:text-slate-400" />
      </div>

      <div className="flex gap-6">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block w-[270px] shrink-0">
          <FilterSidebar
            values={{ city: filters.city, state: filters.state, type: filters.type, minFees: filters.minFees, maxFees: filters.maxFees, naac: filters.naac, minRating: filters.minRating, courses: filters.courses, programme: filters.programme, degrees: filters.degrees, eligibility: filters.eligibility, exams: filters.exams, established: filters.established }}
            onChange={handleFilterChange} onClear={clearFilters} states={states} />
        </div>

        {/* Mobile Filter Button */}
        <button onClick={() => setMobileFiltersOpen(true)} aria-expanded={mobileFiltersOpen} aria-controls="college-mobile-filter-sheet"
          className="lg:hidden fixed bottom-5 left-5 z-30 btn-primary shadow-modal flex items-center gap-2 !rounded-xl">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          Filters
        </button>

        {/* Mobile Filter Sheet */}
        {mobileFiltersOpen && (
          <>
            <div aria-hidden="true" className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setMobileFiltersOpen(false)} />
            <div ref={mobileFilterRef} id="college-mobile-filter-sheet" role="dialog" aria-modal="true" aria-labelledby="college-mobile-filter-title" className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl max-h-[75vh] overflow-y-auto p-5 lg:hidden animate-slide-up shadow-modal">
              <div className="flex justify-between items-center mb-5">
                <h2 id="college-mobile-filter-title" className="font-bold text-lg text-slate-900">Filters</h2>
                <button type="button" aria-label="Close filters" onClick={() => setMobileFiltersOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <FilterSidebar
                values={{ city: filters.city, state: filters.state, type: filters.type, minFees: filters.minFees, maxFees: filters.maxFees, naac: filters.naac, minRating: filters.minRating, courses: filters.courses, programme: filters.programme, degrees: filters.degrees, eligibility: filters.eligibility, exams: filters.exams, established: filters.established }}
                onChange={(v) => { handleFilterChange(v); setMobileFiltersOpen(false); }} onClear={() => { clearFilters(); setMobileFiltersOpen(false); }} states={states} />
            </div>
          </>
        )}

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-5 gap-3">
            <span className="text-sm text-slate-500" aria-live="polite" aria-atomic="true">
              <span className="font-semibold text-slate-700">{total}</span> colleges found
            </span>
            <div className="flex items-center gap-2.5">
              {/* View toggle */}
              <div className="hidden md:flex items-center border border-slate-200 rounded-lg overflow-hidden">
                <button onClick={() => setViewMode('grid')}
                  className={`p-2 transition-all duration-200 ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                  title="Grid view">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                  </svg>
                </button>
                <button onClick={() => setViewMode('list')}
                  className={`p-2 transition-all duration-200 ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                  title="List view">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                  </svg>
                </button>
              </div>

              <select aria-label="Sort colleges" value={filters.sort} onChange={e => updateURL({ sort: e.target.value, page: 1 })}
                className="input-field !w-auto !h-[36px] text-sm !rounded-lg">
                <option value="name">Name A–Z</option>
                <option value="fees_asc">Fees Low→High</option>
                <option value="fees_desc">Fees High→Low</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          </div>

          {hasTrustedFilter(filters) && !loading && !loadError && <p role="note" className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">These filters match current, reviewed source-backed information only. Colleges with unknown or unreviewed values are excluded from matching; an absent result does not mean the college does not offer the programme or attribute.</p>}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array(12).fill(0).map((_, i) => <CollegeCardSkeleton key={i} />)}
            </div>
          ) : loadError ? (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-900">
              <p>We could not load colleges. Check your connection and try again.</p>
              <button type="button" className="mt-3 underline" onClick={() => setRetry((v) => v + 1)}>Retry</button>
            </div>
          ) : colleges.length === 0 ? (
            <>
              <EmptyState icon="🔍" title="No colleges found" description="Try adjusting your filters or search query" actionLabel="Clear Filters" onAction={clearFilters} />
            </>
          ) : (
            <>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {colleges.map(c => <CollegeCard key={`${c.id}-${savedIds.includes(c.id)}`} college={c} savedIds={savedIds} />)}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {colleges.map(c => <CollegeCardHorizontal key={`${c.id}-${savedIds.includes(c.id)}`} college={c} savedIds={savedIds} />)}
                </div>
              )}
              <Pagination currentPage={filters.page} totalPages={totalPages} totalItems={total} itemsPerPage={12}
                onPageChange={(p) => { updateURL({ page: p }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
            </>
          )}
        </div>
      </div>

      <CompareBar />
    </div>
  );
}

export default function CollegesPage() {
  return (
    <Suspense fallback={<div className="container-main py-6"><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">{Array(12).fill(0).map((_, i) => <CollegeCardSkeleton key={i} />)}</div></div>}>
      <CollegesContent />
    </Suspense>
  );
}

'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { College, CollegesResponse } from '@/types';
import { apiJson } from '@/lib/api';

export default function SearchAutocomplete({ className }: { className?: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<College[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced search. State is only set inside the timer callback (not
  // synchronously in the effect body) to avoid cascading renders.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const d = await apiJson<CollegesResponse>(`/api/colleges?search=${encodeURIComponent(term)}&page=1&limit=6`, { signal: controller.signal });
        setResults(d.colleges);
        setOpen(true);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const handleSelect = (college: College) => {
    setOpen(false);
    setQuery('');
    router.push(`/colleges/${college.slug ?? college.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIdx >= 0 && results[selectedIdx]) handleSelect(results[selectedIdx]);
      else if (query.trim()) { setOpen(false); router.push(`/colleges?search=${encodeURIComponent(query.trim())}`); }
    }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={ref} className={`relative ${className || ''}`}>
      <div className="search-premium relative">
        <svg className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input ref={inputRef} type="text" value={query} onChange={e => { const v = e.target.value; setQuery(v); setSelectedIdx(-1); if (v.trim().length < 2) { setResults([]); setOpen(false); } }}
          aria-label="Search colleges by name, city or state" role="combobox" aria-expanded={open && results.length > 0} aria-controls="college-search-results" aria-autocomplete="list"
          onKeyDown={handleKeyDown} onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search colleges, cities, or states..."
          className="w-full h-[56px] pl-14 pr-14 text-base bg-transparent rounded-xl border-0 focus:outline-none text-slate-800 placeholder:text-slate-400" />
        {loading && <div className="absolute right-5 top-1/2 -translate-y-1/2"><div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>}
        {!loading && query.length > 0 && (
          <button onClick={() => { setQuery(''); setResults([]); setOpen(false); inputRef.current?.focus(); }}
            className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-100">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div id="college-search-results" role="listbox" className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-modal border border-slate-200 overflow-hidden z-50 animate-scale-in">
          {results.map((c, i) => (
            <button key={c.id} onClick={() => handleSelect(c)}
              className={`w-full flex items-center gap-3.5 px-5 py-3.5 text-left transition-colors ${
                i === selectedIdx ? 'bg-indigo-50' : 'hover:bg-slate-50'
              } ${i > 0 ? 'border-t border-slate-100' : ''}`}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-400 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-badge">
                {c.shortName.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 truncate">{c.name}</div>
                <div className="text-xs text-slate-500">{c.city}, {c.state}</div>
              </div>
              <div className="text-right shrink-0">
                {c.type === 'GOVERNMENT' ? <span className="badge-green text-[10px]">Govt</span> : <span className="badge-gray text-[10px]">Pvt</span>}
              </div>
            </button>
          ))}
          <button onClick={() => { setOpen(false); router.push(`/colleges?search=${encodeURIComponent(query)}`); }}
            className="w-full px-5 py-3 text-center text-xs text-indigo-600 font-semibold bg-slate-50 hover:bg-indigo-50 border-t border-slate-200 transition-colors">
            View all results for &ldquo;{query}&rdquo; →
          </button>
        </div>
      )}

      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-modal border border-slate-200 p-8 text-center z-50 animate-scale-in">
          <div className="text-3xl mb-3">🔍</div>
          <div className="text-sm font-medium text-slate-500">No colleges found for &ldquo;{query}&rdquo;</div>
          <div className="text-xs text-slate-400 mt-1">Try a different search term</div>
        </div>
      )}
    </div>
  );
}

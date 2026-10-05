'use client';
import { useState } from 'react';
import type { College, CollegesResponse } from '@/types';
import { apiJson } from '@/lib/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (college: College) => void;
}

export default function SearchModal({ isOpen, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<College[]>([]);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (timer) clearTimeout(timer);
    if (!value.trim()) { setResults([]); return; }

    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiJson<CollegesResponse>(`/api/colleges?search=${encodeURIComponent(value)}&page=1&limit=10`);
        setResults(data.colleges);
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
    setTimer(t);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed top-[10%] left-1/2 -translate-x-1/2 w-[90%] max-w-[500px] bg-white rounded-lg shadow-modal z-50 animate-scale-in max-h-[70vh] flex flex-col">
        <div className="p-4 border-b border-[#E2E8F0]">
          <input type="text" value={query} onChange={e => handleSearch(e.target.value)}
            placeholder="Search colleges..." autoFocus className="input-field" />
        </div>
        <div className="overflow-y-auto flex-1 p-2">
          {loading && <div className="text-center py-4 text-[#64748B] text-sm">Searching...</div>}
          {!loading && query && results.length === 0 && (
            <div className="text-center py-4 text-[#64748B] text-sm">No colleges found</div>
          )}
          {results.map(c => (
            <button key={c.id} onClick={() => { onSelect(c); onClose(); setQuery(''); setResults([]); }}
              className="w-full text-left p-3 hover:bg-[#F8FAFC] rounded transition-colors flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm text-[#1E293B]">{c.name}</div>
                <div className="text-xs text-[#64748B]">{c.city}, {c.state} · {c.type}</div>
              </div>
            </button>
          ))}
          {!query && <div className="text-center py-4 text-[#94A3B8] text-sm">Type to search colleges</div>}
        </div>
      </div>
    </>
  );
}

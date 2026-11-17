'use client';
import { createContext, useEffect, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import type { College } from '@/types';
import { apiJson } from '@/lib/api';

/**
 * Compare list persisted in localStorage via useSyncExternalStore:
 * the server snapshot is always empty, so hydration never mismatches, and
 * changes in another tab are picked up through the `storage` event.
 */
const STORAGE_KEY = 'compareList:v2';
const MAX = 3;
const EMPTY: College[] = [];
const listeners = new Set<() => void>();
let cache: College[] | null = null;
let revision = 0;

function readStoredList(): College[] { return []; }

function getSnapshot(): College[] {
  if (cache === null) cache = readStoredList();
  return cache;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = [];
      cb();
      try {
        const stored: unknown = JSON.parse(e.newValue ?? '[]');
        const slugs = Array.isArray(stored) ? [...new Set(stored.map((c) => c?.slug).filter((slug): slug is string => typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)))].slice(0, MAX) : [];
        if (slugs.length === 0) return;
      Promise.all(slugs.map((slug) => apiJson<{college: College}>(`/api/colleges/${encodeURIComponent(slug)}`)))
          .then((rows) => { cache = rows.map((row) => row.college); listeners.forEach((listener) => listener()); })
          .catch(() => toast.error('Could not reload the comparison changed in another tab.'));
      } catch { /* ignore corrupted storage */ }
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

function write(list: College[]) {
  revision++;
  cache = list;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.map((c) => ({ id: c.id, slug: c.slug }))));
  } catch {
    /* storage full or disabled: keep in memory */
  }
  listeners.forEach((l) => l());
}

interface CompareContextType {
  compareList: College[];
  addToCompare: (college: College) => void;
  removeFromCompare: (id: string) => void;
  clearCompare: () => void;
  replaceCompare: (colleges: College[]) => void;
  isInCompare: (id: string) => boolean;
}

const CompareContext = createContext<CompareContextType | undefined>(undefined);

export function CompareProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('colleges')) return;
    let active = true;
    const expectedRevision = revision;
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      const slugs = Array.isArray(stored) ? [...new Set(stored.map((c) => c?.slug).filter((s): s is string => typeof s === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)))].slice(0, MAX) : [];
      if (slugs.length === 0) return;
      Promise.all(slugs.map((slug) => apiJson<{college: College}>(`/api/colleges/${encodeURIComponent(slug)}`)))
        .then((rows) => { if (active && revision === expectedRevision) write(rows.map((r) => r.college)); })
        .catch(() => { if (active && revision === expectedRevision) { write([]); toast.error('Could not restore your comparison. Please select colleges again.'); } });
    } catch { /* corrupted storage is ignored */ }
    return () => { active = false; };
  }, []);
  const compareList = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

  const addToCompare = useCallback((college: College) => {
    const current = getSnapshot();
    if (current.some((c) => c.id === college.id)) {
      toast.error('Already in your compare list');
      return;
    }
    if (current.length >= MAX) {
      toast.error('You can compare up to 3 colleges. Remove one to add another.');
      return;
    }
    write([...current, college]);
    toast.success(`${college.shortName} added to compare`);
  }, []);

  const value = useMemo<CompareContextType>(
    () => ({
      compareList,
      addToCompare,
      removeFromCompare: (id) => write(getSnapshot().filter((c) => c.id !== id)),
      clearCompare: () => write([]),
      replaceCompare: (colleges) => write(colleges.slice(0, MAX)),
      isInCompare: (id) => compareList.some((c) => c.id === id),
    }),
    [compareList, addToCompare],
  );

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error('useCompare must be used within CompareProvider');
  return ctx;
}

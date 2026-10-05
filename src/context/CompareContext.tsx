'use client';
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import type { College } from '@/types';

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

function readStoredList(): College[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    // Entries from the old (v1) shape are ignored.
    return Array.isArray(parsed)
      ? parsed.filter((c) => c && typeof c.id === 'string' && typeof c.slug === 'string').slice(0, MAX)
      : [];
  } catch {
    return [];
  }
}

function getSnapshot(): College[] {
  if (cache === null) cache = readStoredList();
  return cache;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

function write(list: College[]) {
  cache = list;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
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
  isInCompare: (id: string) => boolean;
}

const CompareContext = createContext<CompareContextType | undefined>(undefined);

export function CompareProvider({ children }: { children: ReactNode }) {
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

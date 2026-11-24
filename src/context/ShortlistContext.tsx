'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { postJson } from '@/lib/api';

const STORAGE_KEY = 'collegefind:shortlist:v1';
const MAX_GUEST_ITEMS = 200;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMPTY: string[] = [];
let cache: string[] = EMPTY;
let cachedRaw: string | null = null;
const listeners = new Set<() => void>();

interface ShortlistContextValue {
  guestSlugs: string[];
  hydrated: boolean;
  syncing: boolean;
  isGuestSaved: (slug: string) => boolean;
  toggleGuest: (slug: string) => void;
  removeGuest: (slug: string) => void;
}

const ShortlistContext = createContext<ShortlistContextValue | null>(null);

function readSlugs(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? '[]';
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? [...new Set(parsed.filter((slug): slug is string => typeof slug === 'string' && SLUG.test(slug)))].slice(0, MAX_GUEST_ITEMS) : [];
  } catch { return []; }
}

function getGuestSlugs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? '[]';
    if (cachedRaw !== raw) { cachedRaw = raw; cache = readSlugs(); }
  } catch { cache = EMPTY; }
  return cache;
}
function subscribe(callback: () => void) {
  listeners.add(callback);
  const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) { cachedRaw = null; callback(); } };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(callback); window.removeEventListener('storage', onStorage); };
}
function subscribeReady(callback: () => void) {
  const timer = window.setTimeout(callback, 0);
  return () => window.clearTimeout(timer);
}

export function ShortlistProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const guestSlugs = useSyncExternalStore(subscribe, getGuestSlugs, () => EMPTY);
  const hydrated = useSyncExternalStore(subscribeReady, () => true, () => false);
  const syncInFlight = useRef(false);
  const [syncing, setSyncing] = useState(false);

  const commit = useCallback((next: string[]) => {
    const unique = [...new Set(next)].filter((slug) => SLUG.test(slug)).slice(0, MAX_GUEST_ITEMS);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(unique)); } catch { /* In-memory cache remains usable. */ }
    cachedRaw = JSON.stringify(unique);
    cache = unique;
    listeners.forEach((listener) => listener());
  }, []);

  useEffect(() => {
    if (!hydrated || status !== 'authenticated' || guestSlugs.length === 0 || syncInFlight.current) return;
    let active = true;
    syncInFlight.current = true;
    const announceTimer = window.setTimeout(() => { if (active) setSyncing(true); }, 0);
    postJson<{ savedCount: number }>('/api/saved', { collegeKeys: guestSlugs })
      .then((result) => {
        if (!active) return;
        commit([]);
        if (result.savedCount > 0) toast.success(`${result.savedCount} saved college${result.savedCount === 1 ? '' : 's'} synced to your account`);
      })
      .catch(() => { if (active) toast.error('Your device shortlist is safe. We could not sync it yet; retry after reconnecting.'); })
      .finally(() => { syncInFlight.current = false; if (active) setSyncing(false); });
    return () => { active = false; window.clearTimeout(announceTimer); };
  }, [hydrated, status, guestSlugs, commit]);

  const value = useMemo<ShortlistContextValue>(() => ({
    guestSlugs,
    hydrated,
    syncing,
    isGuestSaved: (slug) => guestSlugs.includes(slug),
    toggleGuest: (slug) => {
      if (!SLUG.test(slug)) return;
      if (guestSlugs.includes(slug)) commit(guestSlugs.filter((item) => item !== slug));
      else if (guestSlugs.length < MAX_GUEST_ITEMS) commit([...guestSlugs, slug]);
      else toast.error(`A device shortlist can contain up to ${MAX_GUEST_ITEMS} colleges`);
    },
    removeGuest: (slug) => commit(guestSlugs.filter((item) => item !== slug)),
  }), [guestSlugs, hydrated, syncing, commit]);

  return <ShortlistContext.Provider value={value}>{children}</ShortlistContext.Provider>;
}

export function useShortlist() {
  const value = useContext(ShortlistContext);
  if (!value) throw new Error('useShortlist must be used within ShortlistProvider');
  return value;
}

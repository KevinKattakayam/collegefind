'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { apiJson, postJson } from '@/lib/api';
import { useShortlist } from '@/context/ShortlistContext';

/** Optimistic save/unsave that rolls back if the server rejects the change. */
export function useSaveCollege(collegeId: string, initiallySaved: boolean, onChange?: (id: string, saved: boolean) => void, slug?: string) {
  const { data: session } = useSession();
  const shortlist = useShortlist();
  const [serverSaved, setServerSaved] = useState(initiallySaved);
  const [requestPending, setRequestPending] = useState(false);
  const pending = requestPending || shortlist.syncing;
  const isSaved = Boolean(slug && shortlist.isGuestSaved(slug)) || serverSaved;

  const toggle = async () => {
    if (!session) {
      if (!slug) { toast.error('This college cannot be saved offline'); return; }
      const was = shortlist.isGuestSaved(slug);
      shortlist.toggleGuest(slug);
      toast.success(!was ? 'Saved on this device. Sign in later to sync.' : 'Removed from this device shortlist');
      onChange?.(collegeId, !was);
      return;
    }
    if (pending) return;
    const was = isSaved;
    setServerSaved(!was);
    setRequestPending(true);
    try {
      if (was) await apiJson(`/api/saved/${encodeURIComponent(collegeId)}`, { method: 'DELETE' });
      else await postJson('/api/saved', { collegeId });
      if (was && slug) shortlist.removeGuest(slug);
      toast.success(was ? 'Removed from saved' : 'Saved to your list');
      onChange?.(collegeId, !was);
    } catch (err) {
      setServerSaved(was);
      toast.error(err instanceof Error ? err.message : 'Could not update saved colleges');
    } finally {
      setRequestPending(false);
    }
  };

  return { isSaved, pending, toggle };
}

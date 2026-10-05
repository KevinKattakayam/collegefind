'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { apiJson, postJson } from '@/lib/api';

/** Optimistic save/unsave that rolls back if the server rejects the change. */
export function useSaveCollege(collegeId: string, initiallySaved: boolean, onChange?: (id: string, saved: boolean) => void) {
  const { data: session } = useSession();
  const [isSaved, setIsSaved] = useState(initiallySaved);
  const [pending, setPending] = useState(false);

  const toggle = async () => {
    if (!session) {
      toast.error('Sign in to save colleges');
      return;
    }
    if (pending) return;
    const was = isSaved;
    setIsSaved(!was);
    setPending(true);
    try {
      if (was) await apiJson(`/api/saved/${encodeURIComponent(collegeId)}`, { method: 'DELETE' });
      else await postJson('/api/saved', { collegeId });
      toast.success(was ? 'Removed from saved' : 'Saved to your list');
      onChange?.(collegeId, !was);
    } catch (err) {
      setIsSaved(was);
      toast.error(err instanceof Error ? err.message : 'Could not update saved colleges');
    } finally {
      setPending(false);
    }
  };

  return { isSaved, pending, toggle };
}

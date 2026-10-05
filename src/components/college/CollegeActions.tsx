'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import type { College } from '@/types';
import { useCompare } from '@/context/CompareContext';
import { useSaveCollege } from '@/hooks/useSaveCollege';
import { apiJson } from '@/lib/api';

export default function CollegeActions({ college }: { college: College }) {
  const { data: session } = useSession();
  const { addToCompare, isInCompare } = useCompare();
  const [initialSaved, setInitialSaved] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) return;
    apiJson<{ saved: { id: string }[] }>('/api/saved')
      .then((d) => setInitialSaved(d.saved.some((c) => c.id === college.id)))
      .catch(() => setInitialSaved(false));
  }, [session, college.id]);

  return (
    <div className="flex gap-3 flex-wrap">
      {/* Remount once the saved state is known so the hook starts from the right value. */}
      <SaveButton key={String(initialSaved)} collegeId={college.id} initiallySaved={Boolean(initialSaved)} />
      <button type="button" onClick={() => addToCompare(college)} aria-pressed={isInCompare(college.id)} className="btn-primary !h-[40px] text-sm">
        {isInCompare(college.id) ? 'In compare' : 'Add to compare'}
      </button>
      <button
        type="button"
        onClick={async () => {
          const url = window.location.href;
          if (navigator.share) {
            try {
              await navigator.share({ title: college.name, url });
            } catch {
              /* user cancelled */
            }
          } else {
            await navigator.clipboard.writeText(url);
            toast.success('Link copied');
          }
        }}
        className="px-4 h-[40px] border border-slate-300 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-50"
      >
        Share
      </button>
    </div>
  );
}

function SaveButton({ collegeId, initiallySaved }: { collegeId: string; initiallySaved: boolean }) {
  const { isSaved, pending, toggle } = useSaveCollege(collegeId, initiallySaved);
  return (
    <button type="button" onClick={toggle} disabled={pending} aria-pressed={isSaved}
      className={`px-5 h-[40px] rounded-xl font-semibold text-sm ${isSaved ? 'bg-indigo-600 text-white' : 'border-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50'}`}>
      {isSaved ? 'Saved' : 'Save college'}
    </button>
  );
}

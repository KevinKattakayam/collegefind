import type { DataStatus } from '@/types';

const COPY: Record<DataStatus, { label: string; title: string; className: string }> = {
  DEMO: {
    label: 'Demo data',
    title: 'Numbers for this college are sample values for demonstration. Do not use them for decisions.',
    className: 'bg-amber-100 text-amber-900 border-amber-300',
  },
  UNVERIFIED: {
    label: 'Unverified',
    title: 'Imported from a public source but not yet checked by a person.',
    className: 'bg-slate-100 text-slate-700 border-slate-300',
  },
  VERIFIED: {
    label: 'Verified',
    title: 'Checked against the cited official source.',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  },
};

export default function DataStatusBadge({ status, className = '' }: { status: DataStatus; className?: string }) {
  const c = COPY[status];
  return (
    <span title={c.title} className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${c.className} ${className}`}>
      {c.label}
    </span>
  );
}

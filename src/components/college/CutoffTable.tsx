import Link from 'next/link';
import type { PublicCutoffRow } from '@/server/cutoffs';
import { getCategoryLabel, getExamLabel } from '@/lib/utils';

const date = (value: Date | null) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(value) : 'Not stated by source';
const rankLabel = (kind: PublicCutoffRow['rankType'], metric: PublicCutoffRow['metric']) => {
  if (metric !== 'RANK') return 'Not a rank';
  switch (kind) {
    case 'CRL': return 'Common Rank List (CRL)';
    case 'CATEGORY': return 'Category rank';
    case 'PWD_CATEGORY': return 'PwD category rank';
    case 'MERIT': return 'Merit rank';
    default: return 'Rank type not recorded';
  }
};
const metricLabel = (metric: PublicCutoffRow['metric']) => metric === 'RANK' ? 'Rank' : metric === 'PERCENTILE' ? 'Percentile' : 'Score';
const systemLabel = (system: PublicCutoffRow['counsellingSystem']) => system === 'UNSPECIFIED' ? 'Counselling system not recorded' : system;

export default function CutoffTable({ rows, showCollege = false, showGuidance = true }: { rows: PublicCutoffRow[]; showCollege?: boolean; showGuidance?: boolean }) {
  if (!rows.length) return <p className="text-sm text-slate-600">No reviewed official cutoff records match these filters.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700" role="region" aria-label={showCollege ? 'Scrollable official cutoff results table' : 'Scrollable college cutoff history table'} tabIndex={0}>
      <table className="w-full min-w-[1050px] text-sm">
        <caption className="sr-only">Human-reviewed official historical cutoff records with published source and full seat dimensions</caption>
        <thead><tr className="bg-slate-50 text-left text-xs text-slate-600">
          {showCollege && <th scope="col" className="p-3">Institution</th>}
          <th scope="col" className="p-3">Programme</th><th scope="col" className="p-3">System / exam</th>
          <th scope="col" className="p-3">Year / round</th><th scope="col" className="p-3">Quota / category</th>
          <th scope="col" className="p-3">Seat pool</th><th scope="col" className="p-3">Rank definition</th>
          <th scope="col" className="p-3 text-right">Opening</th><th scope="col" className="p-3 text-right">Closing</th><th scope="col" className="p-3">Official source</th>
        </tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id} className="border-t border-slate-100 align-top">
          {showCollege && <td className="p-3"><Link className="font-medium text-indigo-700 underline" href={`/colleges/${row.college.slug}`}>{row.college.name}</Link><span className="block text-xs text-slate-500">{row.college.city}, {row.college.state}</span></td>}
          <td className="p-3"><span className="font-medium text-slate-900">{row.program.branch ?? row.program.name}</span><span className="block text-xs text-slate-500">{row.program.degree ?? 'Degree not recorded'}{row.program.durationYears ? ` · ${row.program.durationYears} years` : ''}</span></td>
          <td className="p-3">{systemLabel(row.counsellingSystem)}<span className="block text-xs text-slate-500">{getExamLabel(row.exam)} · {metricLabel(row.metric)}</span></td>
          <td className="p-3">{row.year} · Round {row.round}</td>
          <td className="p-3">{row.quota} · {getCategoryLabel(row.category)}{row.isPwd && <span className="block text-xs font-semibold text-indigo-800">PwD</span>}</td>
          <td className="p-3">{row.seatPool === 'FEMALE_ONLY' ? 'Female-only' : 'Gender-neutral'}</td>
          <td className="p-3">{rankLabel(row.rankType, row.metric)}{row.isPreparatory && <span className="block text-xs">Preparatory rank list (P)</span>}</td>
          <td className="p-3 text-right tabular-nums">{row.openingValue === null ? 'Not published' : row.openingValue.toLocaleString('en-IN')}{row.isPreparatory && row.openingValue !== null ? ' P' : ''}</td>
          <td className="p-3 text-right font-semibold tabular-nums">{row.closingValue.toLocaleString('en-IN')}{row.isPreparatory ? ' P' : ''}</td>
          <td className="p-3"><a href={row.source.url} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-700 underline">{row.source.publisher}</a>{row.evidenceLocator && <span className="block text-xs text-slate-600">Evidence location: {row.evidenceLocator}</span>}<span className="block text-xs text-slate-500">Published: {date(row.source.publishedAt)}</span><span className="block text-xs text-slate-500">Collected: {date(row.source.retrievedAt)}</span><span className="block text-xs text-slate-500">Reviewed: {date(row.reviewedAt)}</span>
            {showGuidance && row.metric === 'RANK' && !row.isPreparatory && row.rankType !== 'UNSPECIFIED' && row.counsellingSystem !== 'UNSPECIFIED' &&
              <Link className="mt-2 inline-block text-indigo-700 underline" href={`/predictor?cutoff=${encodeURIComponent(row.id)}`}>Compare a rank with this record</Link>}
          </td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

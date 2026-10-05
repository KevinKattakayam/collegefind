import type { CutoffRow } from '@/types';
import { getCategoryLabel, getExamLabel } from '@/lib/utils';

/** Server-rendered table of sourced cutoffs; one row per seat, newest year first. */
export default function CutoffHistory({ rows }: { rows: CutoffRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-slate-600">
        No official cutoff data has been imported for this college yet. Check{' '}
        <a href="https://josaa.nic.in" target="_blank" rel="noopener noreferrer" className="text-indigo-700 font-semibold">JoSAA</a> or{' '}
        <a href="https://mcc.nic.in" target="_blank" rel="noopener noreferrer" className="text-indigo-700 font-semibold">MCC</a> for past closing ranks.
      </p>
    );
  }
  const sources = [...new Map(rows.map((r) => [r.source.url + r.source.name, r.source])).values()];
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <caption className="sr-only">Final-round closing values by program, year and seat type</caption>
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-600">
              <th scope="col" className="p-2">Program</th>
              <th scope="col" className="p-2">Exam</th>
              <th scope="col" className="p-2">Year (round)</th>
              <th scope="col" className="p-2">Quota</th>
              <th scope="col" className="p-2">Category</th>
              <th scope="col" className="p-2">Pool</th>
              <th scope="col" className="p-2 text-right">Closing</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 60).map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="p-2 text-slate-800">{r.program.branch ?? r.program.name}</td>
                <td className="p-2">{getExamLabel(r.exam)}</td>
                <td className="p-2">{r.year} (R{r.round})</td>
                <td className="p-2">{r.quota}</td>
                <td className="p-2">{getCategoryLabel(r.category)}</td>
                <td className="p-2">{r.seatPool === 'FEMALE_ONLY' ? 'Female-only' : 'Gender-neutral'}</td>
                <td className="p-2 text-right font-semibold">
                  {r.closingValue.toLocaleString('en-IN')}
                  {r.isPreparatory ? ' P' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500 mt-2">
        OPEN seats use CRL ranks; reserved-category seats use category ranks. &ldquo;P&rdquo; marks preparatory-list ranks.
        Sources:{' '}
        {sources.map((s, i) => (
          <span key={s.url + i}>
            {i > 0 && '; '}
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-indigo-700">{s.name}</a>
          </span>
        ))}
      </p>
    </div>
  );
}

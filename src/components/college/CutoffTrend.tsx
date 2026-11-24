import type { PublicCutoffRow } from '@/server/cutoffs';
import { buildCutoffTrendGrid, cutoffTrendDomain, cutoffTrendPath } from '@/server/cutoff-trends';

const date = (value: Date | null) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(value) : 'Not stated by source';
const number = (value: number | null) => value === null ? 'Not published' : value.toLocaleString('en-IN');

export default function CutoffTrend({ state, rows, selection }: { state: 'NEEDS_FILTERS' | 'NOT_RANKS' | 'AMBIGUOUS' | 'EMPTY' | 'READY'; rows: PublicCutoffRow[]; selection?: { year?: number; yearFrom?: number; yearTo?: number; round?: number } }) {
  if (state === 'NEEDS_FILTERS') return <section aria-labelledby="cutoff-trend-heading" className="mt-8 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
    <h2 id="cutoff-trend-heading" className="text-xl font-bold">Historical rank trend</h2>
    <p className="mt-2 text-sm text-slate-600">Choose one college and programme, counselling system, entrance exam, rank definition, category, quota, seat pool, PwD setting and value type, then apply filters to view a comparable series. Different programmes and seat definitions are never combined.</p>
  </section>;
  if (state === 'AMBIGUOUS') return <section aria-labelledby="cutoff-trend-heading" className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-4 sm:p-6">
    <h2 id="cutoff-trend-heading" className="text-xl font-bold">Historical rank trend</h2>
    <p className="mt-2 text-sm text-amber-950">These filters match more than one college or programme. Refine the institution and programme filters to keep the trend series separate.</p>
  </section>;
  if (state === 'NOT_RANKS') return <section aria-labelledby="cutoff-trend-heading" className="mt-8 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
    <h2 id="cutoff-trend-heading" className="text-xl font-bold">Historical rank trend</h2>
    <p className="mt-2 text-sm text-slate-600">This chart compares published ranks only. Scores and percentiles remain available in the records table, but are not plotted as ranks.</p>
  </section>;
  if (state === 'EMPTY') return <section aria-labelledby="cutoff-trend-heading" className="mt-8 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
    <h2 id="cutoff-trend-heading" className="text-xl font-bold">Historical rank trend</h2>
    <p className="mt-2 text-sm text-slate-600">No reviewed official trend observations match this complete set of filters. No missing value is estimated.</p>
  </section>;

  const cells = buildCutoffTrendGrid(rows, selection);
  const domain = cutoffTrendDomain(cells);
  if (!domain) return <section aria-labelledby="cutoff-trend-heading" className="mt-8 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
    <h2 id="cutoff-trend-heading" className="text-xl font-bold">Historical rank trend</h2>
    <p className="mt-2 text-sm text-slate-600">Rank values are unavailable for these reviewed records.</p>
  </section>;

  const plotWidth = 700;
  const plotHeight = 250;
  const openingPaths = cutoffTrendPath(cells, 'openingValue', plotWidth, plotHeight, domain);
  const closingPaths = cutoffTrendPath(cells, 'closingValue', plotWidth, plotHeight, domain);
  const tickStep = Math.max(1, Math.ceil(cells.length / 8));
  const ticks = cells.map((cell, index) => ({ cell, index })).filter(({ index }) => index % tickStep === 0 || index === cells.length - 1);
  const observations = cells.filter((cell) => cell.record !== null);
  const onlyOne = observations.length === 1;
  const profile = rows[0];

  return <section aria-labelledby="cutoff-trend-heading" className="mt-8 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
    <h2 id="cutoff-trend-heading" className="text-xl font-bold">Historical rank trend</h2>
    <p className="mt-2 text-sm text-slate-600">{profile.college.name} · {profile.program.branch ?? profile.program.name} · {profile.exam.replaceAll('_', ' ')} · {profile.counsellingSystem} · {profile.category} · {profile.quota} · {profile.seatPool.replaceAll('_', ' ')} · {profile.rankType.replaceAll('_', ' ')}</p>
    {onlyOne && <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">One reviewed observation is available. A trend line cannot be drawn until another year or round is published.</p>}
    <div className="mt-4 overflow-x-auto" role="region" aria-label="Scrollable cutoff trend chart" tabIndex={0}>
      <svg viewBox="0 0 800 330" className="h-auto min-w-[620px] w-full" role="img" aria-labelledby="cutoff-trend-title cutoff-trend-description">
        <title id="cutoff-trend-title">Opening and closing rank history for {profile.college.name}, {profile.program.branch ?? profile.program.name}</title>
        <desc id="cutoff-trend-description">Points are grouped by admission year and counselling round. Gaps mean no reviewed record exists for that year and round. Lower and higher values are shown as published; no values are predicted. The table below contains exact values, years and source links.</desc>
        {[0, 1, 2, 3, 4].map((step) => {
          const y = 30 + step * (plotHeight / 4);
          const value = domain.max - step * ((domain.max - domain.min) / 4);
          return <g key={step}><line x1="64" x2="772" y1={y} y2={y} stroke="#e2e8f0" /><text x="58" y={y + 4} textAnchor="end" fontSize="11" fill="#475569">{Math.round(value).toLocaleString('en-IN')}</text></g>;
        })}
        <text x="16" y="160" transform="rotate(-90 16 160)" textAnchor="middle" fontSize="12" fill="#334155">Published rank (lower is a smaller rank number)</text>
        <text x="414" y="322" textAnchor="middle" fontSize="12" fill="#334155">Admission year and counselling round</text>
        {openingPaths.map((path, index) => <path key={`opening-${index}`} d={path.replaceAll(/([ML])([\d.]+),([\d.]+)/g, (_match, command: string, x: string, y: string) => `${command}${Number(x) + 64},${Number(y) + 30}`)} fill="none" stroke="#2563eb" strokeWidth="2.5" />)}
        {closingPaths.map((path, index) => <path key={`closing-${index}`} d={path.replaceAll(/([ML])([\d.]+),([\d.]+)/g, (_match, command: string, x: string, y: string) => `${command}${Number(x) + 64},${Number(y) + 30}`)} fill="none" stroke="#c2410c" strokeWidth="2.5" />)}
        {cells.map(({ year, round, record }, index) => {
          if (!record) return null;
          const x = cells.length < 2 ? 414 : 64 + (index / (cells.length - 1)) * plotWidth;
          const y = (value: number) => 30 + plotHeight - ((value - domain.min) / (domain.max - domain.min || 1)) * plotHeight;
          return <g key={record.id}><title>{`${year}, round ${round}: opening ${number(record.openingValue)}, closing ${number(record.closingValue)}`}</title>
            {record.openingValue !== null && <circle cx={x} cy={y(record.openingValue)} r="4" fill="#2563eb" />}
            <circle cx={x} cy={y(record.closingValue)} r="4" fill="#c2410c" />
          </g>;
        })}
        {ticks.map(({ cell, index }) => {
          const x = cells.length < 2 ? 414 : 64 + (index / (cells.length - 1)) * plotWidth;
          return <text key={`${cell.year}-${cell.round}`} x={x} y="298" textAnchor="middle" fontSize="10" fill="#475569">{cell.year} R{cell.round}</text>;
        })}
      </svg>
    </div>
    <ul aria-label="Trend series" className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
      <li><span aria-hidden="true" className="mr-2 inline-block h-3 w-3 rounded-full bg-blue-600" />Opening rank</li>
      <li><span aria-hidden="true" className="mr-2 inline-block h-3 w-3 rounded-full bg-orange-700" />Closing rank</li>
    </ul>
    <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200" role="region" aria-label="Cutoff trend data table" tabIndex={0}>
      <table className="w-full min-w-[760px] text-sm">
        <caption className="sr-only">Opening and closing rank values and official sources for every year and round in the selected series. Missing combinations are explicitly shown.</caption>
        <thead><tr className="bg-slate-50 text-left"><th scope="col" className="p-3">Admission year</th><th scope="col" className="p-3">Round</th><th scope="col" className="p-3">Opening rank</th><th scope="col" className="p-3">Closing rank</th><th scope="col" className="p-3">Official source and review</th></tr></thead>
        <tbody>{cells.map(({ year, round, record }) => <tr key={`${year}-${round}`} className="border-t border-slate-100 align-top">
          <th scope="row" className="p-3 text-left font-medium">{year}</th><td className="p-3">Round {round}</td>
          {record ? <><td className="p-3 tabular-nums">{number(record.openingValue)}{record.isPreparatory && record.openingValue !== null ? ' P' : ''}</td><td className="p-3 tabular-nums">{number(record.closingValue)}{record.isPreparatory ? ' P' : ''}</td>
            <td className="p-3"><a href={record.source.url} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-700 underline">{record.source.publisher}</a>{record.evidenceLocator && <span className="block text-xs text-slate-600">Evidence location: {record.evidenceLocator}</span>}<span className="block text-xs text-slate-600">Academic year: {record.year} · Published: {date(record.source.publishedAt)} · Retrieved: {date(record.source.retrievedAt)} · Reviewed: {date(record.reviewedAt)}</span></td></>
            : <td colSpan={3} className="p-3 text-slate-600">No reviewed record for this year and round; no value is estimated.</td>}
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}

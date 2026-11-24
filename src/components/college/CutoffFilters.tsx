'use client';

import { useEffect, useState } from 'react';
import type { CutoffQuery } from '@/server/cutoffs';

const fields = ['q', 'college', 'program', 'counsellingSystem', 'exam', 'year', 'yearFrom', 'yearTo', 'category', 'quota', 'seatPool', 'round', 'isPwd', 'rankType', 'metric', 'pageSize'] as const;
type Field = typeof fields[number];
type Values = Record<Field, string>;

function fromQuery(query: Partial<CutoffQuery>): Values {
  return {
    q: query.q ?? '', college: query.college ?? '', program: query.program ?? '',
    counsellingSystem: query.counsellingSystem ?? '', exam: query.exam ?? '',
    year: query.year === undefined ? '' : String(query.year),
    yearFrom: query.yearFrom === undefined ? '' : String(query.yearFrom),
    yearTo: query.yearTo === undefined ? '' : String(query.yearTo),
    category: query.category ?? '', quota: query.quota ?? '', seatPool: query.seatPool ?? '',
    round: query.round === undefined ? '' : String(query.round),
    isPwd: query.isPwd === undefined ? '' : String(query.isPwd), metric: query.metric ?? '',
    rankType: query.rankType ?? '',
    pageSize: String(query.pageSize ?? 25),
  };
}

function fromLocation(): Values {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(fields.map((field) => [field, params.get(field) ?? (field === 'pageSize' ? '25' : '')])) as Values;
}

export default function CutoffFilters({ query }: { query: CutoffQuery }) {
  const [values, setValues] = useState(() => fromQuery(query));
  useEffect(() => {
    const syncWithUrl = () => setValues(fromLocation());
    window.addEventListener('popstate', syncWithUrl);
    window.addEventListener('pageshow', syncWithUrl);
    return () => {
      window.removeEventListener('popstate', syncWithUrl);
      window.removeEventListener('pageshow', syncWithUrl);
    };
  }, []);

  const input = (name: Field, label: string, options: { maxLength?: number; placeholder?: string; type?: string; min?: number; max?: number } = {}) => (
    <label htmlFor={`cutoff-${name}`} className="text-sm font-medium">{label}
      <input id={`cutoff-${name}`} name={name} type={options.type ?? 'text'} min={options.min} max={options.max} maxLength={options.maxLength} placeholder={options.placeholder} value={values[name]} onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))} className="input-field mt-1" />
    </label>
  );
  const select = (name: Field, label: string, options: [string, string][]) => (
    <label htmlFor={`cutoff-${name}`} className="text-sm font-medium">{label}
      <select id={`cutoff-${name}`} name={name} value={values[name]} onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))} className="input-field mt-1">
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </label>
  );

  return <form action="/cutoffs" method="get" className="mt-7 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
    {input('q', 'Search institution or programme', { maxLength: 100 })}
    {input('college', 'Institution', { maxLength: 100 })}
    {input('program', 'Programme / branch', { maxLength: 140 })}
    {select('counsellingSystem', 'Counselling system', [['', 'All / unspecified'], ...['JOSAA','CSAB','MCC','STATE','OTHER','UNSPECIFIED'].map((value) => [value, value] as [string, string])])}
    {select('exam', 'Entrance exam', [['', 'All exams'], ...['JEE_MAIN','JEE_ADVANCED','NEET','CAT','GATE'].map((value) => [value, value] as [string, string])])}
    {input('year', 'Exact year', { type: 'number', min: 2000, max: 2100 })}
    {input('yearFrom', 'From year', { type: 'number', min: 2000, max: 2100 })}
    {input('yearTo', 'To year', { type: 'number', min: 2000, max: 2100 })}
    {select('category', 'Reservation category', [['', 'All categories'], ...['OPEN','EWS','OBC_NCL','SC','ST'].map((value) => [value, value] as [string, string])])}
    {input('quota', 'Quota', { maxLength: 24, placeholder: 'e.g. AI, HS, OS' })}
    {select('seatPool', 'Seat pool', [['', 'All pools'], ['GENDER_NEUTRAL', 'Gender neutral'], ['FEMALE_ONLY', 'Female only']])}
    {input('round', 'Counselling round', { type: 'number', min: 1, max: 50 })}
    {select('isPwd', 'PwD seat', [['', 'All'], ['true', 'PwD'], ['false', 'Non-PwD']])}
    {select('rankType', 'Rank definition', [['', 'All rank definitions'], ...['UNSPECIFIED','CRL','CATEGORY','PWD_CATEGORY','MERIT'].map((value) => [value, value.replaceAll('_', ' ')] as [string, string])])}
    {select('metric', 'Published value type', [['', 'All types'], ['RANK', 'Rank'], ['PERCENTILE', 'Percentile'], ['SCORE', 'Score']])}
    {select('pageSize', 'Rows per page', [['25', '25'], ['50', '50'], ['100', '100']])}
    <div className="flex items-end gap-4"><button type="submit" className="btn-primary">Apply filters</button><a href="/cutoffs" className="pb-2 text-sm text-indigo-700 underline">Clear</a></div>
  </form>;
}

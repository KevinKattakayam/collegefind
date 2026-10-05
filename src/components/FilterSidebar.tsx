'use client';
import { useState } from 'react';

interface FilterValues {
  state: string;
  type: string;
  minFees: string;
  maxFees: string;
  naac: string[];
  minRating: string;
  courses: string[];
  exams: string[];
  established: string;
}

interface Props {
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onClear: () => void;
  states: string[];
}

const NAAC_GRADES = ['A++', 'A+', 'A', 'B++', 'B+', 'B'];
const COURSE_OPTIONS = ['B.Tech', 'MBA', 'MBBS', 'BBA', 'B.Sc', 'LLB', 'B.Com', 'B.A', 'M.Tech', 'PhD'];
const EXAM_OPTIONS = [
  { value: 'JEE_MAIN', label: 'JEE Main' },
  { value: 'JEE_ADVANCED', label: 'JEE Advanced' },
  { value: 'NEET', label: 'NEET' },
  { value: 'CAT', label: 'CAT' },
  { value: 'GATE', label: 'GATE' },
];
const ESTABLISHED_OPTIONS = [
  { label: 'Before 1960', value: 'before_1960' },
  { label: '1960–1990', value: '1960_1990' },
  { label: '1990–2010', value: '1990_2010' },
  { label: 'After 2010', value: 'after_2010' },
];


interface SectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
  count?: number;
  open: boolean;
  onToggle: (id: string) => void;
}

// Defined at module scope: a component declared inside another component's
// body is a new type on every render, which remounts it and drops input focus.
function Section({ id, title, children, count, open, onToggle }: SectionProps) {
  const panelId = `filter-section-${id}`;
  return (
    <div className="border-b border-slate-100 py-3.5">
      <button type="button" onClick={() => onToggle(id)} aria-expanded={open} aria-controls={panelId}
        className="flex items-center justify-between w-full text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors">
        <span className="flex items-center gap-2">
          {title}
          {count !== undefined && count > 0 && (
            <span className="bg-indigo-600 text-white text-[10px] font-bold w-[18px] h-[18px] rounded-full flex items-center justify-center">{count}</span>
          )}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"
          className={`transition-transform duration-200 text-slate-400 ${open ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
      <div id={panelId} hidden={!open} className="mt-3">
        {children}
      </div>
    </div>
  );
}

export default function FilterSidebar({ values, onChange, onClear, states }: Props) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    state: true, type: true, fees: true, naac: true, courses: true, exams: false, established: false,
  });

  const activeFilters: { label: string; key: string; value: string }[] = [];
  if (values.state) activeFilters.push({ label: values.state, key: 'state', value: '' });
  if (values.type) activeFilters.push({ label: values.type === 'GOVERNMENT' ? 'Government' : 'Private', key: 'type', value: '' });
  if (values.minFees) activeFilters.push({ label: `Min ₹${Number(values.minFees).toLocaleString('en-IN')}`, key: 'minFees', value: '' });
  if (values.maxFees) activeFilters.push({ label: `Max ₹${Number(values.maxFees).toLocaleString('en-IN')}`, key: 'maxFees', value: '' });
  values.naac.forEach(g => activeFilters.push({ label: `NAAC ${g}`, key: 'naac', value: g }));
  values.courses.forEach(c => activeFilters.push({ label: c, key: 'courses', value: c }));
  values.exams.forEach(e => activeFilters.push({ label: EXAM_OPTIONS.find(o => o.value === e)?.label || e, key: 'exams', value: e }));
  if (values.established) activeFilters.push({ label: ESTABLISHED_OPTIONS.find(o => o.value === values.established)?.label || values.established, key: 'established', value: '' });

  const activeCount = activeFilters.length;

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const update = (partial: Partial<FilterValues>) => {
    onChange({ ...values, ...partial });
  };

  const toggleArray = (arr: string[], value: string) =>
    arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];

  const removeFilter = (key: string, value: string) => {
    if (key === 'naac') update({ naac: values.naac.filter(v => v !== value) });
    else if (key === 'courses') update({ courses: values.courses.filter(v => v !== value) });
    else if (key === 'exams') update({ exams: values.exams.filter(v => v !== value) });
    else update({ [key]: '' } as Partial<FilterValues>);
  };


  return (
    <div className="filter-panel">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          <span className="font-bold text-sm text-slate-800">Filters</span>
          {activeCount > 0 && (
            <span className="bg-indigo-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{activeCount}</span>
          )}
        </div>
      </div>

      {/* Active filter pills */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4 pb-4 border-b border-slate-100">
          {activeFilters.map((f, i) => (
            <button key={`${f.key}-${f.value}-${i}`} onClick={() => removeFilter(f.key, f.value)}
              className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 text-[11px] font-semibold px-2.5 py-1 rounded-full hover:bg-indigo-100 transition-colors">
              {f.label}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          ))}
        </div>
      )}

      <Section id="state" open={!!openSections.state} onToggle={toggleSection} title="State / Location" count={values.state ? 1 : 0}>
        <select aria-label="State" value={values.state} onChange={e => update({ state: e.target.value })}
          className="input-field !h-[36px] text-sm !rounded-lg">
          <option value="">All States</option>
          {states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </Section>

      <Section id="type" open={!!openSections.type} onToggle={toggleSection} title="College Type" count={values.type ? 1 : 0}>
        {['GOVERNMENT', 'PRIVATE'].map(t => (
          <label key={t} className="flex items-center gap-2.5 text-sm text-slate-600 mb-1.5 cursor-pointer hover:text-slate-800 transition-colors">
            <input type="checkbox" checked={values.type === t} onChange={() => update({ type: values.type === t ? '' : t })}
              className="w-4 h-4 rounded" />
            {t === 'GOVERNMENT' ? 'Government' : 'Private'}
          </label>
        ))}
      </Section>

      <Section id="fees" open={!!openSections.fees} onToggle={toggleSection} title="Fees Range" count={(values.minFees || values.maxFees) ? 1 : 0}>
        <div className="flex gap-2">
          <input type="number" inputMode="numeric" min={0} aria-label="Minimum annual fees in rupees" placeholder="Min ₹" value={values.minFees} onChange={e => update({ minFees: e.target.value })}
            className="input-field !h-[36px] text-sm flex-1 !rounded-lg" />
          <input type="number" inputMode="numeric" min={0} aria-label="Maximum annual fees in rupees" placeholder="Max ₹" value={values.maxFees} onChange={e => update({ maxFees: e.target.value })}
            className="input-field !h-[36px] text-sm flex-1 !rounded-lg" />
        </div>
      </Section>

      <Section id="exams" open={!!openSections.exams} onToggle={toggleSection} title="Has sourced cutoffs for" count={values.exams.length}>
        {EXAM_OPTIONS.map(e => (
          <label key={e.value} className="flex items-center gap-2.5 text-sm text-slate-600 mb-1.5 cursor-pointer hover:text-slate-800 transition-colors">
            <input type="checkbox" checked={values.exams.includes(e.value)} onChange={() => update({ exams: toggleArray(values.exams, e.value) })}
              className="w-4 h-4 rounded" />
            {e.label}
          </label>
        ))}
      </Section>

      <Section id="naac" open={!!openSections.naac} onToggle={toggleSection} title="NAAC Grade" count={values.naac.length}>
        {NAAC_GRADES.map(g => (
          <label key={g} className="flex items-center gap-2.5 text-sm text-slate-600 mb-1.5 cursor-pointer hover:text-slate-800 transition-colors">
            <input type="checkbox" checked={values.naac.includes(g)} onChange={() => update({ naac: toggleArray(values.naac, g) })}
              className="w-4 h-4 rounded" />
            {g}
          </label>
        ))}
      </Section>


      <Section id="courses" open={!!openSections.courses} onToggle={toggleSection} title="Courses Offered" count={values.courses.length}>
        {COURSE_OPTIONS.map(c => (
          <label key={c} className="flex items-center gap-2.5 text-sm text-slate-600 mb-1.5 cursor-pointer hover:text-slate-800 transition-colors">
            <input type="checkbox" checked={values.courses.includes(c)} onChange={() => update({ courses: toggleArray(values.courses, c) })}
              className="w-4 h-4 rounded" />
            {c}
          </label>
        ))}
      </Section>

      <Section id="established" open={!!openSections.established} onToggle={toggleSection} title="Established Year" count={values.established ? 1 : 0}>
        {ESTABLISHED_OPTIONS.map(e => (
          <label key={e.value} className="flex items-center gap-2.5 text-sm text-slate-600 mb-1.5 cursor-pointer hover:text-slate-800 transition-colors">
            <input type="radio" name="established" checked={values.established === e.value}
              onChange={() => update({ established: values.established === e.value ? '' : e.value })}
              className="w-4 h-4" />
            {e.label}
          </label>
        ))}
      </Section>

      <button type="button" onClick={onClear} className="text-error-600 hover:text-error-700 font-semibold text-sm mt-4 w-full text-center py-2 rounded-lg hover:bg-error-50 transition-colors">
        Clear All Filters
      </button>
    </div>
  );
}

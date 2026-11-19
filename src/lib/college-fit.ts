import { z } from 'zod';
import type { College } from '@/types';

export const degrees = ['UG', 'PG', 'DOCTORAL', 'DIPLOMA'] as const;
export const priorities = ['identity', 'programme', 'budget'] as const;
const optionalNumber = (max: number, min = 1) => z.preprocess(
  (value) => value === '' || value === undefined ? undefined : value,
  z.coerce.number().int().min(min).max(max).optional(),
);
export const fitQuery = z.object({
  location: z.string().trim().max(100).default(''),
  type: z.enum(['', 'GOVERNMENT', 'PRIVATE']).default(''),
  programme: z.string().trim().max(140).default(''),
  degree: z.enum(['', ...degrees]).default(''),
  budget: optionalNumber(100_000_000),
  feeCategory: z.string().trim().max(100).default(''),
  year: optionalNumber(2100, 2000),
  priority: z.enum(['', ...priorities]).default(''),
  page: optionalNumber(1000),
});

type Preferences = z.infer<typeof fitQuery>;
type Fact = NonNullable<College['structuredFacts']>[number];
type Dimension = 'identity' | 'programme' | 'budget';
type Reason = { label: string; state: 'MATCH' | 'MISMATCH' | 'UNKNOWN'; detail: string; facts?: Fact[]; dimension: Dimension };
const normalize = (s: string) => s.trim().normalize('NFKC').toLowerCase();
const equal = (a: string, b: string) => normalize(a) === normalize(b);

export function evaluateFit(college: College, q: Preferences) {
  const reasons: Reason[] = [];
  const identity = (label: string, value: string, match: boolean) => {
    reasons.push({ label, dimension: 'identity', state: !value.trim() ? 'UNKNOWN' : match ? 'MATCH' : 'MISMATCH',
      detail: value.trim() || 'Catalogue value unavailable' });
  };
  if (q.location) identity('City or state', [college.city, college.state].filter(Boolean).join(', '), [college.city, college.state].some((s) => equal(s, q.location)));
  if (q.type) identity('Institution type', college.type, college.type === q.type);

  // The caller supplies the server-side public projection, never raw evidence.
  const facts = college.dataStatus === 'DEMO' ? [] : college.structuredFacts ?? [];
  if (q.programme || q.degree) {
    const matches = facts.filter(({ value }) => value.kind === 'programme' &&
      normalize(value.programme).includes(normalize(q.programme)) && (!q.degree || value.level === q.degree));
    reasons.push({ label: 'Programme and degree', dimension: 'programme', state: matches.length ? 'MATCH' : 'UNKNOWN',
      detail: matches.length ? 'Reviewed programme matches your selection.' : 'No matching reviewed programme found. The catalogue may be incomplete.', facts: matches });
  }
  if (q.budget !== undefined) {
    const fees = facts.filter(({ value, academicYear }) => value.kind === 'fee' && q.programme && q.feeCategory && q.year &&
      academicYear === q.year && equal(value.programme, q.programme) && equal(value.category, q.feeCategory) &&
      value.period === 'YEAR' && value.feeType === 'TUITION' && /^(total annual tuition|annual tuition|tuition fee)$/i.test(value.component));
    const match = fees[0];
    const amount = fees.length === 1 && match.value.kind === 'fee' ? match.value.amountInr : null;
    reasons.push({ label: 'Annual tuition budget', dimension: 'budget', state: amount === null ? 'UNKNOWN' : amount <= q.budget ? 'MATCH' : 'MISMATCH',
      detail: amount === null ? 'A single reviewed annual tuition amount requires an exact programme, fee category and year.'
        : `₹${amount.toLocaleString('en-IN')} published annual tuition for the selected scope.`,
      facts: amount === null ? [] : fees });
  }
  return reasons;
}

/** Normalize only the active criteria. Incomplete records receive no numeric score. */
export function fitWeight(reasons: Reason[], priority: Preferences['priority']) {
  if (!reasons.length || reasons.some(({ state }) => state === 'UNKNOWN')) return null;
  const weight = (reason: Reason) => reason.dimension === priority ? 2 : 1;
  return reasons.reduce((sum, reason) => sum + (reason.state === 'MATCH' ? weight(reason) : 0), 0) /
    reasons.reduce((sum, reason) => sum + weight(reason), 0);
}

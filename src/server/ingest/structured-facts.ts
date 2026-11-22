import { z } from 'zod';

const name = z.string().trim().min(1).max(180);
const detail = z.string().trim().min(1).max(900);
const positive = z.number().int().positive().max(1_000_000_000);
const link = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password;
});

export const structuredFact = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('programme'), programme: name, level: z.enum(['UG', 'PG', 'DOCTORAL', 'DIPLOMA']), durationMonths: z.number().int().min(1).max(144).optional(), durationSemesters: z.number().int().min(1).max(24).optional() }),
  z.strictObject({ kind: z.literal('admission'), programme: name, route: name, category: name, exam: name.optional(), counselling: name.optional(), eligibility: detail.optional(), applicationUrl: link.optional() }),
  z.strictObject({ kind: z.literal('fee'), programme: name, category: name, component: name, feeType: z.enum(['TUITION', 'HOSTEL']), period: z.enum(['SEMESTER', 'YEAR', 'MONTH', 'ONE_TIME']), amountInr: positive }),
  z.strictObject({ kind: z.literal('scholarship'), scheme: name, eligibility: detail.optional(), url: link }),
  z.strictObject({ kind: z.literal('recognition'), authority: name, credential: name, coverage: name, result: name }),
  z.strictObject({ kind: z.literal('nirfRanking'), category: name, rank: positive }),
  z.strictObject({ kind: z.literal('placement'), cohort: name, metric: z.enum(['MEDIAN', 'MEAN', 'HIGHEST', 'PLACED_COUNT']), denominator: positive, value: positive, definition: detail }),
  z.strictObject({ kind: z.literal('contact'), office: name, channel: z.enum(['PHONE', 'EMAIL', 'ADDRESS']), contact: name }),
  z.strictObject({ kind: z.literal('facility'), facility: name, description: detail }),
]).superRefine((fact, ctx) => {
  if (fact.kind === 'programme' && fact.durationMonths !== undefined && fact.durationSemesters !== undefined) {
    ctx.addIssue({ code: 'custom', message: 'Programme duration must use one source-reported unit' });
  }
  if (fact.kind === 'placement' && fact.metric === 'PLACED_COUNT' && fact.value > fact.denominator) {
    ctx.addIssue({ code: 'custom', message: 'Placed count exceeds cohort denominator' });
  }
  if (fact.kind === 'contact' && (
    (fact.channel === 'EMAIL' && !z.email().safeParse(fact.contact).success) ||
    (fact.channel === 'PHONE' && !/^\+?[0-9][0-9 ()-]{5,24}$/.test(fact.contact))
  )) ctx.addIssue({ code: 'custom', message: 'Invalid contact value' });
});

export type StructuredFact = z.infer<typeof structuredFact>;

export function structuredScope(fact: StructuredFact): string[] {
  switch (fact.kind) {
    case 'programme': return [fact.programme, fact.level];
    case 'admission': return [fact.programme, fact.route, fact.category];
    case 'fee': return [fact.programme, fact.category, fact.feeType, fact.component, fact.period];
    case 'scholarship': return [fact.scheme];
    case 'recognition': return [fact.authority, fact.credential, fact.coverage];
    case 'nirfRanking': return [fact.category];
    case 'placement': return [fact.cohort, fact.metric];
    case 'contact': return [fact.office, fact.channel];
    case 'facility': return [fact.facility];
  }
}

export const structuredLabels: Record<StructuredFact['kind'], string> = {
  programme: 'Programme', admission: 'Admission route', fee: 'Fees (INR)', scholarship: 'Scholarship',
  recognition: 'Recognition or accreditation', nirfRanking: 'NIRF rank', placement: 'Placement outcome',
  contact: 'Official contact', facility: 'Campus facility',
};

import { z } from 'zod';

// ---------- primitives ----------

/** IDs are cuids in practice; accept a conservative safe charset and length. */
export const idSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, 'Invalid id');

/** Accepts either a college id or a slug (lowercase words joined by hyphens). */
export const collegeKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9_-]{1,120}$/i, 'Invalid college id');

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Trimmed user text with control characters stripped, length-checked after cleaning. */
function userText(min: number, max: number, label: string) {
  return z
    .string({ error: `${label} is required` })
    .transform((s) => s.replace(CONTROL_CHARS, '').trim())
    .pipe(
      z
        .string()
        .min(min, `${label} must be at least ${min} characters`)
        .max(max, `${label} must be at most ${max} characters`)
        .refine((s) => (s.match(/https?:\/\//gi) ?? []).length <= 2, `${label} contains too many links`),
    );
}

const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

function optionalInt(min: number, max: number) {
  return z.preprocess(emptyToUndefined, z.coerce.number().int().min(min).max(max).optional());
}

function optionalNumber(min: number, max: number) {
  return z.preprocess(emptyToUndefined, z.coerce.number().finite().min(min).max(max).optional());
}

function queryBool(defaultValue: boolean) {
  return z.preprocess(
    (v) => (v === 'true' || v === '1' ? true : v === 'false' || v === '0' ? false : emptyToUndefined(v)),
    z.boolean().default(defaultValue),
  );
}

function csv<T extends z.ZodType>(item: T, maxItems = 10) {
  return z.preprocess(
    (v) =>
      typeof v === 'string'
        ? v
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : emptyToUndefined(v),
    z.array(item).max(maxItems).optional(),
  );
}

// ---------- auth ----------

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234',
  '12345678', '123456789', '1234567890', 'qwertyuiop', 'qwerty123', 'iloveyou12',
  'letmein123', 'welcome123', 'admin12345', 'abcdefghij', '1111111111',
]);

export const emailSchema = z
  .string({ error: 'Email is required' })
  .trim()
  .max(254, 'Email is too long')
  .transform((s) => s.toLowerCase())
  .pipe(z.email('Enter a valid email address'));

export const passwordSchema = z
  .string({ error: 'Password is required' })
  .min(10, 'Password must be at least 10 characters')
  // bcrypt only uses the first 72 bytes; longer passwords give a false sense of security.
  .refine((p) => new TextEncoder().encode(p).length <= 72, 'Password must be at most 72 bytes')
  .refine((p) => !COMMON_PASSWORDS.has(p.toLowerCase()), 'This password is too common')
  .refine((p) => new Set(p).size >= 4, 'Password is too repetitive');

export const registerSchema = z.object({
  name: userText(1, 100, 'Name').refine((s) => !/[<>]/.test(s), 'Name cannot contain < or >'),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

// ---------- community ----------

export const questionCreateSchema = z.object({
  collegeId: idSchema,
  text: userText(10, 500, 'Question'),
});

export const answerCreateSchema = z.object({
  questionId: idSchema,
  text: userText(5, 1000, 'Answer'),
});

export const moderationSchema = z.object({
  type: z.enum(['question', 'answer']),
  id: idSchema,
  status: z.enum(['VISIBLE', 'HIDDEN']),
  reason: z.string().trim().max(300).optional(),
});

// ---------- saved items ----------

export const saveCollegeSchema = z.object({ collegeId: idSchema });

export const comparisonCreateSchema = z.object({
  collegeIds: z
    .array(idSchema)
    .min(2, 'Select 2 to 3 colleges')
    .max(3, 'Select 2 to 3 colleges')
    .refine((ids) => new Set(ids).size === ids.length, 'Colleges must be different'),
});

// ---------- listing ----------

export const NAAC_GRADES = ['A++', 'A+', 'A', 'B++', 'B+', 'B', 'C', 'D'] as const;
export const EXAMS = ['JEE_MAIN', 'JEE_ADVANCED', 'NEET', 'CAT', 'GATE'] as const;
export const SORTS = ['name', 'fees_asc', 'fees_desc', 'newest', 'rating'] as const;

export const collegesQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    state: z.string().trim().max(60).optional(),
    type: z.enum(['GOVERNMENT', 'PRIVATE']).optional().or(z.literal('').transform(() => undefined)),
    minFees: optionalInt(0, 100_000_000),
    maxFees: optionalInt(0, 100_000_000),
    naac: csv(z.enum(NAAC_GRADES), NAAC_GRADES.length),
    minRating: optionalNumber(0, 5),
    courses: csv(z.string().max(30), 15),
    exams: csv(z.enum(EXAMS), EXAMS.length),
    established: z
      .enum(['before_1960', '1960_1990', '1990_2010', 'after_2010'])
      .optional()
      .or(z.literal('').transform(() => undefined)),
    page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(1000).default(1)),
    limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(50).default(12)),
    sort: z.enum(SORTS).default('name'),
    distinct: z.enum(['states']).optional(),
  })
  .refine((q) => q.minFees === undefined || q.maxFees === undefined || q.minFees <= q.maxFees, {
    message: 'minFees must be less than or equal to maxFees',
    path: ['minFees'],
  });

export type CollegesQuery = z.infer<typeof collegesQuerySchema>;

// ---------- predictor ----------

export const SEAT_CATEGORIES = ['OPEN', 'EWS', 'OBC_NCL', 'SC', 'ST'] as const;
export const GENDERS = ['FEMALE', 'MALE', 'OTHER', 'UNSPECIFIED'] as const;

export const predictQuerySchema = z
  .object({
    exam: z.enum(EXAMS, { error: 'Choose an exam' }),
    rank: optionalInt(1, 3_000_000), // CRL / AIR
    categoryRank: optionalInt(1, 3_000_000),
    pwdRank: optionalInt(1, 3_000_000),
    score: optionalNumber(0, 1000), // CAT percentile (0-100) or GATE score (0-1000)
    category: z.enum(SEAT_CATEGORIES).default('OPEN'),
    isPwd: queryBool(false),
    gender: z.enum(GENDERS).default('UNSPECIFIED'),
    homeState: z.string().trim().max(60).optional(),
    states: csv(z.string().trim().max(60), 10),
    branches: csv(z.string().trim().max(60), 10),
    maxFees: optionalInt(0, 100_000_000),
    includeUnknownFees: queryBool(true),
    round: optionalInt(1, 10),
    includeUnlikely: queryBool(false),
    limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100).default(50)),
  })
  .superRefine((q, ctx) => {
    const rankExam = q.exam === 'JEE_MAIN' || q.exam === 'JEE_ADVANCED' || q.exam === 'NEET';
    if (rankExam && q.rank === undefined) {
      ctx.addIssue({ code: 'custom', path: ['rank'], message: 'Enter your rank (CRL / All India Rank)' });
    }
    if (!rankExam && q.score === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['score'],
        message: q.exam === 'CAT' ? 'Enter your CAT percentile' : 'Enter your GATE score',
      });
    }
    if (q.exam === 'CAT' && q.score !== undefined && q.score > 100) {
      ctx.addIssue({ code: 'custom', path: ['score'], message: 'CAT percentile must be between 0 and 100' });
    }
    if (q.isPwd && rankExam && q.pwdRank === undefined) {
      ctx.addIssue({ code: 'custom', path: ['pwdRank'], message: 'Enter your PwD rank to include PwD seats' });
    }
  });

export type PredictQuery = z.infer<typeof predictQuerySchema>;

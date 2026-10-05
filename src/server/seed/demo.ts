import type { PrismaClient, CollegeType, SeatCategory, SeatPool } from '@prisma/client';
import demoColleges from './demo-colleges.json';

/**
 * DEMO college rows. Names, cities and states are public facts; every metric
 * (fees, placement %, packages, students, recruiters) was hand-typed for the
 * original prototype and is NOT verified. Rows are written with
 * dataStatus = DEMO, and the UI labels them as demo values.
 *
 * Contact details, ratings and cutoffs are intentionally absent: the old seed
 * generated random phone numbers and invented domains.
 */
interface DemoCollege {
  slug: string;
  name: string;
  shortName: string;
  city: string;
  state: string;
  type: CollegeType;
  establishedYear: number;
  totalStudents: number;
  naacGrade: string;
  annualFees: number;
  placementPct: number;
  avgPackage: number;
  highestPackage: number;
  topRecruiters: string[];
  courses: string[];
}

export const DEMO_COLLEGES = demoColleges as DemoCollege[];

/** Non-destructive: creates missing demo colleges, never deletes or overwrites user data. */
export async function seedDemoColleges(db: PrismaClient): Promise<{ created: number; skipped: number }> {
  const existing = new Set(
    (await db.college.findMany({ select: { slug: true } })).map((c) => c.slug),
  );
  const toCreate = DEMO_COLLEGES.filter((c) => !existing.has(c.slug));
  if (toCreate.length) {
    await db.college.createMany({
      data: toCreate.map((c) => ({ ...c, dataStatus: 'DEMO' as const })),
      skipDuplicates: true,
    });
  }
  return { created: toCreate.length, skipped: DEMO_COLLEGES.length - toCreate.length };
}

// ---------------------------------------------------------------------------
// Synthetic predictor fixture: fictional institutes with fictional cutoffs.
// Real college names are NEVER attached to invented cutoffs.
// ---------------------------------------------------------------------------

export const SYNTHETIC_SOURCE_URL =
  'https://github.com/KevinKattakayam/collegefind/blob/main/docs/PREDICTOR.md#synthetic-fixture';

const SYNTHETIC_INSTITUTES = [
  { slug: 'synthetic-institute-alpha', name: 'Synthetic Institute of Technology Alpha', shortName: 'SIT Alpha', city: 'Kozhikode', state: 'Kerala', quotas: ['HS', 'OS'], base: 9000, fees: 150000 },
  { slug: 'synthetic-institute-beta', name: 'Synthetic Institute of Technology Beta', shortName: 'SIT Beta', city: 'Mysuru', state: 'Karnataka', quotas: ['AI'], base: 25000, fees: 220000 },
  { slug: 'synthetic-institute-gamma', name: 'Synthetic Institute of Technology Gamma', shortName: 'SIT Gamma', city: 'Coimbatore', state: 'Tamil Nadu', quotas: ['HS', 'OS'], base: 60000, fees: 90000 },
] as const;

const SYNTHETIC_PROGRAMS = [
  { name: 'Computer Science and Engineering (4 Years, Bachelor of Technology)', branch: 'Computer Science and Engineering', factor: 1 },
  { name: 'Mechanical Engineering (4 Years, Bachelor of Technology)', branch: 'Mechanical Engineering', factor: 2.5 },
];

const YEAR_FACTORS: Record<number, number> = { 2023: 0.95, 2024: 1.0, 2025: 1.05 };
const QUOTA_FACTORS: Record<string, number> = { AI: 1, OS: 1, HS: 1.6 };
const CATEGORY_FACTORS: Partial<Record<SeatCategory, number>> = { OPEN: 1, OBC_NCL: 0.3 };
const POOL_FACTORS: Record<SeatPool, number> = { GENDER_NEUTRAL: 1, FEMALE_ONLY: 1.5 };

export async function seedSyntheticCutoffs(db: PrismaClient): Promise<{ records: number }> {
  const source =
    (await db.source.findFirst({ where: { url: SYNTHETIC_SOURCE_URL } })) ??
    (await db.source.create({
      data: {
        name: 'Synthetic test fixture (not real data)',
        publisher: 'CollegeFind (synthetic)',
        url: SYNTHETIC_SOURCE_URL,
        license: 'Synthetic',
        retrievedAt: new Date('2025-07-01T00:00:00Z'),
        notes: 'Fictional institutes and numbers used only for tests and local demos.',
      },
    }));

  let records = 0;
  for (const inst of SYNTHETIC_INSTITUTES) {
    const college = await db.college.upsert({
      where: { slug: inst.slug },
      update: {},
      create: {
        slug: inst.slug,
        name: inst.name,
        shortName: inst.shortName,
        city: inst.city,
        state: inst.state,
        type: 'GOVERNMENT',
        annualFees: inst.fees,
        courses: ['B.Tech'],
        dataStatus: 'DEMO',
      },
    });
    for (const p of SYNTHETIC_PROGRAMS) {
      const program = await db.program.upsert({
        where: { collegeId_name: { collegeId: college.id, name: p.name } },
        update: {},
        create: { collegeId: college.id, name: p.name, branch: p.branch, degree: 'Bachelor of Technology', durationYears: 4 },
      });
      for (const [yearStr, yf] of Object.entries(YEAR_FACTORS)) {
        for (const quota of inst.quotas) {
          for (const [category, cf] of Object.entries(CATEGORY_FACTORS) as [SeatCategory, number][]) {
            for (const [seatPool, pf] of Object.entries(POOL_FACTORS) as [SeatPool, number][]) {
              for (const round of [1, 5]) {
                const finalClose = Math.round(inst.base * p.factor * yf * QUOTA_FACTORS[quota] * cf * pf);
                const closing = round === 1 ? Math.round(finalClose * 0.8) : finalClose;
                const data = {
                  programId: program.id,
                  exam: 'JEE_MAIN' as const,
                  year: Number(yearStr),
                  round,
                  quota,
                  category,
                  isPwd: false,
                  seatPool,
                  metric: 'RANK' as const,
                  openingValue: Math.round(closing * 0.4),
                  closingValue: closing,
                  sourceId: source.id,
                };
                await db.cutoffRecord.upsert({
                  where: {
                    naturalKey: {
                      programId: data.programId,
                      exam: data.exam,
                      year: data.year,
                      round,
                      quota,
                      category,
                      isPwd: false,
                      seatPool,
                    },
                  },
                  update: { closingValue: closing, openingValue: data.openingValue },
                  create: data,
                });
                records++;
              }
            }
          }
        }
      }
    }
  }
  return { records };
}

/**
 * CLI seed: `npm run db:seed`.
 *   - Local only: non-destructive insert of DEMO colleges (missing slugs only).
 *   - SEED_SYNTHETIC_CUTOFFS=true: adds fictional institutes + cutoffs so the
 *     predictor can be demoed locally. Refused when NODE_ENV=production.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { seedDemoColleges, seedSyntheticCutoffs } from '../src/server/seed/demo';

if (process.env.NODE_ENV === 'production') {
  console.error('Demo and synthetic seeding are disabled in production');
  process.exit(1);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 2 }) });
  try {
    const demo = await seedDemoColleges(db);
    console.log(`Demo colleges: created ${demo.created}, already present ${demo.skipped}`);
    if (process.env.SEED_SYNTHETIC_CUTOFFS === 'true') {
      const syn = await seedSyntheticCutoffs(db);
      console.log(`Synthetic cutoff records upserted: ${syn.records}`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch(() => {
  console.error("Seed failed. Check the disposable database configuration.");
  process.exit(1);
});

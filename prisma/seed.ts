/**
 * CLI seed: `npm run db:seed`.
 *   - Always: non-destructive insert of DEMO colleges (missing slugs only).
 *   - SEED_SYNTHETIC_CUTOFFS=true: adds fictional institutes + cutoffs so the
 *     predictor can be demoed locally. Refused when NODE_ENV=production.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { seedDemoColleges, seedSyntheticCutoffs } from '../src/server/seed/demo';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const db = new PrismaClient({ adapter: new PrismaPg(new pg.Pool({ connectionString, max: 2 })) });
  try {
    const demo = await seedDemoColleges(db);
    console.log(`Demo colleges: created ${demo.created}, already present ${demo.skipped}`);
    if (process.env.SEED_SYNTHETIC_CUTOFFS === 'true') {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Refusing to seed synthetic cutoffs with NODE_ENV=production');
      }
      const syn = await seedSyntheticCutoffs(db);
      console.log(`Synthetic cutoff records upserted: ${syn.records}`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

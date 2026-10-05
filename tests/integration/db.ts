import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

let client: PrismaClient | undefined;

export function testDb(): PrismaClient {
  if (!client) {
    const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!connectionString) throw new Error('TEST_DATABASE_URL is not set');
    client = new PrismaClient({ adapter: new PrismaPg(new pg.Pool({ connectionString, max: 4 })) });
  }
  return client;
}

/** Wipes all data. Order respects foreign keys; CASCADE covers the rest. */
export async function resetDb() {
  const db = testDb();
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE "AuditLog", "Review", "Answer", "Question", "SavedComparison", "SavedCollege",
      "CutoffRecord", "NirfRanking", "FeesRecord", "PlacementRecord", "Program", "Source",
      "College", "User" RESTART IDENTITY CASCADE;
  `);
}

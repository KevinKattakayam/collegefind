import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { assertDisposableTestTarget } from './target';

let client: PrismaClient | undefined;

export function testDb(): PrismaClient {
  const connectionString = assertDisposableTestTarget();
  if (!client) {
    client = new PrismaClient({ adapter: new PrismaPg(new pg.Pool({ connectionString, max: 4 })) });
  }
  return client;
}

/** Wipes all data. Order respects foreign keys; CASCADE covers the rest. */
export async function resetDb() {
  assertDisposableTestTarget();
  const db = testDb();
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE "AuditLog", "Review", "Answer", "Question", "SavedComparison", "SavedCollege",
      "CutoffRecord", "NirfRanking", "FeesRecord", "PlacementRecord", "Program", "Source",
      "College", "User" RESTART IDENTITY CASCADE;
  `);
}

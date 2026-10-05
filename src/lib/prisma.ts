import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // TLS is controlled by the connection string (e.g. `sslmode=require` for Neon).
  // Certificate verification is left ON. The previous code set
  // `rejectUnauthorized: false`, which accepted any certificate and allowed
  // man-in-the-middle attacks on database traffic.
  const pool = new pg.Pool({
    connectionString,
    max: Number(process.env.DB_POOL_MAX ?? 5),
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

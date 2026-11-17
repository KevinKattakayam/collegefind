import { getEnv } from './env';
import { projectPublicResult } from '@/server/public-evidence';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const env = getEnv();
  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // TLS is controlled by the connection string (e.g. `sslmode=require` for Neon).
  // Certificate verification is left ON. The previous code set
  // `rejectUnauthorized: false`, which accepted any certificate and allowed
  // man-in-the-middle attacks on database traffic.
  const pool = new pg.Pool({
    connectionString,
    max: env.DB_POOL_MAX,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });
  return new PrismaClient({ adapter: new PrismaPg(pool) }).$extends({
    query: { $allModels: { async $allOperations({ model, operation, args, query }) {
      const pagination = args as { take?: number; skip?: number; distinct?: string | string[] };
      const savedPage = { take: pagination.take, skip: pagination.skip, distinct: pagination.distinct };
      const typedFact = ['CutoffRecord', 'FeesRecord', 'PlacementRecord', 'NirfRanking'].includes(model);
      if (typedFact && operation.startsWith('find')) {
        if (operation === 'findMany') { delete pagination.take; delete pagination.skip; delete pagination.distinct; }
        const options = args as { select?: Record<string, unknown>; include?: Record<string, unknown> };
        if (options.select) options.select.decisions = true;
        else options.include = { ...options.include, decisions: true };
      }
      const result = await query(args);
      if (typedFact && operation.startsWith('find')) {
        const approved = (row: unknown) => {
          if (!row || typeof row !== 'object') return false;
          const decisions = (row as { decisions?: {status: string; createdAt: Date}[] }).decisions ?? [];
          const last = [...decisions].sort((a,b) => b.createdAt.getTime()-a.createdAt.getTime());
          return last[0]?.status === 'APPROVED' && !last.some((d) => d.createdAt.getTime() === last[0].createdAt.getTime() && d.status !== 'APPROVED');
        };
        if (Array.isArray(result)) {
          let rows = result.filter(approved);
          if (savedPage.distinct) {
            const keys = Array.isArray(savedPage.distinct) ? savedPage.distinct : [savedPage.distinct];
            const seen = new Set<string>();
            rows = rows.filter((row) => { const key = JSON.stringify(keys.map((field) => (row as Record<string, unknown>)[field])); if (seen.has(key)) return false; seen.add(key); return true; });
          }
          const start = savedPage.skip ?? 0;
          rows = rows.slice(start, savedPage.take === undefined ? undefined : start + savedPage.take);
          return projectPublicResult(rows.map((row) => { const { decisions: _decisions, ...publicRow } = row as Record<string, unknown>; void _decisions; return publicRow; }));
        }
        if (!approved(result)) return null;
        const { decisions: _decisions, ...publicRow } = result as Record<string, unknown>;
        void _decisions;
        return projectPublicResult(publicRow);
      }
      return operation.startsWith('find') ? projectPublicResult(result) : result;
    } } },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

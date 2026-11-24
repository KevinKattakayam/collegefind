import { getEnv } from './env';
import { projectPublicResult } from '@/server/public-evidence';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { sourceUseStatusSchema } from '@/server/source-use-review';

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
  // The adapter owns the pool and closes it on Prisma disconnect.
  const adapter = new PrismaPg({
    connectionString,
    max: env.DB_POOL_MAX,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });
  const base = new PrismaClient({ adapter });
  async function attachSourceUseStatus<T>(result: T): Promise<T> {
    const colleges = (Array.isArray(result) ? result : [result]).filter((row): row is Record<string, unknown> => !!row && typeof row === 'object');
    const claims = colleges.flatMap((college) => Array.isArray(college.evidence) ? college.evidence as Record<string, unknown>[] : []);
    const sourceIds = [...new Set(claims.map((claim) => (claim.source as Record<string, unknown> | undefined)?.id).filter((id): id is string => typeof id === 'string'))];
    if (!sourceIds.length) return result;
    const audits = await base.auditLog.findMany({
      where: { action: 'source.use.assessment', targetType: 'Source', targetId: { in: sourceIds } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { targetId: true, metadata: true },
    });
    const latest = new Map<string, string>();
    const seen = new Set<string>();
    for (const audit of audits) {
      if (seen.has(audit.targetId)) continue;
      seen.add(audit.targetId);
      const parsed = sourceUseStatusSchema.safeParse((audit.metadata as { status?: unknown } | null)?.status);
      latest.set(audit.targetId, parsed.success ? parsed.data : 'UNRESOLVED');
    }
    for (const claim of claims) {
      const source = claim.source as Record<string, unknown> | undefined;
      if (source && typeof source.id === 'string') source.sourceUseStatus = latest.get(source.id) ?? 'UNASSESSED';
    }
    return result;
  }
  return base.$extends({
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
      if (!operation.startsWith('find')) return result;
      const enriched = model === 'College' ? await attachSourceUseStatus(result) : result;
      return projectPublicResult(enriched);
    } } },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

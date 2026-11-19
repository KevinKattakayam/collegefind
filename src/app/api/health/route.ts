import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger, errorFields } from '@/lib/logger';
import { rateLimitBackendHealth } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Dependency readiness. Use /api/live for a dependency-free liveness probe. */
export async function GET() {
  const dbProbe = prisma.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(error => {
    logger.warn('health_db_failed', errorFields(error));
    return 'unavailable' as const;
  });
  const [db, rateLimit] = await Promise.all([dbProbe, rateLimitBackendHealth()]);
  const ready = db === 'ok' && rateLimit !== 'unavailable';
  return NextResponse.json(
    { status: ready ? 'ok' : 'degraded', db, rateLimit },
    { headers: { 'Cache-Control': 'no-store' }, status: ready ? 200 : 503 },
  );
}

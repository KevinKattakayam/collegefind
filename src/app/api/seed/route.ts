import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { ApiError, clientIp, withErrorHandling } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { seedDemoColleges, seedSyntheticCutoffs } from '@/server/seed/demo';

/**
 * POST /api/seed — operational endpoint, OFF by default.
 *
 * - Responds 404 unless SEED_ENABLED=true (and, in production, also
 *   SEED_ALLOW_PRODUCTION=true). Prefer `npm run db:seed` from your machine.
 * - Requires `Authorization: Bearer <ADMIN_SEED_TOKEN>` (>= 32 chars).
 * - Non-destructive: only inserts missing demo colleges. There is no
 *   "force"/wipe option over HTTP.
 */
function notFound() {
  return new ApiError(404, 'NOT_FOUND', 'Not found');
}

function tokenMatches(provided: string, expected: string) {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export const POST = withErrorHandling(async (request: Request) => {
  const isProd = process.env.NODE_ENV === 'production';
  if (process.env.SEED_ENABLED !== 'true') throw notFound();
  if (isProd && process.env.SEED_ALLOW_PRODUCTION !== 'true') throw notFound();
  const expected = process.env.ADMIN_SEED_TOKEN;
  if (!expected || expected.length < 32) {
    logger.error('seed_misconfigured', { reason: 'ADMIN_SEED_TOKEN missing or shorter than 32 chars' });
    throw notFound();
  }

  const ip = clientIp(request);
  await enforceRateLimit('seed', ip);

  const auth = request.headers.get('authorization') ?? '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!provided || !tokenMatches(provided, expected)) {
    logger.warn('seed_unauthorized', { ip });
    throw new ApiError(401, 'UNAUTHENTICATED', 'Unauthorized');
  }

  const synthetic = new URL(request.url).searchParams.get('synthetic') === 'true';
  if (synthetic && isProd) throw new ApiError(400, 'NOT_ALLOWED', 'Synthetic data is never seeded in production');

  const demo = await seedDemoColleges(prisma);
  const syn = synthetic ? await seedSyntheticCutoffs(prisma) : null;

  await prisma.auditLog.create({
    data: {
      action: 'seed.run',
      targetType: 'database',
      targetId: 'colleges',
      metadata: { created: demo.created, skipped: demo.skipped, synthetic: syn?.records ?? 0, ip },
    },
  });
  logger.info('seed_run', { created: demo.created, synthetic: Boolean(syn) });
  return NextResponse.json({ success: true, ...demo, syntheticRecords: syn?.records ?? 0 });
});

export const GET = withErrorHandling(async () => {
  throw notFound();
});

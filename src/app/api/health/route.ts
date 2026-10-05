import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger, errorFields } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/** Liveness + database check for uptime monitors. Exposes no internals. */
export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: 'ok', db: 'ok', latencyMs: Date.now() - started },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    logger.error('health_db_failed', errorFields(err));
    return NextResponse.json({ status: 'degraded', db: 'error' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

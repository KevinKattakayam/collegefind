import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';
import { assertSameOrigin, readJson, withErrorHandling } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { reviewFieldEvidence, reviewTypedRecord } from '@/server/ingest/field-evidence';
const schema = z.object({ kind: z.enum(['field', 'cutoff', 'fees', 'placement', 'ranking']), id: z.string().regex(/^[a-zA-Z0-9_-]{1,120}$/), status: z.enum(['APPROVED','REJECTED']), reason: z.string().trim().min(3).max(2000) }).strict();
export const POST = withErrorHandling(async (request: Request) => {
  const reviewer = await requireAdmin();
  assertSameOrigin(request);
  await enforceRateLimit('moderation', reviewer.id);
  const input = await readJson(request, schema);
  const decision = input.kind === 'field'
    ? await reviewFieldEvidence(prisma, { evidenceId: input.id, reviewerId: reviewer.id, status: input.status, reason: input.reason })
    : await reviewTypedRecord(prisma, { kind: input.kind, recordId: input.id, reviewerId: reviewer.id, status: input.status, reason: input.reason });
  return NextResponse.json({ decisionId: decision.id }, { headers: { 'Cache-Control': 'no-store' } });
});

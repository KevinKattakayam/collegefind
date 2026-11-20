import { evidenceQueue, queueQuery } from '@/server/evidence-queue';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';
import { assertSameOrigin, readJson, withErrorHandling, ApiError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { reviewFieldEvidence, reviewTypedRecord } from '@/server/ingest/field-evidence';
const schema = z.object({ kind: z.enum(['field', 'cutoff', 'fees', 'placement', 'ranking']), id: z.string().regex(/^[a-zA-Z0-9_-]{1,120}$/), status: z.enum(['APPROVED','REJECTED','PENDING']), reason: z.string().trim().min(3).max(2000), expectedDecisionId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).nullable().optional() }).strict();
export const GET=withErrorHandling(async(request:Request)=>{
 await requireAdmin();const parsed=queueQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
 if(!parsed.success)throw new ApiError(400,'INVALID_INPUT','Invalid queue filters');
 return NextResponse.json(await evidenceQueue(prisma,parsed.data),{headers:{'Cache-Control':'no-store'}});
});
export const POST = withErrorHandling(async (request: Request) => {
  const reviewer = await requireAdmin();
  assertSameOrigin(request);
  await enforceRateLimit('moderation', reviewer.id);
  const input = await readJson(request, schema);
  const base = { reviewerId: reviewer.id, reason: input.reason, expectedDecisionId: input.expectedDecisionId };
  let decision;
  if (input.kind === 'field') {
    decision = await reviewFieldEvidence(prisma, { ...base, evidenceId: input.id, status: input.status });
  } else {
    if (input.status === 'PENDING') throw new ApiError(400, 'INVALID_INPUT', 'Only field evidence can be held here');
    decision = await reviewTypedRecord(prisma, { ...base, kind: input.kind, recordId: input.id, status: input.status });
  }
  return NextResponse.json({ decisionId: decision.id }, { headers: { 'Cache-Control': 'no-store' } });
});

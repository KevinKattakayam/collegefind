import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';
import { assertSameOrigin, readJson, withErrorHandling } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { recordSourceUseAssessment, sourceUseReviewSchema } from '@/server/source-use-review';

export const POST = withErrorHandling(async (request: Request) => {
  const reviewer = await requireAdmin();
  assertSameOrigin(request);
  await enforceRateLimit('moderation', reviewer.id);
  const input = await readJson(request, sourceUseReviewSchema);
  const assessment = await recordSourceUseAssessment(prisma, { ...input, reviewerId: reviewer.id });
  return NextResponse.json({ assessmentId: assessment.id }, { headers: { 'Cache-Control': 'no-store' } });
});

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ApiError, assertSameOrigin, CACHE_NONE, readJson, withErrorHandling } from '@/lib/http';
import { requireUser } from '@/lib/session';
import { enforceRateLimit } from '@/lib/rate-limit';

const statuses = ['INTERESTED', 'PREPARING', 'APPLIED', 'AWAITING_RESULT', 'OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'] as const;
const update = z.object({
  expectedVersion: z.number().int().nonnegative(),
  collegeId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).nullable(),
  institutionName: z.string().trim().min(1).max(200).nullable(),
  programName: z.string().trim().max(200).nullable(),
  counsellingDetails: z.string().trim().max(500).nullable(),
  cycle: z.string().trim().min(4).max(40),
  status: z.enum(statuses),
  submittedAt: z.string().date().nullable(),
  nextAction: z.string().trim().max(300).nullable(),
  reference: z.string().trim().max(100).nullable(),
  note: z.string().max(2000).nullable(),
}).strict().superRefine((value, context) => {
  if (Boolean(value.collegeId) === Boolean(value.institutionName)) {
    context.addIssue({ code: 'custom', message: 'Select one catalogue college or enter a personal institution name', path: ['institutionName'] });
  }
});

type Context = { params: Promise<{ id: string; applicationId: string }> };

export const PATCH = withErrorHandling(async (request: Request, context: Context) => {
  const user = await requireUser();
  assertSameOrigin(request);
  await enforceRateLimit('save', user.id);
  const { id: rawPlanId, applicationId } = await context.params;
  const planId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).parse(rawPlanId);
  const input = await readJson(request, update);
  if (input.collegeId && !await prisma.college.findUnique({ where: { id: input.collegeId }, select: { id: true } })) {
    throw new ApiError(404, 'NOT_FOUND', 'College not found');
  }

  const application = await prisma.$transaction(async (tx) => {
    const owned = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "AdmissionPlan" WHERE id = ${planId} AND "userId" = ${user.id} FOR UPDATE`;
    if (!owned.length) throw new ApiError(404, 'NOT_FOUND', 'Plan not found');
    const result = await tx.planApplication.updateMany({
      where: { id: applicationId, planId, version: input.expectedVersion },
      data: {
        collegeId: input.collegeId,
        institutionName: input.institutionName,
        programName: input.programName || null,
        counsellingDetails: input.counsellingDetails || null,
        cycle: input.cycle,
        status: input.status,
        submittedAt: input.submittedAt ? new Date(`${input.submittedAt}T00:00:00.000Z`) : null,
        nextAction: input.nextAction || null,
        reference: input.reference || null,
        note: input.note || null,
        version: { increment: 1 },
      },
    });
    if (!result.count) {
      const exists = await tx.planApplication.findFirst({ where: { id: applicationId, planId }, select: { id: true } });
      if (!exists) throw new ApiError(404, 'NOT_FOUND', 'Application not found');
      throw new ApiError(409, 'STALE_APPLICATION', 'This application changed in another session. Reload before saving.');
    }
    return tx.planApplication.findFirstOrThrow({
      where: { id: applicationId, planId },
      include: { college: { select: { id: true, slug: true, name: true, city: true, state: true } } },
    });
  });
  return NextResponse.json({ application }, { headers: { 'Cache-Control': CACHE_NONE } });
});

export const DELETE = withErrorHandling(async (request: Request, context: Context) => {
  const user = await requireUser();
  assertSameOrigin(request);
  await enforceRateLimit('save', user.id);
  const { id: rawPlanId, applicationId } = await context.params;
  const planId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).parse(rawPlanId);
  const plan = await prisma.admissionPlan.findFirst({ where: { id: planId, userId: user.id }, select: { id: true } });
  if (!plan) throw new ApiError(404, 'NOT_FOUND', 'Plan not found');
  const { expectedVersion } = await readJson(request, z.object({ expectedVersion: z.number().int().nonnegative() }).strict());
  await prisma.$transaction(async (tx) => {
    const owned = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "AdmissionPlan" WHERE id = ${planId} AND "userId" = ${user.id} FOR UPDATE`;
    if (!owned.length) throw new ApiError(404, 'NOT_FOUND', 'Plan not found');
    const result = await tx.planApplication.deleteMany({ where: { id: applicationId, planId, version: expectedVersion } });
    if (!result.count) {
      const exists = await tx.planApplication.findFirst({ where: { id: applicationId, planId }, select: { id: true } });
      if (!exists) throw new ApiError(404, 'NOT_FOUND', 'Application not found');
      throw new ApiError(409, 'STALE_APPLICATION', 'This application changed in another session. Reload before deleting.');
    }
  });
  return NextResponse.json({ deleted: true }, { headers: { 'Cache-Control': CACHE_NONE } });
});

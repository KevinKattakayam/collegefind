import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ApiError, assertSameOrigin, CACHE_NONE, readJson, withErrorHandling } from '@/lib/http';
import { requireUser } from '@/lib/session';
import { enforceRateLimit } from '@/lib/rate-limit';

const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const statuses = ['INTERESTED', 'PREPARING', 'APPLIED', 'AWAITING_RESULT', 'OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'] as const;
const applicationInput = z.object({
  collegeId: id.nullable().optional(),
  institutionName: z.string().trim().min(1).max(200).nullable().optional(),
  programName: z.string().trim().max(200).nullable().optional(),
  counsellingDetails: z.string().trim().max(500).nullable().optional(),
  cycle: z.string().trim().min(4).max(40).optional(),
  status: z.enum(statuses).default('INTERESTED'),
  submittedAt: z.string().date().nullable().optional(),
  nextAction: z.string().trim().max(300).nullable().optional(),
  reference: z.string().trim().max(100).nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
}).strict().superRefine((value, context) => {
  if (Boolean(value.collegeId) === Boolean(value.institutionName)) {
    context.addIssue({ code: 'custom', message: 'Select one catalogue college or enter a personal institution name', path: ['institutionName'] });
  }
});

type Context = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_request: Request, context: Context) => {
  const user = await requireUser();
  const { id: planId } = await context.params;
  const plan = await prisma.admissionPlan.findFirst({ where: { id: id.parse(planId), userId: user.id }, select: { id: true } });
  if (!plan) throw new ApiError(404, 'NOT_FOUND', 'Plan not found');
  const applications = await prisma.planApplication.findMany({
    where: { planId },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    include: { college: { select: { id: true, slug: true, name: true, city: true, state: true } } },
  });
  return NextResponse.json({ applications }, { headers: { 'Cache-Control': CACHE_NONE } });
});

export const POST = withErrorHandling(async (request: Request, context: Context) => {
  const user = await requireUser();
  assertSameOrigin(request);
  await enforceRateLimit('save', user.id);
  const { id: planId } = await context.params;
  const values = await readJson(request, applicationInput);
  const cleanPlanId = id.parse(planId);
  if (values.collegeId && !await prisma.college.findUnique({ where: { id: values.collegeId }, select: { id: true } })) {
    throw new ApiError(404, 'NOT_FOUND', 'College not found');
  }

  const application = await prisma.$transaction(async (tx) => {
    const owned = await tx.$queryRaw<Array<{ id: string; cycle: string }>>`
      SELECT id, cycle FROM "AdmissionPlan" WHERE id = ${cleanPlanId} AND "userId" = ${user.id} FOR UPDATE`;
    if (!owned.length) throw new ApiError(404, 'NOT_FOUND', 'Plan not found');
    return tx.planApplication.create({
      data: {
        planId: cleanPlanId,
        collegeId: values.collegeId ?? null,
        institutionName: values.institutionName ?? null,
        programName: values.programName || null,
        counsellingDetails: values.counsellingDetails || null,
        cycle: values.cycle ?? owned[0].cycle,
        status: values.status,
        submittedAt: values.submittedAt ? new Date(`${values.submittedAt}T00:00:00.000Z`) : null,
        nextAction: values.nextAction || null,
        reference: values.reference || null,
        note: values.note || null,
      },
      include: { college: { select: { id: true, slug: true, name: true, city: true, state: true } } },
    });
  });
  return NextResponse.json({ application }, { status: 201, headers: { 'Cache-Control': CACHE_NONE } });
});

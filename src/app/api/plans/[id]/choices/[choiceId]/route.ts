import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ApiError, assertSameOrigin, CACHE_NONE, readJson, withErrorHandling } from '@/lib/http';
import { requireUser } from '@/lib/session';
import { enforceRateLimit } from '@/lib/rate-limit';

const update = z.object({
  collegeId: z.string().optional(),
  programId: z.string().optional(),
  label: z.string().trim().min(1).max(200),
  note: z.string().max(2000).optional(),
}).strict();

type Context = { params: Promise<{ id: string; choiceId: string }> };

export const PATCH = withErrorHandling(async (request: Request, context: Context) => {
  const user = await requireUser();
  assertSameOrigin(request);
  await enforceRateLimit('save', user.id);
  const { id, choiceId } = await context.params;
  const plan = await prisma.admissionPlan.findFirst({
    where: { id, userId: user.id },
    select: { id: true, cycle: true },
  });
  if (!plan) throw new ApiError(404, 'NOT_FOUND', 'Plan not found');

  const values = await readJson(request, update);
  if (values.collegeId && !await prisma.college.findUnique({
    where: { id: values.collegeId }, select: { id: true },
  })) throw new ApiError(404, 'NOT_FOUND', 'College not found');
  if (values.programId && (!values.collegeId || !await prisma.program.findFirst({
    where: { id: values.programId, collegeId: values.collegeId }, select: { id: true },
  }))) throw new ApiError(400, 'INVALID_PROGRAM', 'Programme is not attached to the selected college');

  const choice = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "AdmissionPlan" WHERE id = ${id} FOR UPDATE`;
    const current = await tx.planChoice.findFirst({ where: { id: choiceId, planId: id }, select: { id: true } });
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Choice not found');
    const duplicate = await tx.planChoice.findFirst({
      where: {
        planId: id,
        cycle: plan.cycle,
        id: { not: choiceId },
        label: { equals: values.label, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (duplicate) throw new ApiError(409, 'DUPLICATE_CHOICE', 'This choice is already in your plan');
    return tx.planChoice.update({ where: { id: choiceId }, data: values });
  });

  return NextResponse.json({ choice }, { headers: { 'Cache-Control': CACHE_NONE } });
});

export const DELETE = withErrorHandling(async (request: Request, context: Context) => {
  const user = await requireUser();
  assertSameOrigin(request);
  await enforceRateLimit('save', user.id);
  const { id, choiceId } = await context.params;
  const plan = await prisma.admissionPlan.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!plan) throw new ApiError(404, 'NOT_FOUND', 'Plan not found');
  const result = await prisma.planChoice.deleteMany({ where: { id: choiceId, planId: id } });
  return NextResponse.json({ deleted: result.count === 1 }, { headers: { 'Cache-Control': CACHE_NONE } });
});

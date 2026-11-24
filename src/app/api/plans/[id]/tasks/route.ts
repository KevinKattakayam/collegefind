import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ApiError, assertSameOrigin, CACHE_NONE, readJson, withErrorHandling } from '@/lib/http';
import { requireUser } from '@/lib/session';
import { enforceRateLimit } from '@/lib/rate-limit';
import { localDateTimeToInstant } from '@/lib/planner-dates';

const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const fields = z.object({
  title: z.string().trim().min(1).max(200), description: z.string().trim().max(1000).nullable(), kind: z.enum(['DEADLINE', 'CHECKLIST']),
  dueDate: z.string().date().nullable(), dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  timeZone: z.string().min(1).max(100), applicationId: idSchema.nullable(), collegeId: idSchema.nullable(), note: z.string().trim().max(2000).nullable(),
}).strict().superRefine((v, ctx) => {
  if (!v.dueDate && v.dueTime) ctx.addIssue({ code: 'custom', path: ['dueTime'], message: 'A time requires a due date' });
});
type Context = { params: Promise<{ id: string }> };
const include = { college: { select: { id: true, slug: true, name: true, city: true, state: true } }, application: { select: { id: true, status: true, cycle: true, institutionName: true, collegeId: true } } } as const;

export const GET = withErrorHandling(async (_request: Request, context: Context) => {
  const user = await requireUser(); const planId = idSchema.parse((await context.params).id);
  const plan = await prisma.admissionPlan.findFirst({ where: { id: planId, userId: user.id }, select: { id: true } });
  if (!plan) throw new ApiError(404, 'NOT_FOUND', 'Plan not found');
  const tasks = await prisma.planTask.findMany({ where: { planId }, orderBy: [{ completedAt: 'asc' }, { dueAt: 'asc' }, { id: 'asc' }], include });
  return NextResponse.json({ tasks }, { headers: { 'Cache-Control': CACHE_NONE } });
});

export const POST = withErrorHandling(async (request: Request, context: Context) => {
  const user = await requireUser(); assertSameOrigin(request); await enforceRateLimit('save', user.id);
  const planId = idSchema.parse((await context.params).id); const value = await readJson(request, fields);
  let dueAt: Date | null = null;
  if (value.dueDate) { try { dueAt = localDateTimeToInstant(value.dueDate, value.dueTime, value.timeZone); } catch (error) { throw new ApiError(400, 'INVALID_DEADLINE', error instanceof Error ? error.message : 'Invalid deadline'); } }
  const task = await prisma.$transaction(async tx => {
    const owned = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "AdmissionPlan" WHERE id = ${planId} AND "userId" = ${user.id} FOR UPDATE`;
    if (!owned.length) throw new ApiError(404, 'NOT_FOUND', 'Plan not found');
    if (value.collegeId && !await tx.college.findUnique({ where: { id: value.collegeId }, select: { id: true } })) throw new ApiError(404, 'NOT_FOUND', 'College not found');
    const application = value.applicationId ? await tx.planApplication.findFirst({ where: { id: value.applicationId, planId }, select: { collegeId: true } }) : null;
    if (value.applicationId && !application) throw new ApiError(404, 'NOT_FOUND', 'Application not found');
    if (application && value.collegeId && application.collegeId !== value.collegeId) throw new ApiError(400, 'TASK_LINK_MISMATCH', 'College must match the linked application');
    const collegeId = value.collegeId ?? application?.collegeId ?? null;
    return tx.planTask.create({ data: { planId, title: value.title, description: value.description, kind: value.kind, dueAt, timeZone: value.timeZone, applicationId: value.applicationId, collegeId, note: value.note, completedAt: null }, include });
  });
  return NextResponse.json({ task }, { status: 201, headers: { 'Cache-Control': CACHE_NONE } });
});

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ApiError, assertSameOrigin, CACHE_NONE, readJson, withErrorHandling } from '@/lib/http';
import { requireUser } from '@/lib/session';
import { enforceRateLimit } from '@/lib/rate-limit';
import { localDateTimeToInstant } from '@/lib/planner-dates';

const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const include = { college: { select: { id: true, slug: true, name: true, city: true, state: true } }, application: { select: { id: true, status: true, cycle: true, institutionName: true, collegeId: true } } } as const;
const editSchema = z.object({ action: z.literal('edit'), expectedVersion: z.number().int().nonnegative(), title: z.string().trim().min(1).max(200), description: z.string().trim().max(1000).nullable(), kind: z.enum(['DEADLINE', 'CHECKLIST']), dueDate: z.string().date().nullable(), dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(), timeZone: z.string().min(1).max(100), applicationId: idSchema.nullable(), collegeId: idSchema.nullable(), note: z.string().trim().max(2000).nullable() }).strict().superRefine((v,c)=>{if(!v.dueDate&&v.dueTime)c.addIssue({code:'custom',path:['dueTime'],message:'A time requires a due date'})});
const stateSchema = z.object({ action: z.literal('completion'), completed: z.boolean(), expectedVersion: z.number().int().nonnegative() }).strict();
type Context = { params: Promise<{ id: string; taskId: string }> };

export const PATCH = withErrorHandling(async (request: Request, context: Context) => {
  const user = await requireUser(); assertSameOrigin(request); await enforceRateLimit('save', user.id);
  const { id: rawPlan, taskId: rawTask } = await context.params; const planId = idSchema.parse(rawPlan); const taskId = idSchema.parse(rawTask);
  const value = await readJson(request, z.discriminatedUnion('action', [editSchema, stateSchema]));
  const task = await prisma.$transaction(async tx => {
    const owned = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "AdmissionPlan" WHERE id = ${planId} AND "userId" = ${user.id} FOR UPDATE`;
    if (!owned.length) throw new ApiError(404, 'NOT_FOUND', 'Plan not found');
    const existing = await tx.planTask.findFirst({ where: { id: taskId, planId } });
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Task not found');
    if (value.action === 'completion' && (existing.completedAt !== null) === value.completed) return tx.planTask.findUniqueOrThrow({ where: { id: taskId }, include });
    if (existing.version !== value.expectedVersion) throw new ApiError(409, 'STALE_TASK', 'This task changed in another session. Reload before saving.');
    if (value.action === 'completion') {
      await tx.planTask.update({ where: { id: taskId }, data: { completedAt: value.completed ? new Date() : null, version: { increment: 1 } } });
    } else {
      let dueAt: Date | null = null;
      if (value.dueDate) { try { dueAt = localDateTimeToInstant(value.dueDate, value.dueTime, value.timeZone); } catch (error) { throw new ApiError(400, 'INVALID_DEADLINE', error instanceof Error ? error.message : 'Invalid deadline'); } }
      if (value.collegeId && !await tx.college.findUnique({ where: { id: value.collegeId }, select: { id: true } })) throw new ApiError(404, 'NOT_FOUND', 'College not found');
      if (value.applicationId && !await tx.planApplication.findFirst({ where: { id: value.applicationId, planId }, select: { id: true } })) throw new ApiError(404, 'NOT_FOUND', 'Application not found');
      const application = value.applicationId ? await tx.planApplication.findFirst({ where: { id: value.applicationId, planId }, select: { collegeId: true } }) : null;
      if (application && value.collegeId && application.collegeId !== value.collegeId) throw new ApiError(400, 'TASK_LINK_MISMATCH', 'College must match the linked application');
      const collegeId = value.collegeId ?? application?.collegeId ?? null;
      await tx.planTask.update({ where: { id: taskId }, data: { title:value.title,description:value.description,kind:value.kind,dueAt,timeZone:value.timeZone,applicationId:value.applicationId,collegeId,note:value.note,version:{increment:1} } });
    }
    return tx.planTask.findUniqueOrThrow({ where: { id: taskId }, include });
  });
  return NextResponse.json({ task }, { headers: { 'Cache-Control': CACHE_NONE } });
});

export const DELETE = withErrorHandling(async (request: Request, context: Context) => {
  const user = await requireUser(); assertSameOrigin(request); await enforceRateLimit('save', user.id);
  const { id: rawPlan, taskId: rawTask } = await context.params; const planId = idSchema.parse(rawPlan); const taskId = idSchema.parse(rawTask);
  const { expectedVersion } = await readJson(request, z.object({ expectedVersion: z.number().int().nonnegative() }).strict());
  await prisma.$transaction(async tx => {
    const owned = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "AdmissionPlan" WHERE id = ${planId} AND "userId" = ${user.id} FOR UPDATE`;
    if (!owned.length) throw new ApiError(404, 'NOT_FOUND', 'Plan not found');
    const deleted = await tx.planTask.deleteMany({ where: { id: taskId, planId, version: expectedVersion } });
    if (!deleted.count) { if (!await tx.planTask.findFirst({ where: { id: taskId, planId }, select: { id: true } })) throw new ApiError(404, 'NOT_FOUND', 'Task not found'); throw new ApiError(409, 'STALE_TASK', 'This task changed in another session. Reload before deleting.'); }
  });
  return NextResponse.json({ deleted: true }, { headers: { 'Cache-Control': CACHE_NONE } });
});

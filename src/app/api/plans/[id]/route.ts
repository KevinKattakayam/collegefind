import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ApiError, assertSameOrigin, CACHE_NONE, readJson, withErrorHandling } from '@/lib/http';
import { requireUser } from '@/lib/session';
import { enforceRateLimit } from '@/lib/rate-limit';
const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const update = z.object({ name: z.string().trim().min(1).max(100), cycle: z.string().trim().min(4).max(40), authority: z.string().trim().max(100).optional() }).strict();
export const PATCH = withErrorHandling(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(); assertSameOrigin(request); await enforceRateLimit('save', user.id);
  const { id } = await context.params; idSchema.parse(id); const values = await readJson(request, update);
  const changed = await prisma.admissionPlan.updateMany({ where: { id, userId: user.id }, data: values });
  if (!changed.count) throw new ApiError(404, 'NOT_FOUND', 'Plan not found');
  const plan = await prisma.admissionPlan.findFirst({ where: { id, userId: user.id } });
  return NextResponse.json({ plan }, { headers: { 'Cache-Control': CACHE_NONE } });
});
export const DELETE = withErrorHandling(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(); assertSameOrigin(request); await enforceRateLimit('save', user.id);
  const { id } = await context.params; idSchema.parse(id);
  const changed = await prisma.admissionPlan.deleteMany({ where: { id, userId: user.id } });
  if (!changed.count) throw new ApiError(404, 'NOT_FOUND', 'Plan not found');
  return NextResponse.json({ deleted: true }, { headers: { 'Cache-Control': CACHE_NONE } });
});

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { assertSameOrigin, CACHE_NONE, readJson, withErrorHandling } from '@/lib/http';
import { requireUser } from '@/lib/session';
import { enforceRateLimit } from '@/lib/rate-limit';

const input = z.object({ name: z.string().trim().min(1).max(100), cycle: z.string().trim().min(4).max(40), authority: z.string().trim().max(100).optional() }).strict();
export const GET = withErrorHandling(async () => {
  const user = await requireUser();
  const plans = await prisma.admissionPlan.findMany({ where: { userId: user.id }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], include: { choices: { orderBy: [{ cycle: 'asc' }, { position: 'asc' }], include: { college: { select: { id: true, slug: true, name: true, city: true, state: true } }, program: { select: { id: true, name: true } } } }, applications: { orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], include: { college: { select: { id: true, slug: true, name: true, city: true, state: true } } } }, tasks: { orderBy: [{ completedAt: 'asc' }, { dueAt: 'asc' }, { id: 'asc' }], include: { college: { select: { id: true, slug: true, name: true, city: true, state: true } }, application: { select: { id: true, status: true, cycle: true, institutionName: true, collegeId: true } } } } } });
  return NextResponse.json({ plans }, { headers: { 'Cache-Control': CACHE_NONE } });
});
export const POST = withErrorHandling(async (request: Request) => {
  const user = await requireUser(); assertSameOrigin(request); await enforceRateLimit('save', user.id);
  const values = await readJson(request, input);
  const plan = await prisma.admissionPlan.upsert({ where: { userId_name_cycle: { userId: user.id, name: values.name, cycle: values.cycle } }, create: { userId: user.id, ...values }, update: { authority: values.authority } });
  return NextResponse.json({ plan }, { status: 201, headers: { 'Cache-Control': CACHE_NONE } });
});

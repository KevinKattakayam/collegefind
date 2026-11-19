import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ApiError, assertSameOrigin, CACHE_NONE, readJson, withErrorHandling } from '@/lib/http';
import { requireUser } from '@/lib/session';
import { enforceRateLimit } from '@/lib/rate-limit';

const nameSchema = z.string().trim().min(1).max(100).refine(value => !/[<>]/.test(value), 'Name cannot contain < or >');
const zoneSchema = z.string().max(100).nullable().superRefine((zone, ctx) => {
  if (!zone) return;
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(new Date()); }
  catch { ctx.addIssue({ code: 'custom', message: 'Select a valid IANA timezone' }); }
});

export const GET = withErrorHandling(async () => {
  const session = await requireUser();
  const user = await prisma.user.findFirst({ where: { id: session.id, deactivatedAt: null }, select: { id: true, name: true, email: true, role: true, timeZone: true, createdAt: true } });
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required');
  return NextResponse.json({ user }, { headers: { 'Cache-Control': CACHE_NONE } });
});

export const PATCH = withErrorHandling(async (request: Request) => {
  const session = await requireUser(); assertSameOrigin(request); await enforceRateLimit('save', session.id);
  const input = await readJson(request, z.object({ name: nameSchema, timeZone: zoneSchema }).strict());
  const result = await prisma.user.updateMany({ where: { id: session.id, deactivatedAt: null }, data: input });
  if (!result.count) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required');
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id }, select: { id: true, name: true, email: true, role: true, timeZone: true, createdAt: true } });
  return NextResponse.json({ user }, { headers: { 'Cache-Control': CACHE_NONE } });
});

export const DELETE = withErrorHandling(async (request: Request) => {
  const session = await requireUser(); assertSameOrigin(request); await enforceRateLimit('save', `account-delete:${session.id}`);
  await readJson(request, z.object({ confirmation: z.literal('DELETE') }).strict());
  await prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<Array<{ id: string; role: 'USER' | 'ADMIN'; }>>`SELECT id, role FROM "User" WHERE id = ${session.id} AND "deactivatedAt" IS NULL FOR UPDATE`;
    const user = rows[0]; if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required');
    // Serialize administrative deactivations so two simultaneous requests
    // cannot both observe themselves as the last active administrator.
    if (user.role === 'ADMIN') {
      await tx.$queryRaw<Array<{ locked: boolean; }>>`SELECT pg_advisory_xact_lock(873421, 8) IS NULL AS locked`;
      const activeAdmins = await tx.user.count({ where: { role: 'ADMIN', deactivatedAt: null } });
      if (activeAdmins <= 1) throw new ApiError(409, 'LAST_ADMIN', 'The last active administrator account cannot be deactivated');
    }
    await tx.savedCollege.deleteMany({ where: { userId: session.id } });
    await tx.savedComparison.deleteMany({ where: { userId: session.id } });
    await tx.admissionPlan.deleteMany({ where: { userId: session.id } });
    await tx.review.deleteMany({ where: { userId: session.id } });
    await tx.communityReport.deleteMany({ where: { reporterId: session.id } });
    await tx.question.updateMany({ where: { userId: session.id }, data: { status: 'HIDDEN', text: '[Removed after account deactivation]' } });
    await tx.answer.updateMany({ where: { userId: session.id }, data: { status: 'HIDDEN', text: '[Removed after account deactivation]' } });
    await tx.user.update({ where: { id: session.id }, data: { name: 'Deleted account', email: `deleted+${session.id}@account.invalid`, password: '', emailVerified: null, role: 'USER', timeZone: null, deactivatedAt: new Date() } });
  });
  return NextResponse.json({ deactivated: true }, { headers: { 'Cache-Control': CACHE_NONE } });
});

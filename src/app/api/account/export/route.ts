import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { withErrorHandling, ApiError } from '@/lib/http';

export const GET = withErrorHandling(async () => {
  const session = await requireUser();
  const user = await prisma.user.findFirst({ where: { id: session.id, deactivatedAt: null }, select: { id: true, name: true, email: true, timeZone: true, createdAt: true } });
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required');
  const [saved, comparisons, plans, questions, answers, reports] = await Promise.all([
    prisma.savedCollege.findMany({ where: { userId: session.id }, select: { createdAt: true, college: { select: { id: true, slug: true, name: true } } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
    prisma.savedComparison.findMany({ where: { userId: session.id }, select: { id: true, signature: true, collegeIds: true, createdAt: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
    prisma.admissionPlan.findMany({ where: { userId: session.id }, include: { choices: true, applications: true, tasks: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
    prisma.question.findMany({ where: { userId: session.id }, select: { id: true, collegeId: true, text: true, status: true, createdAt: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
    prisma.answer.findMany({ where: { userId: session.id }, select: { id: true, questionId: true, text: true, status: true, createdAt: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
    prisma.communityReport.findMany({ where: { reporterId: session.id }, select: { id: true, questionId: true, answerId: true, reason: true, status: true, createdAt: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
  ]);
  const payload = { exportedAt: new Date().toISOString(), user, savedColleges: saved, savedComparisons: comparisons, admissionPlans: plans, questions, answers, communityReports: reports };
  return new NextResponse(JSON.stringify(payload, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="collegefind-account-export.json"', 'Cache-Control': 'private, no-store' } });
});

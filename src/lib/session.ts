import { prisma } from './prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { ApiError } from './http';

export interface SessionUser {
  id: string;
  role: 'USER' | 'ADMIN';
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true } });
  return user ? { id: user.id, role: user.role } : null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required');
  return user;
}

/** Current role is reloaded from the database for immediate revocation. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new ApiError(403, 'FORBIDDEN', 'Admin access required');
  return user;
}

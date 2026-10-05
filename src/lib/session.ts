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
  return { id: session.user.id, role: session.user.role ?? 'USER' };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required');
  return user;
}

/**
 * Role comes from the JWT issued at login. After promoting/demoting a user,
 * they must sign in again for the change to apply (documented in docs/SECURITY.md).
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new ApiError(403, 'FORBIDDEN', 'Admin access required');
  return user;
}

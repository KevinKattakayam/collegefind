import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  session: null as null | { user?: { id?: string } },
  user: null as null | { id: string; role: 'USER' | 'ADMIN' },
  findFirst: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => state.session) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findFirst: state.findFirst } } }));

import { getSessionUser, requireAdmin, requireUser } from '@/lib/session';

describe('session authorization boundary', () => {
  beforeEach(() => {
    state.session = null;
    state.user = null;
    state.findFirst.mockReset().mockImplementation(async () => state.user);
  });

  it('does not query for absent sessions or sessions without a user id', async () => {
    expect(await getSessionUser()).toBeNull();
    state.session = { user: {} };
    expect(await getSessionUser()).toBeNull();
    expect(state.findFirst).not.toHaveBeenCalled();
  });

  it('treats a deleted account as unauthenticated even when a JWT remains', async () => {
    state.session = { user: { id: 'deleted-user' } };
    state.user = null;
    expect(await getSessionUser()).toBeNull();
    await expect(requireUser()).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
    expect(state.findFirst).toHaveBeenCalledWith({
      where: { id: 'deleted-user', deactivatedAt: null },
      select: { id: true, role: true },
    });
  });

  it('uses the current persisted role and denies a demoted admin token', async () => {
    state.session = { user: { id: 'reviewer' } };
    state.user = { id: 'reviewer', role: 'USER' };
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    state.user = { id: 'reviewer', role: 'ADMIN' };
    await expect(requireAdmin()).resolves.toEqual({ id: 'reviewer', role: 'ADMIN' });
  });
});

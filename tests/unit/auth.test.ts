import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  compare: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock('next-auth/providers/credentials', () => ({ default: (options: unknown) => options }));
vi.mock('bcryptjs', () => ({ compare: mocks.compare }));
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findFirst: mocks.findFirst } } }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.checkRateLimit }));

import { authOptions, TOO_MANY_ATTEMPTS } from '@/lib/auth';

type Provider = { authorize: (credentials: unknown, request?: { headers?: Record<string, unknown> }) => Promise<unknown> };
const authorize = (authOptions.providers[0] as unknown as Provider).authorize;

describe('credentials authentication and JWT callbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue({ success: true, remaining: 1, resetAt: 0 });
    mocks.findFirst.mockResolvedValue(null);
    mocks.compare.mockResolvedValue(false);
  });

  it('rejects malformed credentials before rate-limit or database work', async () => {
    await expect(authorize({ email: 'bad', password: 'short' })).resolves.toBeNull();
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('blocks login when either IP or account rate limit is exhausted', async () => {
    mocks.checkRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetAt: 1 }).mockResolvedValueOnce({ success: true, remaining: 1, resetAt: 1 });
    await expect(authorize({ email: 'user@example.test', password: 'correct horse battery' }, { headers: { 'x-forwarded-for': '203.0.113.4' } }))
      .rejects.toThrow(TOO_MANY_ATTEMPTS);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('uses the same dummy-hash comparison for unknown users and returns null on failure', async () => {
    await expect(authorize({ email: 'missing@example.test', password: 'correct horse battery' }, { headers: { 'x-forwarded-for': '203.0.113.8' } })).resolves.toBeNull();
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { email: { equals: 'missing@example.test', mode: 'insensitive' } } }));
    expect(mocks.compare).toHaveBeenCalledWith('correct horse battery', expect.stringMatching(/^\$2b\$12\$/));
  });

  it('compares stored credentials and returns only the authenticated user identity', async () => {
    mocks.findFirst.mockResolvedValue({ id: 'user-1', email: 'person@example.test', name: 'Person', password: 'stored-hash', role: 'ADMIN' });
    mocks.compare.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const credentials = { email: 'PERSON@example.test', password: 'correct horse battery' };
    const request = { headers: { 'x-forwarded-for': '203.0.113.9' } };
    await expect(authorize(credentials, request)).resolves.toBeNull();
    await expect(authorize(credentials, request)).resolves.toEqual({ id: 'user-1', email: 'person@example.test', name: 'Person', role: 'ADMIN' });
  });

  it('preserves current JWT roles and defaults older tokens to USER', async () => {
    const jwt = authOptions.callbacks!.jwt!;
    const session = authOptions.callbacks!.session!;
    const token = await jwt({ token: {}, user: { id: 'admin-1', role: 'ADMIN' } } as never);
    expect(token).toMatchObject({ id: 'admin-1', role: 'ADMIN' });
    const sessionValue = await session({ session: { user: {} }, token } as never);
    expect(sessionValue.user).toMatchObject({ id: 'admin-1', role: 'ADMIN' });
    const legacy = await session({ session: { user: {} }, token: { id: 'user-1' } } as never);
    expect(legacy.user).toMatchObject({ id: 'user-1', role: 'USER' });
  });
});

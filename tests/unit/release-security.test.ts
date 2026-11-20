import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { z } from 'zod';

const fake = vi.hoisted(() => ({ limit: vi.fn(), ping: vi.fn() }));
vi.mock('@upstash/redis', () => ({ Redis: class { ping = fake.ping; } }));
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow = vi.fn();
    constructor(private options: { prefix: string }) {}
    limit(key: string) { return fake.limit(this.options.prefix, key); }
  },
}));

import { assertSameOrigin, readJson } from '@/lib/http';
import { checkRateLimit, enforceRateLimit, rateLimitBackendHealth, resetRateLimitsForTests } from '@/lib/rate-limit';
import { errorFields } from '@/lib/logger';

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXTAUTH_URL', 'https://college.example.test');
  vi.stubEnv('NEXTAUTH_SECRET', 'local-fixture-signing-material');
  vi.stubEnv('COLLEGEFIND_TEST_DATABASE_CONFIRMED', 'false');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example.test');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fixture');
  fake.limit.mockReset();
  fake.ping.mockReset();
});

afterEach(() => { vi.unstubAllEnvs(); resetRateLimitsForTests(); });

it('trusts the configured origin instead of forwarded host or a scheme mismatch', () => {
  const request = (origin: string, forwardedHost: string) => new Request('http://internal/route', {
    method: 'POST', headers: { origin, 'x-forwarded-host': forwardedHost },
  });
  expect(() => assertSameOrigin(request('https://college.example.test', 'internal'))).not.toThrow();
  expect(() => assertSameOrigin(request('https://other.example.test', 'other.example.test'))).toThrow();
  expect(() => assertSameOrigin(request('http://college.example.test', 'college.example.test'))).toThrow();
  expect(() => assertSameOrigin(new Request('http://internal', { headers: { 'sec-fetch-site': 'cross-site' } }))).toThrow();
});

it('bounds actual bytes even without content length and rejects a lookalike media type', async () => {
  const request = (type: string, body: string) => new Request('https://college.example.test', {
    method: 'POST', headers: { 'content-type': type }, body,
  });
  await expect(readJson(request('application/json; charset=utf-8', '"🎓"'), z.string(), 6)).resolves.toBe('🎓');
  await expect(readJson(request('application/json', '"🎓"'), z.string(), 5)).rejects.toMatchObject({ status: 413 });
  await expect(readJson(request('application/jsonp', '{}'), z.object({}))).rejects.toMatchObject({ status: 415 });
});

it('rejects sensitive operations on failure and provider fail-open timeouts, then recovers', async () => {
  fake.limit.mockRejectedValueOnce(new Error('private provider response'));
  await expect(enforceRateLimit('login', 'person@example.test')).rejects.toMatchObject({ status: 503 });
  fake.limit.mockResolvedValueOnce({ success: true, reason: 'timeout' });
  await expect(enforceRateLimit('moderation', 'admin')).rejects.toMatchObject({ status: 503 });
  fake.limit.mockResolvedValueOnce({ success: true, remaining: 4, reset: 123 });
  await expect(checkRateLimit('login', 'person@example.test')).resolves.toEqual({ success: true, remaining: 4, resetAt: 123 });
  expect(fake.limit.mock.calls[0][1]).toMatch(/^[a-f0-9]{64}$/);
  expect(fake.limit.mock.calls[0][1]).toBe(fake.limit.mock.calls[2][1]);
});

it('keeps a shared provider quota across fresh app limiter instances', async () => {
  const quota = new Map<string, number>();
  fake.limit.mockImplementation(async (prefix: string, key: string) => {
    const id = prefix + key;
    const attempt = (quota.get(id) ?? 0) + 1;
    quota.set(id, attempt);
    return { success: attempt <= 5, remaining: Math.max(0, 5 - attempt), reset: Date.now() + 999 };
  });
  const attempts = Array.from({ length: 8 }, () => {
    resetRateLimitsForTests();
    return enforceRateLimit('register', 'client');
  });
  const results = await Promise.allSettled(attempts);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(5);
  const blocked = results.filter(result => result.status === 'rejected');
  expect(blocked).toHaveLength(3);
  for (const result of blocked) {
    expect(result.reason).toMatchObject({ status: 429, headers: { 'Retry-After': '1' } });
  }
  await expect(enforceRateLimit('register', 'another-client')).resolves.toBeUndefined();
});

it('reports readiness degradation and bounds the public guidance fallback', async () => {
  fake.ping.mockResolvedValueOnce('PONG').mockRejectedValueOnce(new Error('private provider response'));
  await expect(rateLimitBackendHealth()).resolves.toBe('ok');
  await expect(rateLimitBackendHealth()).resolves.toBe('unavailable');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  await expect(enforceRateLimit('register', 'client')).rejects.toMatchObject({ status: 503 });
  for (let attempt = 0; attempt < 60; attempt++) await enforceRateLimit('predict', 'client');
  await expect(enforceRateLimit('predict', 'client')).rejects.toMatchObject({ status: 429 });
  expect(errorFields(new Error('private query or credential'))).toEqual({ errorType: 'Error' });
});

it('honors the configured owner-review loopback origin when the dev server normalizes its request URL', () => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('NEXTAUTH_URL', 'http://127.0.0.1:3317');
  expect(() => assertSameOrigin(new Request('http://localhost:3317/api/admin/evidence', {
    method: 'POST', headers: { origin: 'http://127.0.0.1:3317' },
  }))).not.toThrow();
  expect(() => assertSameOrigin(new Request('http://localhost:3317/api/admin/evidence', {
    method: 'POST', headers: { origin: 'http://localhost:3317' },
  }))).toThrow();
});

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { ApiError } from './http';
import { logger } from './logger';
import { createHmac } from 'node:crypto';

export const RATE_LIMIT_POLICIES = {
  register: { limit: 5, windowSec: 3600 }, // per IP
  loginIp: { limit: 30, windowSec: 900 }, // per IP
  login: { limit: 8, windowSec: 900 }, // per IP + email
  question: { limit: 10, windowSec: 3600 }, // per user
  answer: { limit: 30, windowSec: 3600 }, // per user
  save: { limit: 120, windowSec: 3600 }, // per user
  predict: { limit: 60, windowSec: 60 }, // per IP
  seed: { limit: 3, windowSec: 3600 }, // per IP
  moderation: { limit: 120, windowSec: 3600 }, // per admin
} as const;

export type RateLimitPolicy = keyof typeof RATE_LIMIT_POLICIES;

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number; // epoch ms
}

/**
 * Sliding-window limiter held in process memory. Correct for a single
 * long-running server and for tests. On serverless (Vercel) each instance has
 * its own memory, so configure Upstash Redis in production.
 */
export class MemoryRateLimiter {
  private hits = new Map<string, number[]>();

  check(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
    if (this.hits.size > 10_000) this.prune(now, windowMs);
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      this.hits.set(key, recent);
      return { success: false, remaining: 0, resetAt: recent[0] + windowMs };
    }
    recent.push(now);
    this.hits.set(key, recent);
    return { success: true, remaining: limit - recent.length, resetAt: recent[0] + windowMs };
  }

  reset() {
    this.hits.clear();
  }

  private prune(now: number, windowMs: number) {
    for (const [k, v] of this.hits) {
      if (v.every((t) => now - t >= windowMs)) this.hits.delete(k);
    }
  }
}

const memory = new MemoryRateLimiter();
const upstashLimiters = new Map<RateLimitPolicy, Ratelimit>();
const BACKEND_TIMEOUT_MS = 1200;

function disposableBrowserTest(): boolean {
  const { TEST_DATABASE_URL, DATABASE_URL, COLLEGEFIND_TEST_DATABASE_CONFIRMED, VERCEL, RAILWAY_ENVIRONMENT_ID } = process.env;
  if (VERCEL || RAILWAY_ENVIRONMENT_ID || COLLEGEFIND_TEST_DATABASE_CONFIRMED !== 'true'
    || !TEST_DATABASE_URL || TEST_DATABASE_URL !== DATABASE_URL) return false;
  try {
    const url = new URL(TEST_DATABASE_URL);
    return ['postgres:', 'postgresql:'].includes(url.protocol)
      && ['localhost', '127.0.0.1'].includes(url.hostname)
      && /^\/collegefind_(?:[a-z0-9]+_)*test$/.test(url.pathname)
      && !url.search;
  } catch { return false; }
}

function createRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || new URL(url).protocol !== 'https:') return null;
  return new Redis({ url, token, retry: false, signal: () => AbortSignal.timeout(BACKEND_TIMEOUT_MS) });
}

function getUpstash(policy: RateLimitPolicy): Ratelimit | null {
  const existing = upstashLimiters.get(policy);
  if (existing) return existing;
  const redis = createRedis();
  if (!redis) return null;
  const { limit, windowSec } = RATE_LIMIT_POLICIES[policy];
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
    prefix: `cf:rl:${policy}`,
    timeout: BACKEND_TIMEOUT_MS,
  });
  upstashLimiters.set(policy, limiter);
  return limiter;
}

export function isRateLimitUnavailable(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'RATE_LIMIT_UNAVAILABLE';
}

export async function rateLimitBackendHealth(): Promise<'ok' | 'unavailable' | 'local'> {
  try {
    const redis = createRedis();
    if (redis) return await redis.ping() === 'PONG' ? 'ok' : 'unavailable';
    return process.env.NODE_ENV !== 'production' || disposableBrowserTest() ? 'local' : 'unavailable';
  } catch { return 'unavailable'; }
}

export async function checkRateLimit(policy: RateLimitPolicy, key: string): Promise<RateLimitResult> {
  const { limit, windowSec } = RATE_LIMIT_POLICIES[policy];
  const secret = process.env.NEXTAUTH_SECRET;
  try {
    const upstash = getUpstash(policy);
    if (upstash && secret) {
      const identifier = createHmac('sha256', secret).update(key).digest('hex');
      const result = await upstash.limit(identifier);
      // Upstash returns success=true alongside reason=timeout by default.
      if (result.reason === 'timeout') throw new Error('Rate limit backend timed out');
      return { success: result.success, remaining: result.remaining, resetAt: result.reset };
    }
  } catch {
    logger.warn('rate_limit_backend_error', { policy });
  }
  if (process.env.NODE_ENV === 'production' && policy !== 'predict' && !disposableBrowserTest()) {
    throw new ApiError(503, 'RATE_LIMIT_UNAVAILABLE', 'This action is temporarily unavailable. Please try again.', undefined, { 'Retry-After': '5' });
  }
  return memory.check(`${policy}:${key}`, limit, windowSec * 1000);
}

/** Throws a 429 ApiError (with Retry-After) when the limit is exceeded. */
export async function enforceRateLimit(policy: RateLimitPolicy, key: string): Promise<void> {
  const r = await checkRateLimit(policy, key);
  if (!r.success) {
    const retryAfter = Math.max(1, Math.ceil((r.resetAt - Date.now()) / 1000));
    throw new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.', undefined, {
      'Retry-After': String(retryAfter),
    });
  }
}

export function resetRateLimitsForTests() {
  memory.reset();
  upstashLimiters.clear();
}

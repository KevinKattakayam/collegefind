import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { ApiError } from './http';
import { logger, errorFields } from './logger';

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
let warnedNoRedis = false;

function getUpstash(policy: RateLimitPolicy): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (process.env.NODE_ENV === 'production' && !warnedNoRedis) {
      warnedNoRedis = true;
      logger.warn('rate_limit_memory_fallback', {
        note: 'UPSTASH_REDIS_REST_URL/TOKEN not set; rate limits are per-instance only',
      });
    }
    return null;
  }
  let limiter = upstashLimiters.get(policy);
  if (!limiter) {
    const { limit, windowSec } = RATE_LIMIT_POLICIES[policy];
    limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      prefix: `cf:rl:${policy}`,
    });
    upstashLimiters.set(policy, limiter);
  }
  return limiter;
}

export async function checkRateLimit(policy: RateLimitPolicy, key: string): Promise<RateLimitResult> {
  const { limit, windowSec } = RATE_LIMIT_POLICIES[policy];
  const upstash = getUpstash(policy);
  if (upstash) {
    try {
      const r = await upstash.limit(key);
      return { success: r.success, remaining: r.remaining, resetAt: r.reset };
    } catch (err) {
      // Fail open on Redis outage so the site stays up, but log loudly.
      logger.error('rate_limit_backend_error', { policy, ...errorFields(err) });
    }
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
}

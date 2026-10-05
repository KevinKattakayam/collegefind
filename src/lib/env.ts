import { z } from 'zod';

/**
 * Server environment, validated once on first use.
 *
 * Read lazily (not at import time) so `next build` can collect route
 * metadata without every secret being present, while any request that needs
 * a missing variable fails loudly instead of running with `undefined`.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
  NEXTAUTH_URL: z.string().url().optional(),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),

  // Optional: distributed rate limiting. Without these, an in-memory limiter is
  // used, which is per-instance and therefore weak on serverless platforms.
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  // Seeding over HTTP is off unless explicitly enabled.
  SEED_ENABLED: z.enum(['true', 'false']).default('false'),
  SEED_ALLOW_PRODUCTION: z.enum(['true', 'false']).default('false'),
  ADMIN_SEED_TOKEN: z.string().min(32).optional(),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid server environment: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper: forget the cached env so tests can change process.env. */
export function resetEnvCacheForTests() {
  cached = undefined;
}

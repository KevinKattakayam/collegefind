import { afterEach, expect, it, vi } from 'vitest';
import { getEnv, resetEnvCacheForTests } from '@/lib/env';
afterEach(()=>{vi.unstubAllEnvs();resetEnvCacheForTests();});
function valid(){resetEnvCacheForTests();vi.stubEnv('DATABASE_URL','postgresql://localhost/fixture');vi.stubEnv('NEXTAUTH_SECRET','fixture-secret-at-least-thirty-two-characters');vi.stubEnv('DB_POOL_MAX','5');}
it('validates runtime credentials and bounds without including their values in errors',()=>{
 valid();vi.stubEnv('NEXTAUTH_SECRET','do-not-print');
 expect(()=>getEnv()).toThrow(/NEXTAUTH_SECRET/);
 try{getEnv();}catch(error){expect(String(error)).not.toContain('do-not-print');}
 vi.stubEnv('NEXTAUTH_SECRET','fixture-secret-at-least-thirty-two-characters');vi.stubEnv('DB_POOL_MAX','999');
 expect(()=>getEnv()).toThrow(/DB_POOL_MAX/);
});
it('accepts intentionally unset optional integrations and caches validated settings',()=>{
 valid();vi.stubEnv('UPSTASH_REDIS_REST_URL','');vi.stubEnv('UPSTASH_REDIS_REST_TOKEN','');vi.stubEnv('ADMIN_SEED_TOKEN','');
 expect(getEnv().UPSTASH_REDIS_REST_URL).toBeUndefined();
 vi.stubEnv('DB_POOL_MAX','invalid');expect(getEnv().DB_POOL_MAX).toBe(5);
});

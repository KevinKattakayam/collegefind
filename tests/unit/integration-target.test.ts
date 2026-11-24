import { describe, expect, it, vi } from 'vitest';
import { assertDisposableTestTarget } from '../integration/target';

describe('integration database target guard', () => {
  const base = { COLLEGEFIND_TEST_DATABASE_CONFIRMED: 'true' };
  it('rejects missing and unconfirmed targets', () => {
    expect(() => assertDisposableTestTarget(base)).toThrow(/TEST_DATABASE_URL is required/);
    expect(() => assertDisposableTestTarget({ TEST_DATABASE_URL: 'postgresql://postgres:postgres@localhost/test' })).toThrow(/COLLEGEFIND_TEST_DATABASE_CONFIRMED/);
  });
  it('rejects malformed, non-Postgres and production-like targets', () => {
    for (const TEST_DATABASE_URL of [
      'nope', 'https://localhost/test', 'postgresql://localhost/production', 'postgresql://prod.db.example/test',
      'postgresql://cf_owner_review@127.0.0.1:35441/collegefind_owner_review_main',
      'postgresql://other@127.0.0.1:5432/collegefind_owner_review_main',
    ]) {
      expect(() => assertDisposableTestTarget({ ...base, TEST_DATABASE_URL })).toThrow();
    }
  });
  it('accepts only an explicitly confirmed disposable PostgreSQL target', () => {
    expect(assertDisposableTestTarget({ ...base, TEST_DATABASE_URL: 'postgresql://localhost:5432/collegefind_test' })).toBe('postgresql://localhost:5432/collegefind_test');
  });

  it('rejects invalid configuration during setup import before DB constructors can run', async () => {
    const pool = vi.fn();
    const prisma = vi.fn();
    vi.resetModules();
    vi.doMock('pg', () => ({ default: { Pool: pool } }));
    vi.doMock('@prisma/client', () => ({ PrismaClient: prisma }));
    vi.doMock('@prisma/adapter-pg', () => ({ PrismaPg: vi.fn() }));
    delete process.env.TEST_DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://localhost:5432/valuable_dev';
    delete process.env.COLLEGEFIND_TEST_DATABASE_CONFIRMED;
    await expect(import('../integration/setup')).rejects.toThrow(/TEST_DATABASE_URL is required/);
    const database = await import('../integration/db');
    expect(() => database.testDb()).toThrow(/TEST_DATABASE_URL is required/);
    expect(pool).not.toHaveBeenCalled();
    expect(prisma).not.toHaveBeenCalled();
    vi.doUnmock('pg');
    vi.doUnmock('@prisma/client');
    vi.doUnmock('@prisma/adapter-pg');
    vi.resetModules();
    delete process.env.TEST_DATABASE_URL;
    delete process.env.COLLEGEFIND_TEST_DATABASE_CONFIRMED;
    delete process.env.DATABASE_URL;
  });
});

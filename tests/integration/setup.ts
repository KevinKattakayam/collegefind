/**
 * Integration tests run against a real PostgreSQL database.
 * Set TEST_DATABASE_URL (never point this at production: the suite truncates tables).
 */
import { beforeAll } from 'vitest';

beforeAll(() => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set. See docs/TESTING.md.');
  process.env.DATABASE_URL = url;
  process.env.NEXTAUTH_SECRET ||= 'test-secret-that-is-at-least-32-characters-long';
});

/**
 * Integration tests run against a real PostgreSQL database.
 * Set TEST_DATABASE_URL (never point this at production: the suite truncates tables).
 */
import { assertDisposableTestTarget } from './target';

// This setup module is evaluated before test modules, whose top-level imports
// construct route handlers and Prisma clients. Do not defer this to a hook.
const url = assertDisposableTestTarget();
process.env.DATABASE_URL = url;
process.env.NEXTAUTH_SECRET ||= 'test-secret-that-is-at-least-32-characters-long';

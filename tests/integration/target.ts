/** Safe target gate for integration tests, evaluated before any DB client exists. */
export function assertDisposableTestTarget(env: Record<string, string | undefined> = process.env): string {
  const url = env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is required; integration tests need an explicitly configured disposable database.');
  if (env.COLLEGEFIND_TEST_DATABASE_CONFIRMED !== 'true') {
    throw new Error('Set COLLEGEFIND_TEST_DATABASE_CONFIRMED=true only after confirming the database is disposable.');
  }
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL.'); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname || parsed.pathname.length < 2) {
    throw new Error('TEST_DATABASE_URL must identify a PostgreSQL database.');
  }
  const databaseName = decodeURIComponent(parsed.pathname.slice(1));
  const unsafe = /(?:^|[^a-z0-9])(prod|production|live|primary)(?:$|[^a-z0-9])/i.test(databaseName)
    || /(?:^|_)owner_review(?:_|$)/i.test(databaseName)
    || parsed.username.toLowerCase() === 'cf_owner_review'
    || (parsed.hostname === '127.0.0.1' && parsed.port === '35441')
    || parsed.hostname.toLowerCase().startsWith('prod.');
  if (unsafe) throw new Error('TEST_DATABASE_URL target looks production-like and is refused.');
  return url;
}

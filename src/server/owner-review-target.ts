/** Separate explicit target gate for the owner's durable, local review database.
 * This is intentionally disjoint from TEST_DATABASE_URL and the disposable-test guard.
 */
export function assertOwnerReviewTarget(env: Record<string, string | undefined> = process.env): URL {
  const raw = env.OWNER_REVIEW_DATABASE_URL;
  if (!raw) throw new Error('OWNER_REVIEW_DATABASE_URL is required; do not use a test or runtime fallback.');
  if (env.COLLEGEFIND_OWNER_REVIEW_DATABASE_CONFIRMED !== 'true') {
    throw new Error('Confirm the independently checked persistent owner-review target before connecting.');
  }
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('OWNER_REVIEW_DATABASE_URL must be a valid PostgreSQL URL.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' || url.port !== '35441' ||
      url.username !== 'cf_owner_review' || !/^\/collegefind_owner_review_[a-z0-9_]{1,40}$/.test(url.pathname) ||
      /(?:^|_)(?:test|prod|production|live|primary)(?:_|$)/i.test(url.pathname.slice(1)) || url.search || url.hash) {
    throw new Error('Owner review target must be the separate loopback-only PostgreSQL service at 127.0.0.1:35441, role cf_owner_review, database collegefind_owner_review_<name>.');
  }
  return url;
}

/** Explicit target gates for the owner's durable review DB and a separate disposable restore rehearsal. */
export function assertOwnerReviewTarget(
  env: Record<string, string | undefined> = process.env,
  mode: 'persistent' | 'rehearsal' = 'persistent',
): URL {
  const rehearsal = mode === 'rehearsal';
  const raw = rehearsal ? env.OWNER_REVIEW_REHEARSAL_DATABASE_URL : env.OWNER_REVIEW_DATABASE_URL;
  if (!raw) throw new Error(`${rehearsal ? 'OWNER_REVIEW_REHEARSAL_DATABASE_URL' : 'OWNER_REVIEW_DATABASE_URL'} is required; do not use a test or runtime fallback.`);
  const confirmation = rehearsal ? env.COLLEGEFIND_OWNER_REVIEW_REHEARSAL_CONFIRMED : env.COLLEGEFIND_OWNER_REVIEW_DATABASE_CONFIRMED;
  if (confirmation !== 'true') {
    throw new Error(rehearsal
      ? 'Confirm the independently checked disposable owner-review rehearsal target before connecting.'
      : 'Confirm the independently checked persistent owner-review target before connecting.');
  }
  let url: URL;
  const variableName = rehearsal ? 'OWNER_REVIEW_REHEARSAL_DATABASE_URL' : 'OWNER_REVIEW_DATABASE_URL';
  try { url = new URL(raw); } catch { throw new Error(`${variableName} must be a valid PostgreSQL URL.`); }
  const validTarget = rehearsal
    ? url.port === '35442' && url.username === 'cf_owner_rehearsal' && /^\/collegefind_owner_rehearsal_[a-z0-9_]{1,40}$/.test(url.pathname) &&
      !/(?:^|_)(?:test|prod|production|live|primary)(?:_|$)/i.test(url.pathname.slice(1))
    : url.port === '35441' && url.username === 'cf_owner_review' && /^\/collegefind_owner_review_[a-z0-9_]{1,40}$/.test(url.pathname) &&
      !/(?:^|_)(?:test|prod|production|live|primary)(?:_|$)/i.test(url.pathname.slice(1));
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' || !validTarget || url.search || url.hash) {
    throw new Error(rehearsal
      ? 'Rehearsal target must be a separate loopback-only PostgreSQL service at 127.0.0.1:35442, role cf_owner_rehearsal, database collegefind_owner_rehearsal_<unique-name>.'
      : 'Owner review target must be the separate loopback-only PostgreSQL service at 127.0.0.1:35441, role cf_owner_review, database collegefind_owner_review_<name>.');
  }
  return url;
}

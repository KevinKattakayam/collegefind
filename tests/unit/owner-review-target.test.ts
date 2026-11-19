import { describe, expect, it } from 'vitest';
import { assertOwnerReviewTarget } from '../../src/server/owner-review-target';

const allowed = {
  OWNER_REVIEW_DATABASE_URL: 'postgresql://cf_owner_review@127.0.0.1:35441/collegefind_owner_review_main',
  COLLEGEFIND_OWNER_REVIEW_DATABASE_CONFIRMED: 'true',
};

describe('owner evidence-review database target', () => {
  it('requires explicit owner target and confirmation variables', () => {
    expect(() => assertOwnerReviewTarget({})).toThrow(/OWNER_REVIEW_DATABASE_URL is required/);
    expect(() => assertOwnerReviewTarget({ OWNER_REVIEW_DATABASE_URL: allowed.OWNER_REVIEW_DATABASE_URL })).toThrow(/Confirm the independently checked/);
  });

  it.each([
    'not-a-url',
    'postgresql://cf_owner_review@localhost:35441/collegefind_owner_review_main',
    'postgresql://cf_owner_review@127.0.0.1:5432/collegefind_owner_review_main',
    'postgresql://cf_phase3_test@127.0.0.1:35439/collegefind_phase3_test',
    'postgresql://cf_owner_review@127.0.0.1:35441/collegefind_owner_review_test',
    'postgresql://cf_owner_review@127.0.0.1:35441/collegefind_owner_review_prod',
  ])('rejects malformed, shared, test, or production-like targets before client construction: %s', (url) => {
    expect(() => assertOwnerReviewTarget({ ...allowed, OWNER_REVIEW_DATABASE_URL: url })).toThrow();
  });

  it('accepts only the separate confirmed loopback owner-review target', () => {
    const target = assertOwnerReviewTarget(allowed);
    expect(target.hostname).toBe('127.0.0.1');
    expect(target.port).toBe('35441');
    expect(target.username).toBe('cf_owner_review');
    expect(target.pathname).toBe('/collegefind_owner_review_main');
  });
});

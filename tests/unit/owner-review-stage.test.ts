import { describe, expect, it } from 'vitest';
import { ownerStagingTarget, requireApprovedBatch, validateOwnerStageBatch } from '../../scripts/owner-review-stage';
import { assertDisposableTestTarget } from '../integration/target';
import batch from '../../data/pilot/substantive-research-batch-029.json';
import heldBatch from '../../data/pilot/substantive-research-batch-028.json';

const url = 'postgresql://cf_owner_review@127.0.0.1:35441/collegefind_owner_review_main';
const env = { NODE_ENV: 'test' as const, OWNER_REVIEW_DATABASE_URL: url, COLLEGEFIND_OWNER_REVIEW_DATABASE_CONFIRMED: 'true' };
const bytes = (value: unknown) => Buffer.from(JSON.stringify(value));

describe('owner review staging boundaries', () => {
  it('requires an explicitly confirmed exact owner target and preserves the disposable guard', () => {
    expect(ownerStagingTarget(env, false).pathname).toBe('/collegefind_owner_review_main');
    expect(() => ownerStagingTarget({ ...env, COLLEGEFIND_OWNER_REVIEW_DATABASE_CONFIRMED: '' }, false)).toThrow();
    expect(() => ownerStagingTarget({ ...env, OWNER_REVIEW_DATABASE_URL: url.replace('_main', '_other') }, false)).toThrow();
    for (const target of [url.replace('127.0.0.1', 'db.example.test'), url.replace('35441', '5432'), url + '?sslmode=disable']) {
      expect(() => ownerStagingTarget({ ...env, OWNER_REVIEW_DATABASE_URL: target }, false)).toThrow();
    }
    expect(() => ownerStagingTarget(env, true)).toThrow();
    expect(() => assertDisposableTestTarget({ TEST_DATABASE_URL: url, COLLEGEFIND_TEST_DATABASE_CONFIRMED: 'true' })).toThrow();
  });

  it('binds approval to byte-for-byte batch content and excludes held manifests and reviewer status injection', () => {
    const payload = bytes(batch);
    const hash = requireApprovedBatch(payload, false, undefined);
    expect(requireApprovedBatch(payload, true, hash)).toBe(hash);
    expect(() => requireApprovedBatch(Buffer.concat([payload, Buffer.from('\n')]), true, hash)).toThrow();
    expect(() => requireApprovedBatch(payload, true, undefined)).toThrow();
    expect(validateOwnerStageBatch(payload)).toHaveLength(9);
    expect(() => validateOwnerStageBatch(bytes(heldBatch))).toThrow('not designated');
    const injected = structuredClone(batch);
    Object.assign(injected.candidateClaims[0], { reviewState: 'APPROVED' });
    expect(() => validateOwnerStageBatch(bytes(injected))).toThrow();
  });
});

it('keeps every non-expiry archive hold blocked at the reviewer boundary', async () => {
  const { evidenceReviewHold } = await import('@/server/review-holds');
  const { humanReviewManifest } = await import('../../docs/DATA_COVERAGE.json');
  for (const claim of humanReviewManifest.heldClaims.filter(({ validUntil }) => !validUntil)) {
    expect(evidenceReviewHold(claim.evidenceId)).toEqual(expect.any(String));
  }
  expect(evidenceReviewHold('__proto__')).toBeNull();
});

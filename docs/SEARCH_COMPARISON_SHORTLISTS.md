# Search, comparison and shortlist flows

This document describes the Phase 5 local implementation. It is not a production-readiness statement.

## College search

`/colleges` serializes supported filters into its URL. Current search covers institution names, short names and stored campus-scoped aliases, plus city/state/type. Trusted filters (`minFees`, `maxFees`, NAAC, legacy courses, programme text, degree level, admission eligibility, establishment year, exam history and rating) operate on the public projection. Unknown/unreviewed values do not match. A filter match count is not evidence that colleges without returned values lack the attribute.

`GET /api/colleges` validates filters. Identity-only queries use stable database ordering, count and page/limit. When trusted projected facts must be filtered or ranked, the route currently projects the bounded 205-record catalogue, filters in application code, then counts and paginates. This preserves evidence semantics but is not the long-term query plan for an expanded catalogue; move verified predicates/counts into indexed database queries before the catalogue grows materially. Current URL filters restore through direct navigation, refresh and Back/Forward.

`GET /api/colleges?slugs=slug-a,slug-b` resolves up to 25 canonical slugs to current public-projected records in request order and returns `missingSlugs` for deleted/unavailable entries. This endpoint is for restoring a temporary shortlist, not a trusted-data filter.

## Comparison

Comparison state is limited to three unique colleges. Local storage records IDs/slugs only; current records are refetched from the server. Shared links use canonical slugs (`/compare?colleges=slug-a,slug-b[,slug-c]`) and work without the sender's local storage. Editing/removing/clearing slots updates the URL. Invalid, duplicate and unavailable slugs are rejected with an explanatory state.

The standard comparison table and best-value highlights use the public projected summaries; unknown metrics do not win, and fees are only ranked when their reporting years match. Detailed structured facts are displayed per college, with their own programme/category/year scope and official source link. They are intentionally grouped per institution instead of declaring winners across unlike scopes. Synthetic, demo, staged, rejected, expired and conflicted claims are absent from the public projection. The separate historical cutoff explorer link does not imply an admission prediction.

Saved comparisons are account-owned, store canonical college IDs and restore current server records in saved order. API reads and mutations require authentication and are owner-scoped.

## Shortlist

Anonymous users can save up to 200 canonical slugs in `localStorage` key `collegefind:shortlist:v1`. Only slugs are stored; college values are resolved from the public API when `/saved` is opened. Removed/deleted slugs are reported as unavailable and are not reconstructed from stale snapshots. The temporary list is device/browser-specific and is labelled as such.

After authentication, the provider posts the local keys to `POST /api/saved` as `{ "collegeKeys": ["slug-a", "slug-b"] }`. The existing single-item `{ "collegeId": "..." }` contract remains supported. The batch operation resolves IDs/slugs to current college IDs, locks that account row before checking the 200-item cap, inserts transactionally with duplicate skipping, and returns added/already-saved counts. It is idempotent. The local list is cleared only after a successful response; failures keep the list available for retry. During synchronization save controls are disabled to avoid a merge/remove race. Cross-user data is never returned by the guest lookup; authenticated saved APIs remain scoped to the current user.

## Verification commands

Use a separately verified disposable PostgreSQL database for integration and browser checks. The test harness requires `TEST_DATABASE_URL` and `COLLEGEFIND_TEST_DATABASE_CONFIRMED=true` before test clients are constructed. Never point it at production, DevSync, an owner-review archive or a valuable development database.

```sh
npm test
npm run test:integration -- tests/integration/api-security.test.ts
npm run test:e2e -- tests/e2e/smoke.spec.ts tests/e2e/comparison.spec.ts
npm run lint
npm run typecheck
npm run build -- --webpack
```

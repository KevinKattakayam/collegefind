# Testing

| Layer | Command | Needs a database |
| --- | --- | --- |
| Unit | `npm test` | No |
| Integration | `npm run test:integration` | Yes (`TEST_DATABASE_URL`) |
| E2E | `npm run test:e2e` | Yes, plus a build and seeded data |
| Coverage | `npm run test:coverage` | Mixed |

## Setup for integration tests

```bash
createdb collegefind_test
export TEST_DATABASE_URL="postgresql://localhost:5432/collegefind_test"
DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
npm run test:integration
```

> The suite **truncates every table** between tests. Never point `TEST_DATABASE_URL` at a
> database you care about.

## What is covered

**Unit (41 tests)** — the predictor model (monotonicity, recency weighting, trend clamping,
interval coverage, percentile handling, the no-certainty clamp), seat-eligibility rules
(CRL vs category rank, PwD, female-only pools), explanation text, and every validation schema
(NaN rejection, password policy, CSV parsing, link-spam limits).

**Integration (39 tests)**, against real PostgreSQL, as regression tests for the audit findings:
- Seed route: `GET` is gone; `POST` requires a token; user data survives a rejected call.
- Registration: no password hash leaks, weak passwords rejected, case-insensitive duplicates,
  rate limiting, CSRF, wrong content type, oversized body.
- Authorisation: one user cannot delete another's saved college or comparison.
- Concurrency: four simultaneous saves create exactly one row.
- Listing: malformed parameters give 400 not 500; injection strings are inert; pagination
  returns no duplicates across pages.
- Predictor: no-data state, category/gender/home-state effects, DB-side filtering, final-round
  selection, source attribution, limits and ordering.
- Ingestion: seat-type and preparatory-rank parsing, malformed-row rejection, idempotent re-import,
  dry-run writing nothing.
- Moderation: non-admins rejected, hidden questions disappear, audit rows written.

**E2E (Playwright, desktop + mobile)** — search to detail, a real 404, predictor validation and
explanations, auth redirect, skip-link focus, and absence of the old fake testimonials.

## Gaps worth closing

- No test asserts predictor calibration against **real** JoSAA data (see `docs/PREDICTOR.md`).
- No visual-regression or automated axe accessibility scan.
- No load test; the predictor's two-query strategy is unmeasured at scale.

# Audit: what was wrong, and what fixed it

Findings verified by running the original code against a real PostgreSQL database
(commit `beb2f4c`). Severity: **C**ritical, **H**igh, **M**edium, **L**ow.

## Critical

| # | Finding | Where | Why it mattered | Fix |
| --- | --- | --- | --- | --- |
| 1 | Live database password and `NEXTAUTH_SECRET` committed to a public repo | `render-new.yaml` (added in `9b159ec`) | Full read/write access to the production database; the auth secret allows forging a session for any user | File deleted; **credentials must be rotated** — deletion does not remove them from git history. CI now fails if a credential-shaped string reappears |
| 2 | `GET /api/seed?force=true` was public and destructive | `src/app/api/seed/route.ts` | Verified: one anonymous request deleted a user's saved college (1 row → 0) and all questions, answers and comparisons. The README advertised the URL | `GET` returns 404. `POST` is disabled unless `SEED_ENABLED=true`, requires a bearer token compared in constant time, is rate limited, is non-destructive, and writes an `AuditLog` row |
| 3 | Fabricated student reviews presented as real | `src/app/colleges/[id]/page.tsx`, `generateSampleReviews` | Invented names and `Math.random()` star ratings rendered under "Student Reviews"; students could choose a college based on them | Removed. A `Review` table with a moderation workflow exists; the page states that no verified reviews are published yet |

## High

| # | Finding | Where | Fix |
| --- | --- | --- | --- |
| 4 | Fake social proof: "Trusted by 10,000+ students", three invented testimonials (one crediting the predictor for an IIT Delhi admission), "Every college detail cross-verified — all accurate", "Sub-50ms API responses" | `src/app/page.tsx` | All removed. Counts now come from `/api/stats`; claims replaced with checkable promises |
| 5 | Random phone numbers (`Math.random()`) and invented email/website domains | both seed files, `buildCollege` | Removed; contact fields stay null until copied from an official source. The migration nulls existing rows |
| 6 | Predictor ignored category, quota, gender, branch, year and round | `src/app/api/predict/route.ts` | Verified: General and SC returned byte-identical results. Rewritten — see `docs/PREDICTOR.md` |
| 7 | CAT/GATE treated as ranks; a "percentile" of 150 was accepted | same | Percentile and score metrics modelled separately; out-of-range values rejected with a field error |
| 8 | Whole table loaded into memory (`findMany()` with no filter), then filtered in JS | same | All filtering happens in PostgreSQL against indexed columns |
| 9 | TLS certificate verification disabled (`rejectUnauthorized: false`) | `src/lib/prisma.ts`, `prisma/seed.ts` | Removed; TLS is configured through the connection string and certificates are verified |
| 10 | Static `rating` / `reviewCount` shown as real ratings, and sorted/filtered on | seed files, cards, rankings | Columns are now nullable and computed only from approved reviews. The rating filter and "Top Rated" sort were removed |
| 11 | "Rankings" page ranked colleges by the invented rating | `src/app/rankings/page.tsx` | Replaced with official NIRF ranks from `NirfRanking` + `Source`; empty state links to nirfindia.org |
| 12 | Fabricated news articles with fake dates and headlines | `src/app/articles/page.tsx` | Replaced with a linked directory of official sources |

## Medium

| # | Finding | Where | Fix |
| --- | --- | --- | --- |
| 13 | `?minFees=abc` and `?page=abc` returned HTTP 500 (`NaN` reached Prisma) | `src/app/api/colleges/route.ts` | Zod validates every query parameter; malformed input returns 400 with field errors |
| 14 | Open redirect through `callbackUrl` | `src/app/login/page.tsx` | `safeRedirectPath()` allows only same-site relative paths |
| 15 | User enumeration: "Email already registered" | `src/app/api/auth/register/route.ts` | Generic message, rate limited per IP. Full fix needs email verification (roadmap) |
| 16 | No rate limiting anywhere | all routes | Sliding-window limits on register, login (per IP and per IP+email), questions, answers, saves, predictor and seed |
| 17 | No CSRF defence beyond SameSite | all mutations | `assertSameOrigin()` on every mutating route |
| 18 | No security headers | — | CSP, HSTS, `X-Frame-Options`, `nosniff`, referrer and permissions policies; `x-powered-by` removed |
| 19 | Weak password policy (8 chars, no checks); bcrypt silently truncates at 72 bytes | register | Minimum 10 characters, common-password and repetition checks, explicit 72-byte limit |
| 20 | Internal error messages leaked (`error.message` returned to clients) | seed route | Generic message plus a `requestId`; details go to structured logs |
| 21 | Save/comparison races produced 500s | saved, comparisons | `createMany({ skipDuplicates })` and unique constraints; verified with four concurrent requests |
| 22 | Two seed sources disagreed (60 vs 208 colleges); duplicate rows | `prisma/seed.ts` vs seed route | One source of truth (`demo-colleges.json`, 205 rows). "KIIT University"/"Kalinga Institute", "DA-IICT"/"Dhirubhai Ambani" and a duplicated Jadavpur entry merged; the `NIT AP` shortName collision resolved |
| 23 | 38 lint errors, so no CI gate could pass | — | Zero errors and zero warnings; `--max-warnings=0` enforced in CI |
| 24 | `FilterSidebar` defined a component during render | `src/components/FilterSidebar.tsx` | Hoisted to module scope (it was remounting and dropping input focus) |
| 25 | Unstable `useCallback`/`useEffect` dependencies caused refetch loops and stale filters | `src/app/colleges/page.tsx` | Filters derived with `useMemo` from the URL; one fetch per query, with abort on change |
| 26 | Soft 404s: a missing college returned HTTP 200 | `src/app/colleges/[id]/page.tsx` | A root `loading.tsx` created a Suspense boundary that flushed the response before the lookup. Removed; now 200 / 308 / 404 as appropriate |

## Low

| # | Finding | Fix |
| --- | --- | --- |
| 27 | Leftover `scratch/`, duplicate `vercel-new.json` / `render-new.yaml`, stray `prisma/migration.sql`, unused `AdSenseSlot` | Deleted |
| 28 | README pointed at a different repo, referenced a missing `DEPLOY_RENDER.md`, documented the destructive seed URL | Rewritten |
| 29 | Vercel + Render split caused ~30s cold starts for no benefit | Single Vercel deployment; the `/api` rewrite is gone |
| 30 | Google Fonts request blocked rendering | System font stack |
| 31 | No `engines` field; Node 20 reaches end of life in April 2026 | `engines: node >= 22` |
| 32 | Prisma CLI and client versions could drift | All Prisma packages pinned to 7.10.0 |
| 33 | No accessible focus styles, skip link, or reduced-motion support; `lang="en"` for an India-specific site | Added; `lang="en-IN"` |
| 34 | Exam pages showed stale 2025 dates with "Registration open" | Dates removed; official links only, with a last-checked date |

## Still open (deliberate)

- Email verification, password reset and OAuth — see `docs/ROADMAP.md`.
- No real college data is bundled. Demo rows are labelled; the estimator reports "no data"
  rather than guessing.
- `Review` has no submission UI: publishing reviews needs identity checks and moderation first.

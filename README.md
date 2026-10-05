# CollegeFind

A college discovery and decision tool for Indian students: search colleges, compare them
side by side, and estimate admission chances from **official published cutoff data**.

> **Data status:** the catalogue currently ships with **demo** college rows (names, cities and
> states are real; fees, placement and package figures are sample values). They are labelled
> "Demo data" everywhere they appear. The admission estimator only works once real cutoff data
> has been imported — it says so rather than inventing numbers.
> See [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).

## What it does

- **Search and filter** colleges by state, type, fees, NAAC grade, courses and whether sourced
  cutoff data exists.
- **Compare** two or three colleges. Highlights only compare values that are known for all of them.
- **Estimate admission chances** from historical closing ranks, broken into Safe / Target / Reach
  with a probability, a confidence level, a plain-language explanation and a link to the source.
- **Ask and answer questions** per college, with moderation and audit logging.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript (strict) |
| Styling | Tailwind CSS v3, system font stack (no web-font request) |
| Database | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`) |
| Auth | NextAuth v4, Credentials provider, JWT sessions, bcrypt (cost 12) |
| Validation | Zod on every request body and query string |
| Rate limiting | Upstash Redis when configured, in-memory otherwise |
| Tests | Vitest (unit + integration against real PostgreSQL), Playwright (E2E) |
| Hosting | Vercel, single deployment (frontend and API together) |

## Architecture

```
Browser ──► Next.js on Vercel (pages + /api routes) ──► PostgreSQL (Neon)
                        │
                        └─ Upstash Redis (rate limits, optional)

Offline: scripts/ingest-josaa.ts ──► Source + CutoffRecord rows
```

There is **one** deployment. (An earlier version proxied `/api/*` from Vercel to a separate
Render service, which added a ~30s cold start for no benefit; API routes now run on Vercel.)

Request flow for every mutating API route:

```
withErrorHandling → requireUser/requireAdmin → assertSameOrigin → rate limit → Zod → Prisma
```

### Data model

`College` holds identity plus denormalised summary columns (nullable: null means *unknown*).
Anything a student might act on is a dated record tied to a `Source`:

- `Program` — one course at one college, named exactly as the counselling authority publishes it.
- `CutoffRecord` — closing value by exam, **year, round, quota, category, PwD flag and gender pool**.
- `FeesRecord`, `PlacementRecord`, `NirfRanking` — dated, sourced figures.
- `Source` — publisher, URL, licence and retrieval date for every imported number.
- `Review` — schema exists; the submission UI is deliberately not shipped yet.
- `AuditLog` — who changed or hid what, and when.

`College.dataStatus` is `DEMO`, `UNVERIFIED` or `VERIFIED`, and the UI shows it.

## Local development

Requirements: **Node 22+** and PostgreSQL 14+.

```bash
git clone https://github.com/KevinKattakayam/collegefind.git
cd collegefind
npm install

cp .env.example .env
# edit .env: set DATABASE_URL and a NEXTAUTH_SECRET (openssl rand -hex 32)

npm run db:deploy          # apply migrations
npm run db:seed            # demo colleges only (non-destructive)
npm run db:seed:synthetic  # optional: fictional institutes so the predictor has data

npm run dev
```

`db:seed:synthetic` creates **fictional** institutes ("Synthetic Institute of Technology Alpha")
with invented cutoffs, so the estimator can be demonstrated without attaching made-up numbers to
real colleges. It refuses to run with `NODE_ENV=production`.

### Importing real cutoff data

```bash
npx tsx scripts/ingest-josaa.ts \
  --file data/josaa-2025-round6.csv --year 2025 --round 6 \
  --source-url "<the exact page you downloaded from>" \
  --institutes data/institutes.csv --dry-run
```

Run with `--dry-run` first and read the rejected-row and unmatched-institute report. The importer
is idempotent: re-running the same file updates rows in place. See
[docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) for sources, licences and the full workflow.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint, warnings treated as errors |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (no database needed) |
| `npm run test:integration` | Integration tests (needs `TEST_DATABASE_URL`) |
| `npm run test:e2e` | Playwright E2E against a built app |
| `npm run db:migrate` / `db:deploy` / `db:seed` | Prisma migrations and seeding |
| `npm run ingest:josaa` | Import a JoSAA cutoff CSV |

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection (pooled on Neon) |
| `DIRECT_URL` | migrations | Non-pooled connection for `prisma migrate` |
| `NEXTAUTH_SECRET` | yes | Session signing key, ≥32 chars |
| `NEXTAUTH_URL` | production | Canonical site URL for NextAuth |
| `NEXT_PUBLIC_SITE_URL` | yes | Base URL for canonical links and sitemap |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | recommended | Shared rate limiting across serverless instances |
| `SEED_ENABLED`, `SEED_ALLOW_PRODUCTION`, `ADMIN_SEED_TOKEN` | no | HTTP seeding, off by default |
| `NEXT_PUBLIC_DATA_NOTICE` | no | Set to `off` to hide the demo-data banner |

Never commit real values. `.env` is git-ignored and CI fails if a credential-shaped string appears.

## Security

Summarised in [docs/SECURITY.md](docs/SECURITY.md). Highlights:

- No public destructive endpoints; seeding requires a bearer token and is disabled by default.
- Ownership is enforced inside the database query on every saved/comparison route.
- Origin checks on all mutations, plus SameSite cookies.
- Rate limits on registration, login, questions, answers, saves and the predictor.
- CSP, HSTS, `X-Frame-Options: DENY`, `nosniff` and a referrer policy on every response.
- Database TLS certificates are verified.

## Documentation

- [docs/AUDIT.md](docs/AUDIT.md) — what was wrong before, and what fixed it
- [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) — sources, licences, ingestion
- [docs/PREDICTOR.md](docs/PREDICTOR.md) — the model, its API contract and its limits
- [docs/SECURITY.md](docs/SECURITY.md) — threat model and controls
- [docs/TESTING.md](docs/TESTING.md) — how to run every test layer
- [docs/ROADMAP.md](docs/ROADMAP.md) — 30/60/90-day plan and what is deliberately missing

## Licence and disclaimer

Code is MIT licensed. Imported data belongs to its publishers and carries their terms.
**CollegeFind is not affiliated with JoSAA, MCC, NTA, NIRF or any institution.** Estimates are
not guarantees — always confirm with the official counselling authority before making decisions.

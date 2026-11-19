# Production release and recovery

Phase 9 is a local verification milestone. The owner executes release operations against explicitly approved environments.

## Configuration and operation

- Use HTTPS for the canonical `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL`. Configure independent secrets and databases for previews and production. The database runtime role should have only the permissions needed by the app. Give the direct migration credential to the release operator.
- Set `UPSTASH_REDIS_REST_URL` to the provider HTTPS REST URL and set its token in the secret store. Use a separate Redis database or provider account per environment. App instances in an environment must share the same signing secret, Redis target and rate policy. The limiter hashes identifiers with the signing secret before sending them to Redis.
- Redis requests have a 1.2 s budget and no network retries. Missing configuration, connection errors, or the provider’s successful-looking timeout response block rate-limited sensitive actions with 503. Login shows a retry message. An exhausted healthy limit returns 429. Only public historical guidance may fall back to a per-process limit in production. The loopback browser harness uses memory only with explicit disposable confirmation, matched test and runtime URLs and a test database name. This test mode must be absent in released environments.
- The Vercel build runs Prisma generation and webpack compilation. It does not install migrations. The sitemap may read the configured runtime database at build time. Use the approved least-privilege connection, and never inject a production database into a preview build.
- Budget `DB_POOL_MAX` across all instances and the database connection limit. The pg adapter uses a bounded pool with connection and idle timeouts. Serverless instances own their process lifecycle. For a standalone server, drain traffic and terminate the process before rotating connection configuration. Live pool saturation and shutdown under load require environment evidence.
- `GET /api/live` checks HTTP process availability. `GET /api/health` checks PostgreSQL and Redis and returns 503 when a required dependency is unavailable. Use liveness for process restarts and readiness for alerting and traffic decisions. Alert on sustained readiness errors, 503s, unusual 429 rates and failed backup or migration jobs. API 500 responses include a request ID for log correlation.
- Verify the trusted ingress replaces client-provided forwarding headers. Vercel deployments use the platform IP header. Other ingress configurations must overwrite incoming forwarding headers and restrict direct access to the app. See [Vercel request headers](https://vercel.com/docs/headers/request-headers).

## Release checklist

| Criterion | Required evidence | Current state |
| --- | --- | --- |
| Source and SHA | Remote CI succeeds for the exact candidate SHA, including migrations, restore, build, browser, secret scan and dependency audit. Require these checks in branch protections. | **BLOCKED / not verified here.** Local checks do not establish remote CI or branch-protection acceptance. |
| Historical incident | Provider-side revocation, rotation, session invalidation and audit review recorded with non-secret identifiers and dates. | **BLOCKED — owner evidence required.** No credentials were inspected or changed. |
| Dependencies | Deployment readiness and liveness return 200. Verify 429 across multiple actual instances and 503 plus recovery during a controlled test outside live traffic. | **BLOCKED for production.** Phase 9 local outage/readiness tests are recorded in `UPGRADE_STATUS.md`; no deployed or multi-instance check was made here. |
| Deployed protection | Check secure cookie attributes, tenant and admin boundaries, HTTP seed refusal, external proxy IP behavior and error-log redaction in an approved release environment. | **BLOCKED — production environment required.** Local review app returned register 200, unauthenticated admin page 307 and admin evidence API 401. |
| Recovery | Confirm the approved backup retention and access controls. Record last successful restore time, actual recovery point and measured recovery duration against owner-approved RPO and RTO. | **PARTIAL locally; BLOCKED for production.** The local owner-review snapshot restore and encrypted initial backup passed; production retention/RPO/RTO and recovery target remain unverified. |
| Product | Complete manual screen-reader and magnification checks for primary journeys. Approve remaining account recovery limitations or supply a verified email flow. | **PARTIAL.** Automated/local browser checks exist; manual assistive-technology review and provider-backed email verification/recovery remain open. |
| Content | Confirm the 205 stable college identities, source-use permissions and reviewed-only publishing. Keep unapproved facts and cutoff history unavailable. | **BLOCKED for genuine publication.** The local DB has 205 identities and 377 staged claims, but 0 genuine decisions and 0 verified official cutoffs. The 25-item packet awaits owner review. |
| Release | Record the approver, candidate and rollback SHA, intended DB target by non-secret identifier, maintenance/rollout plan and check times. | **NO-GO.** No production change is authorized or prepared by this local review setup. |

## Rehearsed disposable backup and restore

Use two fresh disposable databases on an independently verified, loopback-only PostgreSQL service. Name them `collegefind_upgrade_test` and `collegefind_restore_test` (the Phase 9 local wrapper uses the corresponding `collegefind_phase9_*` names). Confirm isolation before supplying `TEST_DATABASE_URL`, `RESTORE_TEST_DATABASE_URL` and `COLLEGEFIND_TEST_DATABASE_CONFIRMED=true` to:

```sh
bash scripts/rehearse-release-recovery.sh
```

The script tests a legacy upgrade, checks migration status, writes synthetic relational fixtures, runs `pg_dump --format=custom --no-owner --no-privileges` and verifies the archive using SHA-256. It restores into a fresh disposable destination using `pg_restore --single-transaction --exit-on-error --no-owner --no-privileges`, then compares counts and row digests for scoped tables. The test archive is removed when the script exits. This logical restore proves the checked schema and test relationships on PostgreSQL 16. It provides no timing or retention evidence for production.

## Owner production procedure

1. Identify the approved database, backup schedule, retention, encryption and restoration role in the provider. Set a recovery point objective (acceptable data loss) and recovery time objective (acceptable downtime). Record them with the owner.
2. Before a release that needs migrations, capture a protected recovery point. Restore it into a new isolated destination using the provider workflow. Compare schema version, stable college IDs, row counts, foreign keys, review audit continuity and private data ownership with read-only queries. Record only counts, timestamps and durations in the release evidence.
3. With a backup and the approved direct migration connection injected securely, run `npx prisma migrate status` and `npx prisma migrate deploy` from the approved SHA as a separate release action. Release only once migration status is current and the candidate passed CI.
4. Verify HTTPS readiness, expected seed refusal and representative public and signed-in flows. Log the release SHA and check outcomes with UTC timestamps.
5. If an app-only regression occurs, restore the previous compatible build. Keep additive schema changes when compatible. If data recovery is required, pause writes, preserve the current database for investigation, restore into a clean approved target, validate data and replay permitted post-recovery writes before any owner-approved cutover.

# Owner evidence review: local persistent workflow

**State: ready for owner provisioning, not yet operational.** No real claim is approved. Do not use the disposable databases named below to make genuine decisions.

## Database disposition and required owner action

The last documented read-only check (2026-11-18) found `collegefind_phase3_snapshot_owner_review_20261118_test` inside the `collegefind-phase3-disposable-20261118` container, mapped only to `127.0.0.1:35439`. It contained the 205-college/377-claim snapshot and zero users/decisions. Its `_test` name, test role and disposable container mean it is **not** an approved persistent owner-review database. It is not selected for review, and its state was not rechecked in this task.

**Owner action required:** select or provision a durable, local, non-production PostgreSQL service with a named persistent volume and encrypted backup location. Keep it separate from all integration/browser databases. The setup below uses the dedicated name `collegefind_owner_review_main`, a non-superuser database-owner role `cf_owner_review`, loopback port `35441`, and a persistent Docker volume; the owner must create and protect separate bootstrap/runtime passwords using a local secret manager/file. Do not put credentials in the repository, shell history, command output, or this guide. Do not reuse the historical Phase 3 `cf_phase3_test` role, ports 35439/35440, the default development database, production, or DevSync.

An owner may provision the suggested local service only after choosing that storage location and backup policy:

```bash
set -euo pipefail
set +x
: "${OWNER_PG_ADMIN_PASSWORD_FILE:?Set to an owner-controlled mode-600 file containing a strong local bootstrap password}"
test -f "$OWNER_PG_ADMIN_PASSWORD_FILE"
test "$(stat -c '%a' "$OWNER_PG_ADMIN_PASSWORD_FILE")" = 600
docker volume create collegefind-owner-review-pgdata
docker run -d --name collegefind-owner-review-postgres --restart unless-stopped \
  -e POSTGRES_DB=postgres \
  -e POSTGRES_USER=cf_local_pg_admin \
  -e POSTGRES_PASSWORD_FILE=/run/secrets/pg_password \
  -p 127.0.0.1:35441:5432 \
  --mount type=volume,src=collegefind-owner-review-pgdata,dst=/var/lib/postgresql/data \
  --mount type=bind,src="$OWNER_PG_ADMIN_PASSWORD_FILE",dst=/run/secrets/pg_password,readonly \
  postgres:16
unset OWNER_PG_ADMIN_PASSWORD_FILE
```

Using the private libpq/secret configuration, connect interactively as `cf_local_pg_admin`, create the restricted application/migration role and database, then set its password using `psql`'s password prompt (do not pass a password in SQL or a command argument):

```sql
CREATE ROLE cf_owner_review LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
\password cf_owner_review
CREATE DATABASE collegefind_owner_review_main OWNER cf_owner_review;
```

The application and Prisma migrations use only `cf_owner_review`; the bootstrap superuser is for local provisioning/recovery administration. Store both credentials outside the repo with least access and mode 600.

Before connecting, verify the Docker port mapping and read-only SQL identity/counts yourself. Use a mode-600 local `.pgpass`/libpq service entry or the owner's secret manager; do not put the password in a URL argument. Example identity check (it must return exactly `collegefind_owner_review_main|cf_owner_review|5432`):

```bash
test "$(docker port collegefind-owner-review-postgres 5432/tcp)" = '127.0.0.1:35441'
psql -h 127.0.0.1 -p 35441 -U cf_owner_review -d collegefind_owner_review_main -XAtc \
  "SELECT current_database() || '|' || current_user || '|' || inet_server_port()"
```

Confirm the database name, role, `127.0.0.1:35441` mapping, persistent volume, PostgreSQL version and empty application tables. The restore tool independently rejects every target except the separate loopback/name/role/port contract and requires explicit confirmation.

## Restore the current evidence snapshot

The old `scripts/rehearse-staging-snapshot.ts` and `scripts/export-staging-snapshot.ts` are deliberately disposable-test-only. The exporter refuses a database containing users or review decisions; do not weaken either guard or use those commands for owner progress.

After owner provisioning and independent identity verification, load the owner's URL from a private, mode-600 local environment file as `OWNER_REVIEW_DATABASE_URL` (not `TEST_DATABASE_URL`). Set the confirmation only after verifying the target. First apply the existing additive Prisma migrations to this owner-selected database, with test/production overrides unset; then dry-run and explicitly restore the checksummed archive:

```bash
set -euo pipefail
set +x
set -a
. ./.env.local
set +a
test -n "${OWNER_REVIEW_DATABASE_URL:-}"
unset TEST_DATABASE_URL COLLEGEFIND_TEST_DATABASE_CONFIRMED DIRECT_URL SHADOW_DATABASE_URL
export DATABASE_URL="$OWNER_REVIEW_DATABASE_URL"
npx prisma migrate deploy
export COLLEGEFIND_OWNER_REVIEW_DATABASE_CONFIRMED=true
npx tsx scripts/restore-owner-review-snapshot.ts
npx tsx scripts/restore-owner-review-snapshot.ts --apply
```

The restore uses the fixed batch-027 snapshot and manifest, validates the 205 stable IDs/slugs, seed checksum, all source/claim/import/audit links and the full migration history before constructing Prisma. It defaults to read-only dry-run. `--apply` writes only into a fully empty owner-review database in one transaction; it creates no users or decisions. Exact row/count read-back is required. A repeat verifies archived rows without overwriting owner-created users, new evidence, or decisions. If the destination is partly populated or any check fails, stop and preserve it; do not reset it. If the application migrations have changed since the snapshot was produced, first rehearse that schema compatibility on a disposable copy and stop for review rather than guessing.

For an explicitly disposable restore rehearsal only, the same script has a separate `--rehearsal` target gate. Use a fresh database/container bound only to `127.0.0.1:35442`, role `cf_owner_rehearsal`, and a unique `collegefind_owner_rehearsal_<name>` database; set `OWNER_REVIEW_REHEARSAL_DATABASE_URL` and `COLLEGEFIND_OWNER_REVIEW_REHEARSAL_CONFIRMED=true` only after independent identity checks. Then run `npx prisma migrate deploy` against that URL and execute `npx tsx scripts/restore-owner-review-snapshot.ts --rehearsal` followed by `--rehearsal --apply`. This target is temporary test data and must never be used for genuine reviewer decisions. The normal persistent target gate remains separate and unchanged.

The restore rehearsal completed on 2026-11-19 in a newly created ephemeral container, TCP-verified as `collegefind_owner_rehearsal_20261119_r4m8|cf_owner_rehearsal|5432` with host binding `127.0.0.1:35442`. All 13 repository migrations applied; dry-run, initial restore, exact read-back and retry passed. A synthetic reviewer/decision pair was inserted only after restoration in that disposable database; the next restore retry preserved both and confirmed counts `1 user, 1 decision, 205 colleges, 269 sources, 377 claims, 293 import runs, 377 audits`. The container was stopped and removed. This is not an owner database and the synthetic decision is not a genuine approval.

## Start the local reviewer and grant only the owner's account

Keep `.env.local` untracked and mode 600. It should point `DATABASE_URL` and `OWNER_REVIEW_DATABASE_URL` only at the verified local owner database, use `NEXTAUTH_URL=http://127.0.0.1:3317`, and contain an owner-generated `NEXTAUTH_SECRET` of at least 32 characters. Do not set test confirmation, test URLs, `DIRECT_URL`, `SHADOW_DATABASE_URL`, production credentials, or live Redis settings for the app. Start the app on loopback:

```bash
set -euo pipefail
set +x
set -a
. ./.env.local
set +a
unset TEST_DATABASE_URL COLLEGEFIND_TEST_DATABASE_CONFIRMED DIRECT_URL SHADOW_DATABASE_URL
export DATABASE_URL="$OWNER_REVIEW_DATABASE_URL"
export UPSTASH_REDIS_REST_URL='' UPSTASH_REDIS_REST_TOKEN='' ADMIN_SEED_TOKEN=''
export NEXTAUTH_SECRET="$(openssl rand -base64 32)"
npm run dev -- --hostname 127.0.0.1 --port 3317
```

In a browser on that machine, visit `http://127.0.0.1:3317/register` and create **your own** account. Registration grants only USER. Recheck the local database identity, then in a separate terminal use the same private environment and a parameterized update; this intentionally refuses zero or multiple matching USER accounts:

```bash
set -euo pipefail
set +x
set -a
. ./.env.local
set +a
export DATABASE_URL="$OWNER_REVIEW_DATABASE_URL"
psql -X -h 127.0.0.1 -p 35441 -U cf_owner_review -d collegefind_owner_review_main <<'SQL'
\prompt 'Email used for the account you just registered: ' owner_email
BEGIN;
WITH matched AS MATERIALIZED (
  SELECT id FROM "User" WHERE lower(email)=lower(:'owner_email') AND role='USER'
), eligible AS (
  SELECT id FROM matched HAVING count(*)=1
), updated AS (
  UPDATE "User" AS u SET role='ADMIN' FROM eligible e WHERE u.id=e.id RETURNING u.id
)
SELECT count(*) AS promoted_exactly_one_owner_account FROM updated;
COMMIT;
SQL
```

This command is for the local owner database only, after the exact host, port, database and role are checked. Never execute it against production, DevSync, a test database, or any unverified target. Log out and back in so the session reflects the new role, then open `http://127.0.0.1:3317/admin/enrichment`. Verify anonymous redirect, USER denial and the ordered packet before reviewing. Each decision is individual, requires a reason, and writes an append-only decision/audit record. Review a source before deciding; leave uncertain evidence staged/rejected and retain the 16 pre-existing holds. No one has completed this owner action yet.

## First review batch and reviewer checklist

The dashboard's **First owner review batch** and [`first-human-review-batch.json`](../data/pilot/first-human-review-batch.json) contain 25 unique, archive-reconciled `STAGED_UNREVIEWED` claims across CMI Chennai, IIM Calcutta, SPJIMR, Nirma University, Dhirubhai Ambani Institute/DAU, IIT Roorkee, MNNIT Allahabad and CMC Vellore. The packet provides exact IDs/values, stable slug and location, year/scope, publisher, source URL, locator, retrieval/publication date, source-use notes, freshness prompts, conflict peers and a reviewer question. They are an **inspection order, not preapproval**; they are not in the 16 held claims.

1. Match the stable college ID/slug and source institution/campus. Use the queue's alias/campus details; hold if the source scope does not map cleanly.
2. Open the direct source, find the exact page/table/row/section, verify the value and its unit, programme, category, period and year. Do not treat retrieval time as publication date.
3. Check whether an admission cycle is current or historical; distinguish eligibility/shortlisting from admission assurance. For placement counts, verify denominator and cohort; do not call them salary figures.
4. Review source-use notes. These records retain concise attributed facts, not documents. Explicit bulk reuse is not established for this batch; confirm whether the intended single-fact public display is acceptable under the source's terms. Escalate material legal uncertainty; do not copy source tables/PDFs.
5. Inspect conflict and supersession context. If unresolved, do not approve. The 16 separately held claims remain excluded until independently resolved.
6. Approve or reject one claim with a concise reason only after inspection. Confirm a new reviewer decision and corresponding audit event; never infer approval from automated tests.

The 25 claims break down as: 8 CMI/IIM Calcutta programme/admission claims, 1 SPJIMR programme, 2 Nirma admission/tuition claims, 3 DAU/DA-IICT admission/fee claims, 6 IIT Roorkee tuition/hostel/waiver claims, 2 MNNIT denominator-defined placement counts, and 3 CMC Vellore programme/fee claims. The exact per-claim order and factual values are in the artifact and dashboard. Claims involving the same source/college still require separate review decisions.

## Preserve and restore owner progress

Once a human has registered, the database contains private account identifiers and reviewer decisions. Back up the **whole owner-review database**, not the staged-evidence JSON exporter. Use an encrypted, access-controlled backup location, a mode-600 `.pgpass`, and no shell tracing. Never upload plaintext dumps or print connection strings:

The preferred form streams a custom dump directly to local age encryption (so a plaintext archive is not left behind). Store the passphrase/key separately. `age` must be installed and encryption must complete before the backup is considered usable:

```bash
set -euo pipefail
set +x
umask 077
BACKUP_DIR="${HOME}/.local/share/collegefind-owner-review/backups"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
pg_dump -h 127.0.0.1 -p 35441 -U cf_owner_review -d collegefind_owner_review_main \
  --format=custom --no-owner --no-privileges \
  | age -p -o "$BACKUP_DIR/collegefind-owner-review-$STAMP.dump.age"
sha256sum "$BACKUP_DIR/collegefind-owner-review-$STAMP.dump.age"
```

Test recovery into a **new, separately named local database**, after independently checking the target:

```bash
RECOVERY_DB="collegefind_owner_review_recovery_$(date -u +%Y%m%dT%H%M%S)"
createdb -h 127.0.0.1 -p 35441 -U cf_local_pg_admin -O cf_owner_review "$RECOVERY_DB"
age -d "$BACKUP_DIR/collegefind-owner-review-$STAMP.dump.age" \
  | pg_restore -h 127.0.0.1 -p 35441 -U cf_owner_review -d "$RECOVERY_DB" \
      --single-transaction --exit-on-error --no-owner --no-privileges
```

Never use `--clean`. Verify schema/migration status, 205 catalogue identities, claim/source/run/audit/decision/user counts and selected decision/audit rows, then point a local app only at the recovered database. Do not test restore by overwriting the live owner-review database. Record the encrypted dump checksum and restore counts without recording email addresses or other private values. Schedule backups after each review session and before migrations/imports.

## Current factual and operational counts

- Existing staged claims: 377 (230 substantive across 123 colleges; 147 link references); new claims in this handoff: 0.
- Human inspection packet: 25; current unreviewed substantive open queue: 214; separate held claims: 16.
- Genuine human approvals: 0; verified colleges: 0; verified official cutoff records: 0.
- Synthetic approvals are test-only and are never included in these counts.
- The documented disposable review clone is not a persistent review database. The owner must provision/select the durable local target and execute its guarded restore/account setup; no evidence decision has been made in this work.

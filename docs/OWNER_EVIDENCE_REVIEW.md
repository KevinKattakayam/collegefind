# Owner evidence review: local persistent workflow

**State: persistent local review environment is provisioned and restored; awaiting the owner's account and decisions.** No real claim is approved. The persistent database is not a test target.

## Database disposition and required owner action

The old `collegefind_phase3_snapshot_owner_review_20261118_test` database was a disposable clone and is not a review destination. A new persistent local service was provisioned on 2026-11-19 after checking its proposed container, volume, port, environment file and storage paths were absent. Its exact identity is `collegefind_owner_review_main|cf_owner_review|5432`, bound on the host only to `127.0.0.1:35441`. It uses Docker container `collegefind-owner-review-postgres`, named volume `collegefind-owner-review-pgdata`, and PostgreSQL 16. The runtime role is not a superuser and cannot create databases. Private state and logs are under `${HOME}/.local/share/collegefind-owner-review/`; the encrypted backup directory is `${HOME}/.local/share/collegefind-owner-review/backups/`. The application environment is the ignored mode-600 repository `.env.local`.

The owner-review database is separate from all integration/browser databases. The bootstrap/runtime credentials and stable local `NEXTAUTH_SECRET` are generated and stored in mode-600 files under the private directory; none are included in repository files or output. Do not put credentials in shell history or this guide. Do not reuse the historical Phase 3 `cf_phase3_test` role, ports 35439/35440, the default development database, production, or DevSync.

For a future new installation only, the original safe provisioning recipe is retained below. It refuses no conflicts by itself, so check the exact proposed names/port and private paths first. **Do not rerun it on this machine:** the named container, volume, database and env file already exist.

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

The initial migration and archive restore were completed on the new target and independently checked after restart. For a future empty owner target, the guarded commands are below. On this machine, do not repeat `--apply` unless restoring a newly created, independently verified empty owner database. The current database is populated, and a repeat is read-only/idempotent:

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

`.env.local` has been created, is Git-ignored and mode 600. It points `DATABASE_URL` and `OWNER_REVIEW_DATABASE_URL` only at this verified local owner database, uses `NEXTAUTH_URL=http://127.0.0.1:3317`, and contains a generated local `NEXTAUTH_SECRET`. The app is currently running on loopback port 3317. To restart it after stopping, run:

```bash
set -euo pipefail
set +x
set -a
. ./.env.local
set +a
unset TEST_DATABASE_URL COLLEGEFIND_TEST_DATABASE_CONFIRMED DIRECT_URL SHADOW_DATABASE_URL
export DATABASE_URL="$OWNER_REVIEW_DATABASE_URL"
export UPSTASH_REDIS_REST_URL='' UPSTASH_REDIS_REST_TOKEN='' ADMIN_SEED_TOKEN=''
npm run dev -- --hostname 127.0.0.1 --port 3317
```

To start PostgreSQL after a host reboot, use `docker start collegefind-owner-review-postgres`. To stop it safely without deleting its data, use `docker stop collegefind-owner-review-postgres`; the named volume remains. Stop the app with Ctrl+C in the terminal where it was started. If it is running as the managed local process, identify and stop only the Next server bound to port 3317:

```bash
set -euo pipefail
PID="$(ss -lptn '( sport = :3317 )' | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p')"
test -n "$PID"
ps -p "$PID" -o args= | grep -q '^next-server (v'
kill -TERM "$PID"
```

Do not use `docker rm`, `docker volume rm` or `docker compose down -v` for this owner database.

In a browser on that machine, visit `http://127.0.0.1:3317/register` and create **your own** account. Registration grants only USER. Recheck the local database identity, then in a separate terminal use the same private environment and a parameterized update; this intentionally refuses zero or multiple matching USER accounts:

```bash
set -euo pipefail
set +x
set -a
. ./.env.local
set +a
export DATABASE_URL="$OWNER_REVIEW_DATABASE_URL"
export PGPASSFILE="$HOME/.local/share/collegefind-owner-review/secrets/pgpass"
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

### Six decision-critical items to inspect first

These are existing claims from the 25-item packet, not new evidence, approvals or a recommendation to approve. Their packet positions are 10, 13, 15, 18, 21 and 24. Re-open each original official source and inspect the displayed row before recording an individual decision. The source publication date is not recorded for these items, and the packet's reuse note allows only concise attributed factual extraction; it does not establish bulk redistribution rights.

| Claim ID | Scope and candidate value | Official source and locator | Review warning |
|---|---|---|---|
| `cmwlqtg7i001qgvtvfvd0j4ev` | Nirma University, BBA (Honours), All India category, 2026–27: 10+2 aggregate threshold and IPMAT/personal-interview selection | [Nirma BBA Honours admissions](https://management.nirmauni.ac.in/admission-aid/undergraduate/bba-honours-admissions/) — All India and Eligibility sections | The source page currently marks the application cycle closed. Confirm the historical cycle, threshold, selection weights and whether the fact remains useful as history; do not imply current admissions are open. |
| `cmwlpjrzh001syttvn05nz1d4` | DAU (formerly DA-IICT), B.Tech, All India category, 2026–27: tuition ₹192,500 per semester | [DAU undergraduate admissions and fee table](https://daiict.ac.in/undergraduate-admissions-all-india-category) — 2026–27 fee table | The page says the fee is submitted for state appellate consideration and is subject to revision. Resolve the DAU/DA-IICT catalogue alias and confirm the final applicable amount before any publication. |
| `cmwm4060u0003lftv8hj4ur0o` | IIT Roorkee UG I Year B.Tech./B.Arch./BS-MS/Integrated M.Tech./B.Des.; 2026–27 Gen/Gen-EWS/OBC/OCI/PIO category: tuition ₹100,000 per semester | [IIT Roorkee UG I Year fee schedule](https://iitr.ac.in/Academics/static/Institute_Fee/2026-27/UGIst.pdf) — page 1, semester tuition row | Tuition only, not total semester cost. Confirm each listed category and the first-year scope; the PDF does not establish unrestricted reuse rights. |
| `cmwm406100005lftvhno5hr3x` | IIT Roorkee UG I Year, 2026–27: listed SC/ST/PwD tuition waiver | [IIT Roorkee UG I Year fee schedule](https://iitr.ac.in/Academics/static/Institute_Fee/2026-27/UGIst.pdf) — page 1, semester tuition row, not the grand-total row | A zero tuition component does not mean other fees are zero. Verify the stated group/category and distinguish the waiver from total cost or a separate scholarship award. |
| `cmwm3rj75000bhxtvbr105oe7` | MNNIT Allahabad/Prayagraj, B.Tech all listed departments, 2024–25: 703 placed of 844 eligible | [MNNIT Annual Report 2024–25](https://mnnit.ac.in/images/newstories/2026/notices/Annual_Report_Audit_Report_for_the_year_2024-25_English.pdf) — printed page 11, B.Tech department-wise placement table, Total row | Historical count, not salary, placement rate or guarantee. The PDF did not open in the latest source check; inspect the table and denominator directly before deciding. |
| `cmwm4trd200073otvpjb30qsw` | CMC Vellore MBBS, 2026–27: tuition ₹3,000 per year | [CMC Vellore revised 2026–27 prospectus](https://www.cmch-vellore.edu/wp-content/uploads/sites/14/2026/11/college-prospectus-2026-2027-revised.pdf) — printed page 177, Annexure I MBBS fee table | Tuition only, not total cost. Confirm the exact Vellore campus, annual unit and prospectus cycle. The source has no explicit reuse licence; do not reproduce its table or document. |

All six remain `STAGED_UNREVIEWED`. No packet order, persistent row, source archive or review decision was changed for this handoff. Approval/rejection/hold must still be performed one item at a time by the authorized human reviewer with a reason.

## Preserve and restore owner progress

Once a human has registered, the database contains private account identifiers and reviewer decisions. Back up the **whole owner-review database**, not the staged-evidence JSON exporter. Use the encrypted, access-controlled backup location, mode-600 `.pgpass` and backup passphrase file, and no shell tracing. Never upload plaintext dumps or print connection strings. GPG is available locally; `age` is not. The initial empty-review-state archive was validated (encrypted file checksum is recorded in `UPGRADE_STATUS.md`):

Use the local GPG installation with a passphrase stored separately in the mode-700 private storage directory. The backup is encrypted at rest; verification briefly decrypts to a mode-600 temporary file so `pg_restore --list` can validate the full archive, then removes that plaintext file. Do not upload plaintext dumps or print connection strings:

```bash
set -euo pipefail
set +x
umask 077
BACKUP_DIR="${HOME}/.local/share/collegefind-owner-review/backups"
SECRET_DIR="${HOME}/.local/share/collegefind-owner-review/secrets"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$BACKUP_DIR/collegefind-owner-review-$STAMP.dump.gpg"
test ! -e "$BACKUP"
CHECK="$(mktemp "$BACKUP_DIR/.restore-check.XXXXXX")"
trap 'rm -f -- "$CHECK"' EXIT
umask 077
PGPASSFILE="$SECRET_DIR/pgpass" \
pg_dump -h 127.0.0.1 -p 35441 -U cf_owner_review -d collegefind_owner_review_main \
  --format=custom --no-owner --no-privileges \
  | gpg --batch --yes --quiet --pinentry-mode loopback \
      --passphrase-file "$SECRET_DIR/backup-passphrase" --symmetric --cipher-algo AES256 --output "$BACKUP"
gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$SECRET_DIR/backup-passphrase" \
  --decrypt --output "$CHECK" "$BACKUP"
pg_restore --list "$CHECK" >/dev/null
rm -f -- "$CHECK"
trap - EXIT
sha256sum "$BACKUP"
```

Test recovery into a **new, separately named local database**, after independently checking the target:

```bash
RECOVERY_DB="collegefind_owner_review_recovery_$(date -u +%Y%m%dT%H%M%S)"
PGPASSFILE="$SECRET_DIR/pgpass-admin" createdb -h 127.0.0.1 -p 35441 -U cf_local_pg_admin -O cf_owner_review "$RECOVERY_DB"
umask 077
CHECK="$(mktemp "$BACKUP_DIR/.restore-check.XXXXXX")"
trap 'rm -f -- "$CHECK"' EXIT
gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$SECRET_DIR/backup-passphrase" \
  --decrypt --output "$CHECK" "$BACKUP"
pg_restore -h 127.0.0.1 -p 35441 -U cf_owner_review -d "$RECOVERY_DB" \
  --single-transaction --exit-on-error --no-owner --no-privileges "$CHECK"
rm -f -- "$CHECK"
trap - EXIT
```

Never use `--clean`. Verify schema/migration status, 205 catalogue identities, claim/source/run/audit/decision/user counts and selected decision/audit rows, then point a local app only at the recovered database. Do not test restore by overwriting the live owner-review database. Record the encrypted dump checksum and restore counts without recording email addresses or other private values. Schedule backups after each review session and before migrations/imports.

For disaster recovery, keep a protected copy of `secrets/backup-passphrase` in an owner-controlled location separate from this workstation/volume. A GPG-encrypted backup without its passphrase is not recoverable; storing both only on the same disk does not protect against loss of that disk.

## Current factual and operational counts

- Existing staged claims: 377 (230 substantive across 123 colleges; 147 link references); new claims in this handoff: 0.
- Human inspection packet: 25; current unreviewed substantive open queue: 214; separate held claims: 16.
- Genuine human approvals: 0; verified colleges: 0; verified official cutoff records: 0.
- Synthetic approvals are test-only and are never included in these counts.
- Persistent owner-review database restored: 205 colleges, 269 sources, 377 claims, 293 import runs and 377 staging audits; users and decisions are both 0. The first 25 packet claims reconcile to rows in this database.
- The owner still must register their own account, promote only that account using the guarded local procedure, log out/in, then review each claim individually. The running app currently redirects anonymous `/admin/enrichment` access and returns 401 for unauthenticated evidence API access.

## Stage new facts in the persistent review queue

The owner-staging command uses the exact database `collegefind_owner_review_main`, role `cf_owner_review` and loopback port `35441`. It checks the server-side database, role and port and matches all 205 original ID/slug pairs against the archive. The ordinary importer still requires a disposable target.

Run the read-only preview from the repository root after independently checking the Docker port and SQL identity above:

```bash
set +x
set -a
. ./.env.local
set +a
export COLLEGEFIND_OWNER_REVIEW_DATABASE_CONFIRMED=true
node --import tsx scripts/stage-owner-review-facts.ts --file data/pilot/substantive-research-batch-029.json
```

The preview lists exact values, scopes, years, sources and evidence locations. Compare each proposed addition with the existing queue. Batch 029 previews nine additions. Its SHA-256 is `2406e1d8c281b3c33c72cb60653379bf30308109b5f578e887f791ede973ee4c`. Batch 028 is blocked for owner staging pending source-use and freshness resolution. Its older importer parser flags do not constitute clearance.

For an apply, personally authorize the **exact file hash and destination** after reviewing the preview. The apply form adds `--apply --approve-sha256 <reviewed-preview-hash>` to the command above. The command takes and verifies a fresh, encrypted whole-database backup in the private owner backup directory before the first write. It requires the private backup directory and passphrase file described above. It reads the full decrypted archive through `pg_restore` without saving plaintext or connecting a restore to any database. The output includes the encrypted archive's path and hash, the additions, and reused claims. Keep the backup with the earlier recovery copies.

The command replans under the same transaction lock used by field reviewers, preserves decision history, and records only new unreviewed evidence, sources, runs and staging audits. Exact or equivalent retries from the same source URL and factual scope reuse existing evidence, even after it has a decision. A no-op retry makes no backup or database changes. Source recording date or factual scope changes still need a new inspection. If backup verification fails, the transaction aborts.

A reviewer can choose **Hold** and enter a reason in the existing dashboard. The recorded pending decision is shown as Held and is excluded from public projection. The packet shows the latest decision and links to the next undecided item. The original curated holds still apply. Use explicit decisions only after inspecting the source and the correct programme, campus, cycle, category and rights.

After genuine approval, verify the specific college read-only. Replace the slug with the approved college and inspect the exact matched fact and source:

```bash
college_slug=dit-university
curl --fail --silent --show-error "http://127.0.0.1:3317/api/colleges/$college_slug" |
  jq '{slug, website, fieldEvidence, structuredFacts}'
```

Then open the profile and check any supported projection in search, comparison and CollegeFit. Admission guidance and the cutoff explorer still require their own qualifying evidence. For a first publication check, use a genuinely approved, currently applicable claim from the existing 25-claim packet. Batch 029 requires separate staging authorization before any review can begin.

## Decision-critical owner review shortlist

These archived rows are navigation shortcuts into the existing owner review queue. Eligibility, fees and historical outcomes require separate decisions per claim. Check the institution and campus, exact period, applicant category, units, source locator and permitted use before deciding. Confirm whether a fee schedule is still valid for the intended intake. For placement counts, verify the denominator and whether the report counts eligible students or placements.

### Source recheck before first decisions — 2026-11-22

The following is source inspection guidance, not a decision. The six claims remain individually `STAGED_UNREVIEWED`; no genuine decision has been recorded.

| Claim ID | Recheck result | Reviewer action / hold |
| --- | --- | --- |
| `cmwlqtg7i001qgvtvfvd0j4ev` — Nirma BBA (Hons.) | The official [BBA Honours admissions page](https://management.nirmauni.ac.in/admission-aid/undergraduate/bba-honours-admissions/) currently states an IPMAT 2026 route, All India 10+2 threshold, selection weights and 2026–27 fee heading; the application cycle is marked closed. | Inspect the source sections directly. Treat as a historical 2026–27 selection claim unless its cycle scope is explicitly accepted; do not imply applications remain open. The source does not clearly date every eligibility paragraph independently. |
| `cmwlpjrzh001syttvn05nz1d4` — DAU B.Tech fee | The official [All India undergraduate admissions page](https://daiict.ac.in/undergraduate-admissions-all-india-category) lists tuition at ₹192,500 per semester for 2026–27 and says the proposal is subject to State Appellate Committee consideration and annual revision. It identifies DAU as formerly DA-IICT. | Hold until the final applicable amount and catalogue alias are confirmed. If reviewed, describe tuition per semester only, not total cost. |
| `cmwm4060u0003lftv8hj4ur0o` — IIT Roorkee tuition | The official [2026–27 UG I Year fee PDF](https://iitr.ac.in/Academics/static/Institute_Fee/2026-27/UGIst.pdf), page 1, shows ₹100,000 tuition per semester for Gen/Gen-EWS/OBC/OCI/PIO. | Check each category and first-year scope against the fee row. Tuition is not total semester cost; no broad reuse licence is established. |
| `cmwm406100005lftvhno5hr3x` — IIT Roorkee tuition waiver | The same fee row shows the tuition component as nil for SC/ST/PwD categories. | Verify the exact group/category mapping. A nil tuition component is not a zero total cost or a separate scholarship. |
| `cmwm3rj75000bhxtvbr105oe7` — MNNIT placement count | The [2024–25 annual report PDF](https://mnnit.ac.in/images/newstories/2026/notices/Annual_Report_Audit_Report_for_the_year_2024-25_English.pdf), printed page 11, is the locator in the packet, but direct PDF text retrieval timed out in this recheck. | Do not decide from the packet transcription alone. Open the PDF and inspect the B.Tech department-wise total and denominator; retain as historical, not a placement rate or guarantee. |
| `cmwm4trd200073otvpjb30qsw` — CMC Vellore MBBS tuition | The [revised 2026–27 prospectus](https://www.cmch-vellore.edu/wp-content/uploads/sites/14/2026/11/college-prospectus-2026-2027-revised.pdf), printed page 177, Annexure I, lists MBBS tuition at ₹3,000 per year. | Confirm Vellore/MBBS/year/unit and distinguish tuition from total fees. The prospectus has no explicit reuse licence; do not republish the table/document. |

These source checks do not change the evidence state or public projection. Approval requires the authorized reviewer to inspect the original source and record an individual reasoned action in `/admin/enrichment`.

### Current or upcoming intake · eligibility

**Indian Institute of Management Calcutta** · 2027 · [Institution source](https://www.iimcal.ac.in/programs/pgp/admission/admission-policy/admission-procedure-for-domestic-candidates)

- MBA Programme (Batch 2027-29) · All domestic applicants. Page lines 100–113 states minimum bachelor’s degree marks by SC/ST/PwD category and notes final-year applicant conditions; lines 118–122 states CAT 2026, WAT/PI and that thresholds are for shortlisting, not automatic admission. [Open claim cmwm3rj7m000ihxtvcl5fvgh7](http://127.0.0.1:3317/admin/enrichment?status=ALL&q=cmwm3rj7m000ihxtvcl5fvgh7)
- MBA Programme (Batch 2027-29) · OPEN. Page lines 120–137, Table 1: category-specific minimum section-wise and overall CAT 2026 percentiles for consideration for PI/WAT shortlisting; source warns actual cut-offs may be higher. [Open claim cmwm3rj7r000khxtv48tci1x7](http://127.0.0.1:3317/admin/enrichment?status=ALL&q=cmwm3rj7r000khxtv48tci1x7)

**SP Jain Institute** · 2027 · [Institution source](https://www.spjimr.org/newsroom/press-release/spjimr-opens-applications-for-pgdm-and-pgdm-bm-programmes-for-2027-29/)

- PGDM and PGDM (Business Management) · Indian applicants. 16-Sep-2026 release lines 123-128 and eligibility section of same release; application portal and deadline 27-Nov-2026. [Open claim cmwlpjrvq000tyttv85ztg0kv](http://127.0.0.1:3317/admin/enrichment?status=ALL&q=cmwlpjrvq000tyttv85ztg0kv)

**CMI Chennai** · 2027 · [Institution source](https://www.cmi.ac.in/admissions/)

- B.S. (Hons.) programmes · 2027-28 applicants. Eligibility and How to Apply sections; examination date 15 May 2027; applications expected around 1 March 2027, no deadline inferred. [Open claim cmwlqtg56000ngvtvlul6b04j](http://127.0.0.1:3317/admin/enrichment?status=ALL&q=cmwlqtg56000ngvtvlul6b04j)

### Upcoming intake · tuition and residence

**Woxsen University** · 2027 · [Institution source](https://woxsen.edu.in/fsd/b.sc%20%28hons.%29fee.pdf)

- Tuition Fee, Part 2 Academic Fee · Year 1; Batch 2027-2031 · year. Official Woxsen PDF lines 10-16: tuition table, Year 1 Part 2 Academic Fee INR 185,000. This is one component, not the total tuition-inclusive fee; admission commitment and learning resources are separately charged. [Open claim cmwm8ey92000nfjtveiyxj031](http://127.0.0.1:3317/admin/enrichment?status=ALL&q=cmwm8ey92000nfjtveiyxj031)
- Accommodation charge (food excluded) · Year 1 standard plan; non-AC, triple sharing · year. Official Woxsen PDF lines 21-30: standard food/hostel plan, Year 1 non-AC triple-sharing accommodation INR 160,000. Food and sports facility charges are separate. Charges are payable to INFEZIC LLP, not Woxsen University; reviewer must preserve that distinction. [Open claim cmwm8ey9a000pfjtvekwzwuep](http://127.0.0.1:3317/admin/enrichment?status=ALL&q=cmwm8ey9a000pfjtvekwzwuep)
- Accommodation charge (food excluded) · Year 1 premium plan; AC, triple sharing · year. Official Woxsen PDF lines 32-39: premium food/hostel plan, Year 1 AC triple-sharing accommodation INR 223,500. Food and sports facility charges are separate. Charges are payable to INFEZIC LLP, not Woxsen University; reviewer must preserve that distinction. [Open claim cmwm8ey9f000rfjtv6rq6mxxv](http://127.0.0.1:3317/admin/enrichment?status=ALL&q=cmwm8ey9f000rfjtv6rq6mxxv)

### Earlier intake · tuition and residence

**Christian Medical College** · 2026 · [Institution source](https://www.cmch-vellore.edu/wp-content/uploads/sites/14/2026/11/college-prospectus-2026-2027-revised.pdf)

- Tuition fee · All MBBS candidates · year. Prospectus printed p.177, Annexure I MBBS fee table: Tuition fee (per year), INR 3,000. This is tuition only, not total cost. [Open claim cmwm4trd200073otvpjb30qsw](http://127.0.0.1:3317/admin/enrichment?status=ALL&q=cmwm4trd200073otvpjb30qsw)
- Hostel charges: deposits and advances · Men · one_time. Prospectus printed p.177, hostel charges table: deposits and advances, Men, INR 10,000. One-time deposit/advance; not an annual hostel tariff. [Open claim cmwm4trd800093otv75rxgw3y](http://127.0.0.1:3317/admin/enrichment?status=ALL&q=cmwm4trd800093otv75rxgw3y)
- Hostel charges: deposits and advances · Women · one_time. Prospectus printed p.177, hostel charges table: deposits and advances, Women, INR 10,000. One-time deposit/advance; not an annual hostel tariff. [Open claim cmwm4trde000b3otv3mxgmt8z](http://127.0.0.1:3317/admin/enrichment?status=ALL&q=cmwm4trde000b3otv3mxgmt8z)

**BITS Pilani** · 2026 · [Institution source](https://www.bitsadmission.com/FD/FD_fee.html)

- Semester tuition fee · Domestic students admitted in AY 2026-27; Pilani Campus · semester. Official fee schedule lines 1-12 gives identical first/second semester amounts under the Pilani Campus column; tuition note lines 55-60 confirms INR 291,500 semester tuition for domestic students admitted in AY 2026-27. Excludes admission fee, annual fees and other charges. [Open claim cmwm68lb1000a3gtvjqdocyvn](http://127.0.0.1:3317/admin/enrichment?status=ALL&q=cmwm68lb1000a3gtvjqdocyvn)
- Hostel fee, first semester · On-campus students admitted in AY 2026-27; Pilani Campus · semester. Official fee schedule lines 21-28, Hostel fee (for on-campus students only), first semester amount in the Pilani Campus column. This is first-semester hostel fee only; mess/electricity advance and other charges are separate. [Open claim cmwm68lb7000c3gtvdx9j9lfg](http://127.0.0.1:3317/admin/enrichment?status=ALL&q=cmwm68lb7000c3gtvdx9j9lfg)

### Historical placement count and cohort

**Motilal Nehru National Institute of Technology** · 2024 · [Institution source](https://mnnit.ac.in/images/newstories/2026/notices/Annual_Report_Audit_Report_for_the_year_2024-25_English.pdf)

- B.Tech eligible students (all listed departments), 2024-25 report. Annual Report 2024-25, printed page 11, B.Tech Courses / Department-wise Placement Statistics, table rows for Total and Computer Science and Engineering; eligible and placed counts shown in separate columns. [Open claim cmwm3rj75000bhxtvbr105oe7](http://127.0.0.1:3317/admin/enrichment?status=ALL&q=cmwm3rj75000bhxtvbr105oe7)
- B.Tech Computer Science and Engineering eligible students, 2024-25 report. Annual Report 2024-25, printed page 11, B.Tech Courses / Department-wise Placement Statistics, table rows for Total and Computer Science and Engineering; eligible and placed counts shown in separate columns. [Open claim cmwm3rj78000dhxtvxa99f78a](http://127.0.0.1:3317/admin/enrichment?status=ALL&q=cmwm3rj78000dhxtvxa99f78a)

**Accreditation and recognition remain held for source reconciliation.** Tezpur University’s NBA notice could not be checked against the regulator register because the programme lookup returned HTTP 403. The NMC’s older St. John’s MBBS listing needs reconciliation against the current regulator search before the relevant approval period can be stated. [Tezpur notice](https://www.tezu.ernet.in/notice/2025/November/NBA-accreditation.pdf) · [NBA programme lookup](https://www.nbaind.org/accreditationprogram/AccreditedProgram) · [NMC current course register](https://nmc.org.in/information-desk-college-and-course-search)

### Batch 053 review session

The packet and each individual queue entry now show the relevant priority source check. The two IIT Roorkee rows were rechecked on page 1 under Autumn and Spring tuition, and the CMC amount under MBBS in Annexure I. These three are ready for individual inspection. Nirma's 2026 cycle is closed. The All India eligibility text specifies Indian schools and Nirma recognition of equivalent qualifications, so inspect that scope before deciding on a historical claim. DAU's page still makes the fee proposal subject to revision. Keep it on hold until a final fee is confirmed. The MNNIT full PDF remains unavailable for direct inspection in this session. The ordinary download returned a truncated PDF with no readable cross-reference table, so the count and denominator require manual reinspection before a decision.

The account-specific promotion command above remains the authorized route. After your account is promoted and you sign back in, start with the [IIT Roorkee tuition claim](http://127.0.0.1:3317/admin/enrichment?status=ALL&q=cmwm4060u0003lftv8hj4ur0o).

### Batch 054 priority disposition

Rechecked the official pages and documents listed in the priority table above. Start with IIT Roorkee page 1, then the waiver on the same schedule and the CMC MBBS row in Annexure I. Those three support individual human inspection of the tuition component for the stated intake and category.

Nirma, DAU and MNNIT are now marked with claim-specific catalogue holds in the queue. These are policy safeguards and do not create reviewer decision or audit rows. Nirma's All India summary omits the Indian-school scope and Nirma's recognition requirement for equivalent qualifications. Prepare an explicitly historical, correctly scoped replacement before review. DAU's fee proposal is still expressly subject to State Appellate Committee consideration and revision. MNNIT's annual report again did not load as a complete PDF, and its placement archive did not corroborate the 2024–25 total. Require the complete source, including both count and cohort, before lifting the hold. The existing archive values and decision history are preserved.

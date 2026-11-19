#!/usr/bin/env bash
# Run only after independently confirming two freshly created disposable databases.
set -euo pipefail
umask 077
: "${TEST_DATABASE_URL:?confirmed disposable upgrade URL required}"
: "${RESTORE_TEST_DATABASE_URL:?confirmed disposable restore URL required}"
test "${COLLEGEFIND_TEST_DATABASE_CONFIRMED:-}" = true

# Use the same PostgreSQL target for Prisma and the client tools. Validate both
# identities and require empty, separate databases before any writes.
configured_db() {
  node --input-type=module -e '
    const url = new URL(process.argv[1]);
    if (!["postgres:", "postgresql:"].includes(url.protocol)
      || !["localhost", "127.0.0.1"].includes(url.hostname)
      || !/^\/collegefind_(?:phase9_)?(?:upgrade|restore)_test$/.test(url.pathname)
      || url.search || url.hash) process.exit(1);
    console.log(url.pathname.slice(1));' "$1"
}
upgrade=$(configured_db "$TEST_DATABASE_URL")
restore=$(configured_db "$RESTORE_TEST_DATABASE_URL")
test "$upgrade" != "$restore"
for url in "$TEST_DATABASE_URL" "$RESTORE_TEST_DATABASE_URL"; do
  db=$(configured_db "$url")
  test "$(psql "$url" -XAtqc "SELECT current_database() || '|' || (SELECT count(*) FROM information_schema.tables WHERE table_schema='public')")" = "$db|0"
done

export DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL"
npx tsx scripts/verify-phase2-upgrade.ts
for migration in 20260430_init 20261005000000_trust_and_provenance 20261117000000_field_evidence_import_runs; do
  npx prisma migrate resolve --applied "$migration"
done
npx prisma migrate deploy
npx prisma migrate status

src() { psql "$TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 "$@"; }
dst() { psql "$RESTORE_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 "$@"; }
test "$(src -Atq <<'SQL'
SELECT count(*) FROM "SavedComparison" s JOIN "User" u ON s."userId"=u.id
JOIN "College" c ON s."collegeIds"[1]=c.id WHERE c.slug='preserved-slug';
SQL
)" = 1
src <<'SQL'
INSERT INTO "AdmissionPlan" (id,"userId",name,cycle,"updatedAt") VALUES ('backup-plan','preserved-user','Synthetic recovery plan','2025',now());
INSERT INTO "PlanTask" (id,"planId",title,kind,"timeZone","updatedAt") VALUES ('backup-task','backup-plan','Synthetic checklist','CHECKLIST','Asia/Kolkata',now());
INSERT INTO "FieldEvidence" (id,"collegeId",field,value,"sourceId","identityKey","isFixture") VALUES ('backup-claim','preserved-college','website','"https://example.test/"','preserved-source','backup-claim',true);
INSERT INTO "EvidenceDecision" (id,"evidenceId","reviewerId",status,reason) VALUES ('backup-decision','backup-claim','preserved-user','REJECTED','Synthetic recovery rehearsal');
INSERT INTO "AuditLog" (id,"actorId",action,"targetType","targetId") VALUES ('backup-audit','preserved-user','evidence.review','FieldEvidence','backup-claim');
INSERT INTO "Question" (id,text,"collegeId","userId") VALUES ('backup-question','Synthetic question','preserved-college','preserved-user');
INSERT INTO "CommunityReport" (id,"reporterId","questionId",reason,"updatedAt") VALUES ('backup-report','preserved-user','backup-question','Synthetic report',now());
SQL

archive_dir=$(mktemp -d)
trap 'rm -rf -- "$archive_dir"' EXIT
archive="$archive_dir/collegefind.dump"
pg_dump --dbname="$TEST_DATABASE_URL" --format=custom --no-owner --no-privileges --file="$archive"
sha256sum "$archive" > "$archive.sha256"
sha256sum --check "$archive.sha256"
printf 'Archive SHA-256: %s\n' "$(cut -d ' ' -f 1 "$archive.sha256")"
pg_restore --dbname="$RESTORE_TEST_DATABASE_URL" --no-owner --no-privileges --single-transaction --exit-on-error "$archive"

# Canonical row digests compare values and foreign keys without printing records.
for table in College User SavedCollege SavedComparison Source Program CutoffRecord AdmissionPlan PlanTask FieldEvidence EvidenceDecision AuditLog Question CommunityReport _prisma_migrations; do
  query="SELECT count(*), md5(coalesce(string_agg(to_jsonb(t)::text, ',' ORDER BY id), '')) FROM \"$table\" t"
  original=$(src -Atqc "$query")
  test "$original" = "$(dst -Atqc "$query")"
  printf '%s restored rows: %s\n' "$table" "${original%%|*}"
done

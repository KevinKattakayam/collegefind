# CollegeFind V3 upgrade plan

Status: Phase 2 local engineering complete with owner-controlled production gates pending; Phase 3 engineering conditionally accepted for local work; Phase 4 local profile/cutoff engineering is complete with real-data/owner gates pending; Phase 5 local engineering acceptance passed on `phase-5-search-comparison-shortlists`, with manual assistive-technology and owner-controlled release follow-ups still open.
Baseline: main `3ddf88d7f0dec224cde1984100e9208ce6285328`; audit date 2026-11-17.
Later user instructions authorize Phase 2 application changes and independently verified disposable local database/browser verification. Production, credential, push/merge and deployment actions remain unauthorized.

## Objective and scope

Upgrade the existing application into a reliable Indian college research and decision-support platform. Preserve Next.js App Router, React, strict TypeScript, PostgreSQL/Prisma, authentication, URLs, IDs, user data and existing tests. All 205 legacy college records must receive an individual official-source enrichment attempt and an explicit disposition. A pilot is a quality gate, never the final catalogue scope. Unknown and inaccessible facts remain unknown.

The nine phases below consolidate the V3 scope supplied in the conversation. The supplied V3 instruction file does not itself enumerate phase names; these are the canonical proposed phase boundaries, not a claim of an unseen prior specification.

## Existing architecture and decision

Browser client pages call Next.js API routes; server college/course/ranking pages query Prisma directly. PostgreSQL stores College summaries, Programs, dated CutoffRecord/FeesRecord/PlacementRecord/NirfRanking linked to Source, users, shortlists, comparisons, Q&A, Review schema and AuditLog. NextAuth credentials use bcrypt and seven-day JWTs. CompareContext persists only canonical IDs/slugs and restores current records from the server; the anonymous shortlist stores canonical slugs locally and merges through the authenticated saved API. Upstash is optional, with per-instance fallback. Offline CSV ingestion upserts cutoffs. Vercel production builds currently run migrations before the Next build succeeds.

Keep a modular monolith and existing typed records. Introduce shared server query services, versioned imports, review evidence and explicit projections of reviewed facts into filter/display summaries. Add field-level evidence for profile/contact/accreditation claims. A cutoff source cannot verify unrelated fees or placements.

Alternatives:

| Design | Benefit | Cost / decision |
| --- | --- | --- |
| Existing monolith plus typed evidence/import/review tables | Small diffs, transactional integrity, reuse existing code/tests | Recommended; summary rules must be explicit |
| Generic claim/value store for all facts | Flexible conflicts and provenance | Harder typed validation, SQL filtering and migrations; use only for justified profile evidence |
| Separate ingestion/data API services | Independent scaling | Extra deployment/consistency burden; defer until measured load warrants it |

## Nine-phase roadmap and gates

Phase 1 audit is complete; Phase 2 local engineering is complete with production operations still owner-blocked; Phase 3 engineering is conditionally accepted with factual review and production blockers; Phase 4 local profile/cutoff engineering is complete with data/manual accessibility/production gates pending; Phase 5 and Phase 6 have local checkpoints; Phase 7 private plans, counselling choice lists, application tracking, personal deadlines, checklists and in-app reminders are implemented and locally verified. Phase 8 local account, community, moderation and stale-safe evidence-review slices have passed focused checks, but Phase 8 remains **PARTIAL**: email recovery/verification, manual assistive-technology review and inherited production/data gates remain open. Phase 9 is active on `phase-9-production-hardening`. The local release gates and recovery rehearsal are recorded in the status document. Remote and owner gates remain open. Passing a phase requires recorded automated evidence and essential permitted browser/manual evidence; blocked checks prevent DONE. Phase 1 is not a production-readiness certification.

| Phase | Scope and user outcome | Pass/fail acceptance | Dependencies / verification |
| --- | --- | --- | --- |
| 1 — Audit and V3 specification | Architecture, full 205-row completeness ledger, existing-flow inventory, risks, baseline checks and scoped plan | Exactly 205 unique ledger entries reconcile to seed; all ten requested domains assessed; evidence statuses distinguish tested, blocked and unverified; only three approved docs changed | Reuse Phase 1 tests/CI; validate documentation references and ledger mechanically |
| 2 — Data-integrity and safety foundation | Safe disposable-test harness; enforced server env; field evidence, review states, import runs/source versions, demo isolation and reviewed-summary policy | Unknown/non-disposable targets rejected before opening a DB; no DATABASE_URL fallback; explicit disposable fixture succeeds; schema migrations rehearse on isolated DB; stale demo metrics cannot become published facts through cutoff import; invalid source metadata rejected | Sol Medium/High for security/schema; owner evidence for historical secret remediation remains a release gate; unit + isolated integration + migration tests |
| 3 — Full-catalogue official enrichment | Verify 10-college pilot, expand to 50, then batches of up to 25 until all 205 dispositioned; research identity, descriptions, courses, admissions, fees, placements, scholarships, facilities, accreditation and official links | 10/10 pilot colleges have official identity/link evidence and ten-domain dispositions before scaling; final 205/205 have research attempt dates, field statuses, source/evidence trail or explicit blockers; zero invented facts/citations; zero automatic VERIFIED claims from retrieval alone | Phase 2 evidence model; legitimate source access/rights; independent reviewer capacity; import reconciliation and manual evidence review |
| 4 — Useful profiles and complete cutoff exploration | Improved programme-aware profiles, costs, outcomes, accreditation validity, facilities/scholarships, sources and corrections; shared cutoff service with filters, all supported seat pools, years/rounds and pagination | 61+ and 2,001+ fixture histories fully reachable with correct totals; every represented exam/system/year/round/quota/category/PwD/seat-pool/rank dimension is preserved; page/API agree; page size is bounded and ordering has a unique tie-breaker; unknown/stale/source states are explicit; fees and placement definitions/year are visible; desktop/mobile and keyboard checks pass; no staged/demo value appears verified | Phase 3 engineering gate; source-backed projection; additive migration rehearsed on a verified disposable DB; unit/integration, mobile/keyboard E2E, empty/error/source checks; genuine data coverage reported separately |
| 5 — Search, comparison and shortlists | Search/filter/sort/autocomplete, truthful featured/recommendations, shareable comparisons, restoring saved comparisons, fresh persisted selection IDs | Shared 2–3-college URL reconstructs in a clean browser; saved comparison restores exact order; invalid/deleted IDs explicit; no null or demo value wins; all compared facts have matching scope/year or explicit incompatibility; API errors differ from zero results; deterministic pagination | Reviewed projections; unit and desktop/mobile E2E for search/back/forward/filtering/save/share/restore/delete and denied access |
| 6 — CollegeFit and responsible estimates | Explainable preference matching by eligible programme, location, verified cost and user priorities; distinguish preference fit from admission history; freshness-aware predictor | Reasons and exclusions reproducible; unknowns do not score as advantages; no demo inputs; changing one preference yields explainable results; unsupported/stale admission cycles withheld; no uncalibrated numeric admission probability published | Programme/rule coverage; deterministic fit tests; held-out per-exam/category evaluation before probabilistic claims; interval coverage alone is not probability calibration |
| 7 — Admissions planning | Private plans, preference-ordered counselling lists, application tracking, personal tasks/deadlines and in-app reminders | Plan/task CRUD is owner-scoped; choice duplicate prevention/order and application/task optimistic concurrency pass isolated integration tests; user-entered statuses and personal reminder dates persist across refresh; local date/time uses an IANA timezone; personal reminders are clearly distinct from official schedules; stale/conflicting edits are rejected; no promise of admission or external application submission; notification delivery is out of scope without an authorized scheduler | CollegeFit + official policy coverage; isolated integration and real-session desktop/mobile E2E; manual assistive-technology review and owner-controlled production checks remain separate gates |
| 8 — Accounts, community and reviewer operations | Account profile/preferences/export/deactivation; private-data cleanup; college Q&A edit/remove/report; report moderation; race-safe evidence decisions; retain existing login/session and evidence workflows | Account and Q&A ownership enforced server-side; exports exclude credentials and cross-user data; deactivated users lose access immediately; private plans/saves removed while required evidence/audit references remain; reports are idempotent; moderator actions have required reasons, state preconditions and audit rows; hidden content is absent from public APIs; evidence decisions reject stale reviewer state; desktop/mobile workflows pass. Email verification/recovery remains blocked until a mail provider and token lifecycle are approved. | Existing auth provider and Prisma; additive migration rehearsed on verified disposable DB; focused unit/integration/E2E. Manual AT and owner-controlled production checks remain separate. |
| 9 — Production hardening and final verification | Gated CI incl. E2E, dependency/security checks, migrations separate from builds, backups/restore, monitoring, SEO, accessibility, mobile/low-bandwidth performance, full catalogue reconciliation | Exact release SHA passes lint/typecheck/unit/isolated integration/build/E2E; no unaccepted critical/high vulnerability; restore drill passes agreed RPO/RTO; real HTTP + browser smoke succeeds; no serious/critical automated a11y findings on core flows; 205/205 dispositions reconcile; no unresolved P0 or unaccepted P1 | Owner-approved production actions, safe environment access, current source reviews; retain artifacts and exact commands/results |

### Phase 8 implementation acceptance snapshot

- [x] Reuse existing NextAuth credentials/session and ADMIN checks; revalidate active account state from the database on each server authorization.
- [x] Provide owner-scoped account settings and private export; keep email immutable without a verified identity-change process.
- [x] Provide safe account deactivation that clears login access and owner private data while retaining anonymized identity rows required by evidence/audit history; protect the final active administrator.
- [x] Preserve college Q&A and add author edits/removal, authenticated reports, duplicate prevention and public visibility filtering.
- [x] Provide an ADMIN moderation queue with server-side pagination, safe payloads, reasoned actions, stale-state checks and transactional audit records.
- [x] Make evidence decisions stale-safe and retain all existing source, fixture, expiry, conflict and reviewer controls.
- [x] Verify additive migration, ownership and moderator authorization against the independently checked disposable PostgreSQL target; run unit/integration/browser, lint, typecheck and webpack build.
- [ ] Implement email verification/recovery only after owner approval of a provider and secure token lifecycle.
- [ ] Complete manual screen-reader/magnification review and owner-controlled production security, rate-limit, backup/restore and genuine-evidence review.

Exact Phase 8 test evidence and the local-only limitation are recorded in `docs/UPGRADE_STATUS.md`. This snapshot is not a Phase 8 completion or production-readiness claim.

### Phase 9 release gates

- [x] Remove migration execution from deployment builds and reconcile Prisma declarations with the tracked migration history.
- [x] Disable production demo seeding and require a working distributed limiter on sensitive production actions. Keep liveness independent of dependency readiness.
- [x] Exercise fresh and legacy schema migration paths and restore a synthetic backup into a separate verified disposable database.
- [x] Add blocking advisory and redacted secret scans to CI. Run desktop and mobile suites with isolated server lifecycles.
- [ ] Verify the exact candidate SHA in remote GitHub Actions, then verify production configuration, rollout and rollback in an owner-approved environment.
- [ ] Complete manual accessibility checks and collect owner evidence of historical credential revocation, distributed rate limits, backup retention and measured recovery readiness.
- [ ] Obtain required source permissions and genuine reviewer decisions. Preserve the reviewed-only public projection.

See [Production release and recovery](PRODUCTION_RELEASE.md) for the owner procedure and [Upgrade status](UPGRADE_STATUS.md) for exact test evidence.

## Current content execution update — Batches 045–048 (2026-11-21)

The existing source-reported projection was extended with 53 individually attributed facts across programme, facilities, admission-route, and contact sections. Runtime eligibility at 2026-11-21 17:54:26 UTC measured 173/205 profiles with source-reported facts, 380 facts, 70 multi-category profiles, and 32 basic-only profiles. Compared with the current pre-Batch-045 projection (161 / 327 / 56 / 44), the increment adds 12 newly informative profiles and 14 multi-category profiles. Batch 046 adds depth to nine already-covered profiles; Batches 045, 047, and 048 newly cover five, four, and three profiles respectively. This is a time-specific projection, not a completed catalogue-enrichment claim. Genuine human approvals remain zero; decision-critical facts remain behind stronger review. Browser/build verification and direct source restrictions are recorded in the status document.

## Full-catalogue research process

1. Freeze the original 205-slug manifest from the status ledger; never silently replace the cohort or count synthetic institutes toward coverage. Maintain aliases and external institution identifiers without changing existing IDs.
2. Select a diverse pilot of 10: include different states/types and differing source accessibility. Record selection rationale before research. No college is claimed verified merely by appearing in the pilot.
3. Establish the official institutional domain through legitimate authority directories and institution publications. Resolve identity/campus/affiliation ambiguities manually; do not invent website domains.
4. Record access/reuse terms, exact document URL, retrieval date and permitted artifact/hash. Use authorized official downloads first; observe robots, licences, rate limits and anti-bot restrictions. If access/reuse is unavailable, retain a blocker and a verified external link where possible.
5. Research each domain independently: official prospectus/catalogue for programmes and admissions; dated programme/category-specific fee schedules; placement reports with cohort/denominator and median versus average distinction; official scholarship scheme eligibility; institutional facilities pages; accreditation authority records with validity; official contact pages. JoSAA/MCC policies and NIRF reports are sources only for the claims they actually contain.
6. Store claim type/value/unit, programme/campus/category where relevant, reporting/academic year, validity period, publisher, exact URL, retrievedAt, artifact locator/page/table/hash if permitted, extraction method/version, reviewer decision/date and superseded/conflicting evidence. Descriptions are attributed factual summaries, not copied marketing or fabricated prose.
7. Stage extraction as unverified. Apply schema/range/unit/cross-field checks, identity matching and source-row reconciliation. A human review is distinct from automated source validation; retain disagreement and rejection evidence.
8. Publish a reviewed batch atomically or with explicit resumable state. Re-imports must deduplicate source artifacts, preserve history, report partial failures, and never promote unrelated demo summaries.
9. After pilot acceptance expand to 50; then batches <=25 to 205. Every batch reports assessed/published/blocked per field, stale facts and next review dates. Institution-level completion means research/disposition complete, not every fact found.
10. Recheck time-sensitive admissions information each cycle and before prominent display; fees/accreditation by their validity periods. Record expiry policies explicitly. Accept correction reports and withdraw unreliable claims promptly.

Final coverage gate: each of 205 originals has all ten domain dispositions with a dated legitimate research attempt; every missing field is either unavailable after research or blocked with reason/next action. Current ledger records repository completeness only, so all external research remains pending. No production database coverage is inferred.

## Existing feature continuity and regression inventory

| Existing flow | Required upgrade / regression |
| --- | --- |
| Home, stats, featured colleges | Verified counts only; synthetic/demo excluded; truthful outage/empty states; P3/P5/P9 |
| Catalogue, autocomplete, search modal, filters, sorts, grid/list, pagination | Reviewed scope-aware filters; deterministic ties; URL/back-navigation and error state tests; P5 |
| College detail, canonical slug/id redirect and 404 | Preserve IDs/URLs; source-aware profiles, real 404 and redirects tested; P4/P9 |
| Courses and exam list/detail, official resources/articles | Source/review/validity for claims and links, truthful availability, no stale dates; P3/P4/P9 |
| Rankings API/page | Official category/year sources; importer/review path; missing data distinct from DB error; P3/P5 |
| CompareContext, CompareBar, table, slots, radar and verdict | Store IDs/refetch; share/restore; null handling, ties, all-known comparison scope; accessible chart alternative; P5 |
| Saved colleges/comparisons | Ownership, retries, duplicate/race/limit behavior; restore selected IDs/order; real-session E2E; P5/P8 |
| Predictor API/client/model | Exam-specific rules, CRL/category/PwD/quota/gender/round semantics; deterministic candidate pagination; current target year; no fake accuracy; P6 |
| Cutoff page/API/history | Remove silent 60-row and pre-dedup caps; expose supported pools and complete filtered history; P4 |
| Q&A and moderation | Real UI flows, spam controls, hidden parent/child behavior, admin queue/audit; P8 |
| Review schema | No claim of shipped reviews; identity/moderation and aggregate update tests before enabling; P8 |
| Register/login/logout, callback redirects, recovery control | Working recovery, verified accounts, labelled accessible controls, expired/revoked sessions; P8 |
| Seed CLI/API and synthetic fixtures | Preserve guarded non-destructive behavior; reject production synthetic data before writes; isolate demos; P2/P9 |
| JoSAA ingestion | Source dedup, metadata validation, conflicts, partial-run recovery, stale-demo policy, idempotency; P2/P3 |
| Health, env, rate limits, origin checks, security headers | Enforce environment validator, immediate admin revocation, explicit Redis-outage policy, real HTTP evidence; P2/P8/P9 |
| Layout/nav/footer, SEO/robots/sitemap/error pages | Mobile/keyboard/low-bandwidth; correct canonical host; no demo SEO claims; error recovery and source freshness; P4/P9 |

## Priority and known defects

P0 release gates: historical DB/session secret rotation not evidenced; production health/backup restore not established; unsafe integration test target fallback before truncation. P1: demo metrics in decision paths; no field-level verification; importer retains stale metrics and creates duplicate sources; share/save restoration broken; null radar fees score best; bestIndex permits two known values out of three contrary to copy; cutoff caps/PwD exclusion; heuristic percentages and stale target years; unwired getEnv; stale JWT admin privileges; outages masquerade as empty data. P2: recommendation relevance, account/admin/reviewer completeness, missing authenticated E2E/a11y/performance/coverage enforcement.

## Engineering verification policy

Reuse known results in UPGRADE_STATUS; rerun only after relevant changes, failures or stale external evidence. Node >=22; Prisma package declarations use caret ranges although docs historically claimed exact pins. Lockfile provides resolved versions. CI success for the audited SHA is historical; current dependency advisories and production health require new evidence when access permits. Never treat blocked audit/network/build checks as passes.

Require tests around real failure modes: import existing-demo row, interrupted batch, duplicate artifact, mismatched source year/unit, old evidence, source withdrawal, >60 cutoff rows, all seat pools, null fees, three-way comparison with one unknown, clean-browser shared link, deleted selection, real cookies and revocation. Add coverage for critical service/auth branches; proposed changed-module minimum 80% line and 80% branch coverage, while preserving higher existing levels. Coverage never replaces scenario tests. Set final performance/RPO/RTO budgets before production acceptance, and record measured results rather than invented targets met.

## Migration, backup and rollback

Use additive expand/backfill/contract migrations. Preserve college IDs/slugs and user relationships. Archive demo inputs as identifiable fixtures/evidence before clearing production summaries; do not overwrite verified facts. Rehearse migrations and restartable bounded backfills on disposable restored data. Compare row counts, FKs, programme mappings and query behavior. Owner-approved protected backup plus verified restore is mandatory before production migration. Do not run migrations as an incidental build step.

Version published data batches; withdraw/revert a faulty publication independently of code rollback. Keep old application compatible during schema expansion, use flags for new readers, and prefer forward fixes. Database restoration requires an explicit reconciliation plan for user writes after the snapshot. Never resurrect invalidated secrets or fabricated metrics in rollback. Record snapshot identifier, migration SHA, batch IDs, operator, rollback trigger and measured restore outcome without credentials.

## Risks, blockers and execution boundaries

Source rights/access may prevent complete factual population; definitions and academic years differ; identity/campus mappings can be wrong; admission rules need domain review; reviewer capacity is a hard dependency. No official source has been newly researched in this documentation step. Production configuration, credential rotation, Redis configuration, backup retention and actual deployed SHA remain unverified. Owner-side evidence and permissions are needed for production work, never inferred from documentation approval.

Use Luna Medium for routine bounded implementation and Sol Medium/High for architecture, DB integrity, admission rules and security. If a model is unavailable, report that limitation rather than claiming a switch. Reuse evidence and avoid repetitive scans. Delegate only when user/instruction scope permits it; no delegation was needed for these documentation edits.

The three-file restriction applied to the initial audit documentation deliverable. Phase 4 code and the requested upgrade/coverage documentation are now authorized; preserve the rest of the repository scope unless separately approved.

## Phase 2 first task — completed (historical acceptance)

Harden the integration-test database target guard before any test connection or destructive reset.
Proposed files: tests/integration/db.ts, tests/integration/setup.ts, a small pure target-validator module and unit tests, plus relevant testing docs/status within the then-approved scope. No change is authorized by this plan alone.

The following was the acceptance contract. Its completion evidence is maintained in `docs/UPGRADE_STATUS.md`; do not treat this historical section as an unstarted task.

Acceptance:

- Remove fallback from TEST_DATABASE_URL to DATABASE_URL; never construct a test client at module evaluation before validating the target.
- Require explicit disposable-test authorization and a target identity/allowlist tied to a disposable harness. A database name containing “test” is insufficient proof. Redact URLs in errors.
- Unit tests prove missing, malformed, unconfirmed, production-like and mismatched target inputs fail before Pool/Prisma construction or SQL; approved disposable target accepted.
- resetDb verifies the same guard before TRUNCATE; no secret-bearing error/log output.
- Prove both integration import order and beforeAll order cannot bypass validation; absent authorization exits without network connection.
- Lint/typecheck/unit tests pass. Run reset/integration only after creating and explicitly verifying a disposable DB; record isolated integration evidence or leave BLOCKED, never DONE.
- No real database/production connection, credential changes or deployment. Sol Medium/High reviews the safety boundary. Report exact changed files/tests and preserve the 205-record catalogue baseline.

## Phase 4 implementation checklist — current local increment

- [x] Preserve Phase 3 on a clean local checkpoint and work on `phase-4-profiles-cutoffs`; keep production and owner-review data untouched.
- [x] Inspect existing college profile, approved evidence projection, JoSAA ingestion and cutoff endpoints before extending them.
- [x] Render structured verified profile facts in domain sections with source publisher, URL, publication/retrieval/review times and unavailable states; keep demo summaries labeled and staged evidence unpublished.
- [x] Provide profile cutoff preview and a direct institution-filtered link to the shared explorer.
- [x] Provide server-side cutoff filtering/counting/pagination with stable order, bounded page size, URL-restorable filters and provenance on each row.
- [x] Preserve unknown legacy counselling/rank dimensions as `UNSPECIFIED`; classify only JoSAA-imported data from the known importer as JoSAA with explicit rank semantics.
- [x] Add the counselling system and rank type through an additive migration; apply it only to a newly verified disposable DB.
- [x] Verify query filters, latest review decision, fixture/demo exclusion, pagination, public API behavior, JoSAA import and desktop/mobile browser navigation.
- [x] Load-test 61 and 2,001 records with representative dimensions; inspect query plans and add the measured latest-decision lookup index.
- [x] Add a fully scoped historical opening/closing-rank trend with missing year/round gaps, no extrapolation, exact academic-year/source/evidence-location table and rank-only semantics.
- [x] Verify trend scope isolation, empty/single-point/missing-value behavior, source attribution, keyboard-focusable alternatives, narrow viewport overflow and URL Back/Forward/refresh on desktop/mobile.
- [ ] Obtain/ingest source-backed cutoff records and verify their public coverage after genuine authorized review. The test-only fixtures are not official data.
- [x] Verify cutoff filter labels, invalid/empty states, narrow viewport overflow, refresh, Back/Forward restoration and profile navigation on desktop/mobile smoke coverage.
- [ ] Complete manual screen-reader and broader profile accessibility review beyond the automated focused browser coverage.

### Phase 4 migration safety

Migration `20261119010000_cutoff_counselling_system` adds `CounsellingSystem` and `CutoffRankType`, defaults existing records to `UNSPECIFIED`, and replaces the natural-key index to include counselling system. It leaves all college and user IDs/relationships intact. It was applied to a newly provisioned, loopback-only disposable database; no production migration ran.

Before any future rollback, first verify the new values are unused or acceptably recoverable. The added counselling-system/rank-type values are semantically meaningful, so dropping the columns after real imports is lossy. Also check for duplicate old natural keys after ignoring `counsellingSystem`:

```sql
SELECT "programId", exam, year, round, quota, category, "isPwd", "seatPool", count(*)
FROM "CutoffRecord"
GROUP BY "programId", exam, year, round, quota, category, "isPwd", "seatPool"
HAVING count(*) > 1;
```

Any returned group blocks restoring the previous unique index until the source records are reconciled without deleting evidence/audit history. If no conflict exists and no non-`UNSPECIFIED` values need preservation, a reviewed rollback may drop the expanded index, recreate the prior natural-key index, drop the two columns, then drop the two enum types. Prefer a forward fix once real data uses these fields. Take and verify a disposable backup before rehearsing rollback; production rollback requires separate owner authorization and a protected backup/restore plan.

The additional performance migration `20261119020000_cutoff_review_lookup_index` adds an index for latest-decision lookups. It changes no rows and is not required for application correctness; reverting application code does not require dropping it. If a reviewed rollback explicitly removes the index, PostgreSQL requires `DROP INDEX CONCURRENTLY "EvidenceDecision_cutoffId_createdAt_id_idx";` outside a transaction; reconcile Prisma migration history with the migration operator. This rollback was not run against production. The migration was applied only to the verified disposable database described in status.

## Phase 5 implementation checkpoint — 2026-11-19

Phase 5 is active on `phase-5-search-comparison-shortlists`. The current milestone improves the existing catalogue search/comparison/save flows; it does not declare Phase 5 accepted. See `docs/SEARCH_COMPARISON_SHORTLISTS.md` for API and persistence behavior.

- [x] Search aliases/campus labels in the existing query path; add city, programme text, degree-level and eligibility filters backed by the reviewed public projection.
- [x] Keep identity-only search count/pagination/order in PostgreSQL; use projected-data filtering for trusted measured fields over the current bounded 205-record catalogue. Reassess and move this filtering/count path into SQL before catalogue scale materially increases.
- [x] Ensure exam filtering uses only currently approved, source-backed cutoff records; raw unreviewed cutoff rows cannot qualify a result.
- [x] Keep filter state in the URL and restore the controlled search input on Back/Forward; add an accessible responsive filter sheet with focus management, Escape close, and an explanation that unknown values do not match.
- [x] Persist only comparison IDs/slugs locally, resolve current server records for shared links, permit replacing/removing/clearing slots, and keep edited slots reflected in shareable URLs.
- [x] Compare structured reviewed facts with their own programme/category/year/source context without declaring winners across unlike scopes; retain missing-value suppression in numeric highlights.
- [x] Add anonymous device-only slug shortlists, guest slug resolution, authenticated transactional/idempotent merge, owner isolation and recovery behavior.
- [x] Test alias/trusted search, shortlist merging and ownership, comparison sharing/restoration/editing, and mobile workflows on the latest built tree.
- [x] Measure projected search at 205 and 5,205 synthetic college rows with 30 warm route-handler requests per size, verified result counts/pages and stable boundaries; local target is p95 <=300 ms at 5,205 rows (not a production SLA). The current final run measured p95 231.16 ms. No DB-side fact-filter rewrite or index was justified at this tested size.
- [x] Inspect PostgreSQL plan for identity filtering at 5,205 rows; record scan/sort behavior and buffer use. Keep unique ID tie-breakers for equal sort values.
- [x] Stress the real saved API at the 200-item cap with 201 candidate colleges and concurrent requests from two authenticated browser contexts; verify one cap rejection, no duplicates/lost rows, stable reads, idempotent merge and owner isolation.
- [x] Verify cross-context restoration, merge-failure retry, optimistic save rollback after 503, comparison share/refresh and desktop/mobile flow after the final build.
- [ ] Complete manual screen-reader/assistive-technology review. Automated keyboard, semantic, focus and narrow viewport checks pass but do not replace human AT review.
- [ ] Review the non-fatal PrismaPg/pg deprecation warning under query concurrency before upgrading to pg 9; current tested calls complete and all DB/browser assertions pass.
- [ ] Complete owner-controlled production security/release evidence inherited from Phases 2/3/4 and obtain genuine human review of sourced college claims.

Phase 5 local engineering acceptance is **PASS with follow-ups**. Data verification and production readiness remain blocked; no official college data, cutoff coverage or genuine reviewer count changed in this milestone.

### Phase 6 implementation checklist

- [x] Reuse catalogue identity and the public evidence projection for CollegeFit. Show reasons, priority, source and academic year. Keep incomplete evidence outside the comparable ranking.
- [x] Restore preferences from the URL. Reuse profile, comparison and shortlist actions. Account preference storage has no existing model, so bookmarks handle preference restoration in this phase.
- [x] Replace the heuristic forecast with separate eligibility guidance and exact reviewed historical rank comparisons. Preserve the existing page URL and document the changed API contract.
- [x] Keep rank entry local to the browser. Keep approval and source checks at the database read boundary.
- [ ] Obtain authorized reviews of programme, fee, admission and cutoff evidence. Real coverage is limited by those reviews and legitimate cutoff source use.
- [ ] Complete the inherited manual assistive technology and production acceptance checks.

See [CollegeFit methodology and admission guidance](PREDICTOR.md) and the Phase 6 verification entry in [Upgrade status](UPGRADE_STATUS.md).

## Verified content follow-up

- [x] Present catalogue identity separately from individually reviewed facts. Add direct first-party reading links where the institution and source can be matched.
- [x] Build a 205-college publication and research ledger joined to the preserved archive. Group existing claims by institution and source using their current review IDs.
- [x] Complete the first bounded follow-up on 20 colleges and validate supported candidates with the official facts importer in dry run.
- [x] Show standing programme facts on profiles under a separate, time-limited source-reported policy. Keep the verified-only product inputs unchanged. Confirm the first 20 colleges in desktop and mobile Chromium.
- [ ] Stage eligible Batch 029 candidates through an authorized path compatible with persistent owner review. Resolve source-specific, campus and freshness holds separately.
- [ ] Have the owner review individual archived claims and check the published result in supported student views. Continue through the catalogue backlog with current programme, fee, eligibility, accreditation and outcome sources.

The dedicated owner staging command now supports read-only preview, batch hash approval and encrypted backup validation. Persistent staging remains an owner authorization gate. The first 25 existing claims are available independently of the Batch 029 authorization.

The scoped programme milestone adds a further 42 institutions through Batch 033 and explicitly attributed archive releases. Reuse the same evidence and release checks as the remaining colleges are researched. Scope each programme to the publisher’s period when supplied. Treat price, outcomes and admission decisions under the existing human review rules. [Coverage](DATA_COVERAGE.md#publication-of-programme-periods-and-facilities-batch-033)

### Content depth follow-up — 2026-11-21

- [x] Add source-reported admissions-route and institutional-contact cards to the existing profile sections while preserving the separate source label and keeping these facts out of verified-only APIs, search, comparison, CollegeFit and admission recommendations.
- [x] Reuse existing official-source research and add 51 individually attributed low-risk programme, facility and time-scoped admission candidates across batches 034–036. No persistent evidence or owner-review decision was written.
- [x] Reconcile source facts into the existing 205-entry profile ledger. Source-reported cards now cover 103 profiles (126 facts); 21 profiles have facts in at least two categories. These are content-depth measures, not verified completeness.
- [ ] Complete type-specific source research and genuine review for missing eligibility, fees, scholarships, recognition, placements and cutoffs. High-impact facts remain behind human evidence review and appropriate source-use checks.

### Content depth continuation — Batch 037

The research/release increment extends the existing checked-in source-reported path without changing the evidence schema or trusted projections. It adds directly attributed degree/programme details for five profiles and exact periods where the official page supplies them. Programme-only pages remain partial; the data backlog still prioritizes eligibility, fees/aid, recognition validity, placements and official cutoff records. The batch is documented in `data/pilot/substantive-research-batch-037.json`; its facts are source-reported only and were not imported into the owner's persistent review database. Continue with a new bounded research set after verifying exact institutional pages, identity, scope, freshness and reuse conditions.

### Content-depth continuation — Batches 038–039

The source-reported rendering pipeline now contains 206 individually attributed facts across 117/205 profiles; 29 profiles have at least two source-reported categories, while 88 remain identity/navigation-only. Batches 038–039 added 38 facts on eight previously basic colleges, including programme, admissions-route, facilities and contact information. Time-scoped and campus-scoped details carry explicit historical or unspecified-scope context. Decision-critical fees, eligibility thresholds, accreditation validity, rankings, placement outcomes and cutoffs remain unpublished absent the stronger source/review evidence. All claims remain source-reported and unverified. Continue by prioritizing the remaining 88 basic profiles, then add missing categories to partial profiles; favor complete useful institutional records rather than extra programme names on already-covered institutions. Keep source-use, current-cycle, campus identity and owner-review controls intact.

## Content breadth milestone — Batch 040

The existing source-reported path was extended with 36 source-grounded observations from Batch 040 and two previously researched Loyola observations. Facts remain `OFFICIAL_SOURCE_REPORTED`, separate from `VERIFIED`, and use only official sources and concise attributed factual values. The 205-profile coverage ledger reconciles the change: 206 to 244 source-reported facts; 117 to 124 profiles with facts; 29 to 37 multi-category profiles; 88 to 81 basic-only profiles. High-impact fields remain behind genuine human review. Eight research/source-scope holds are preserved. The review database was not changed. Live browser acceptance remains pending until an isolated disposable PostgreSQL service is available; see `UPGRADE_STATUS.md` for actual commands and environment results.

### Content breadth follow-up — Batch 041

Batch 041 adds ten official-source observations across three previously basic profiles: six programme facts and four contacts. The current ledger is 254 facts across 127 profiles, 39 multi-category profiles and 78 basic-only profiles. NIT Kurukshetra records are explicitly historical (2024–25); Madras Medical College's source has no stated cycle; Stanley's course listing is historical (2026–27), and its contacts carry a freshness caveat. The naming conflict at NIT remains held. No persistent review-database writes or human decisions were made. This increment prioritizes breadth with a small source-backed batch; the unchanged zero coverage for fees, scholarships, accreditation, placements and cutoffs remains a substantial content gap. Live browser acceptance is still blocked by the unavailable isolated database/service. The combined changes pass lint, typecheck, all 143 unit tests, Prisma validation/generation and the release secret scan; the production webpack build currently fails while parsing Next.js's TypeScript `--showConfig` subprocess output, and is not waived.

### Batch 042 student profile follow-up

The host webpack build and archive-backed browser workflow cleared the Batch 040–041 verification gap. Batch 042 publishes eight more profiles through the existing source-reported pipeline. Current coverage is 135/205 substantive profiles, including 45 with multiple categories. Continue research across the remaining 70 basic profiles and use the existing human review packet for fees, eligibility, aid and outcomes.

### Content increment: Batch 043

Seven previously identity/link-only profiles now display 27 source-attributed details through the existing profile renderer. This is source-reported content, not human-verified evidence: 23 programme listings, one historical admissions route, one historical library schedule and two contacts. Coverage moved from 135 to 142 substantive profiles, 45 to 47 multi-category profiles, and 70 to 63 basic-only profiles. The year was not inferred for historical pages that did not state one; one LHMC route candidate is held because its admission cycle is unspecified. Archived evidence remains at 377 claims, genuine human approvals at zero, and cutoff records at zero. Continue broadening accurate current-cycle admissions, facilities and contact information across the remaining 63 basic profiles while preparing decision-critical facts for genuine reviewer inspection.

## Verified-content continuation note — Batch 044

The content workstream now has 161/205 profiles with substantive source-reported facts (327 facts), 56 profiles with two or more source categories, and 44 identity/navigation-only profiles. Batch 044 contributes 31 attributed, unreviewed source-reported facts across 19 previously basic profiles. This is not human verification or catalogue completion: staged archive claims remain separately governed, human approvals remain zero, and high-impact fields and official cutoffs remain unavailable until appropriate review/source evidence exists. See the dated Batch 044 evidence in `UPGRADE_STATUS.md` and `DATA_COVERAGE.md`.

## Verified content continuation — Batch 049

The source-reported content milestone advanced from 173 informative profiles / 380 facts / 70 multi-category / 32 basic-only at the prior snapshot to 181 / 400 / 75 / 24 at `2026-11-22T03:52:00Z`. This adds 20 individually sourced facts across eight previously basic institutions, with the correct institutional/campus/year scope and a clear not-independently-verified label. This is a measured content increment, not completion: 24 profiles remain basic-only, human approvals remain zero, and high-impact fees/eligibility/aid/recognition-validity/outcomes/cutoffs remain gated for genuine owner review. See Batch 049 in `docs/DATA_COVERAGE.md` and the per-college ledger; continue official-source work breadth-first and retain explicit source-access dispositions.

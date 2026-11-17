# CollegeFind V3 upgrade plan

Status: Phase 2 implementation and local verification authorized; operational acceptance pending. Phase 3 NOT STARTED.
Baseline: main `3ddf88d7f0dec224cde1984100e9208ce6285328`; audit date 2026-11-17.
Later user instructions authorize Phase 2 application changes and independently verified disposable local database/browser verification. Production, credential, push/merge and deployment actions remain unauthorized.

## Objective and scope

Upgrade the existing application into a reliable Indian college research and decision-support platform. Preserve Next.js App Router, React, strict TypeScript, PostgreSQL/Prisma, authentication, URLs, IDs, user data and existing tests. All 205 legacy college records must receive an individual official-source enrichment attempt and an explicit disposition. A pilot is a quality gate, never the final catalogue scope. Unknown and inaccessible facts remain unknown.

The nine phases below consolidate the V3 scope supplied in the conversation. The supplied V3 instruction file does not itself enumerate phase names; these are the canonical proposed phase boundaries, not a claim of an unseen prior specification.

## Existing architecture and decision

Browser client pages call Next.js API routes; server college/course/ranking pages query Prisma directly. PostgreSQL stores College summaries, Programs, dated CutoffRecord/FeesRecord/PlacementRecord/NirfRanking linked to Source, users, shortlists, comparisons, Q&A, Review schema and AuditLog. NextAuth credentials use bcrypt and seven-day JWTs. CompareContext persists complete college objects in localStorage. Upstash is optional, with per-instance fallback. Offline CSV ingestion upserts cutoffs. Vercel production builds currently run migrations before the Next build succeeds.

Keep a modular monolith and existing typed records. Introduce shared server query services, versioned imports, review evidence and explicit projections of reviewed facts into filter/display summaries. Add field-level evidence for profile/contact/accreditation claims. A cutoff source cannot verify unrelated fees or placements.

Alternatives:

| Design | Benefit | Cost / decision |
| --- | --- | --- |
| Existing monolith plus typed evidence/import/review tables | Small diffs, transactional integrity, reuse existing code/tests | Recommended; summary rules must be explicit |
| Generic claim/value store for all facts | Flexible conflicts and provenance | Harder typed validation, SQL filtering and migrations; use only for justified profile evidence |
| Separate ingestion/data API services | Independent scaling | Extra deployment/consistency burden; defer until measured load warrants it |

## Nine-phase roadmap and gates

All implementation phases are NOT STARTED. Passing a phase requires recorded automated evidence and essential permitted browser/manual evidence; blocked checks prevent DONE. Phase 1 is the completed repository audit plus this documentation deliverable, not a production-readiness certification.

| Phase | Scope and user outcome | Pass/fail acceptance | Dependencies / verification |
| --- | --- | --- | --- |
| 1 — Audit and V3 specification | Architecture, full 205-row completeness ledger, existing-flow inventory, risks, baseline checks and scoped plan | Exactly 205 unique ledger entries reconcile to seed; all ten requested domains assessed; evidence statuses distinguish tested, blocked and unverified; only three approved docs changed | Reuse Phase 1 tests/CI; validate documentation references and ledger mechanically |
| 2 — Data-integrity and safety foundation | Safe disposable-test harness; enforced server env; field evidence, review states, import runs/source versions, demo isolation and reviewed-summary policy | Unknown/non-disposable targets rejected before opening a DB; no DATABASE_URL fallback; explicit disposable fixture succeeds; schema migrations rehearse on isolated DB; stale demo metrics cannot become published facts through cutoff import; invalid source metadata rejected | Sol Medium/High for security/schema; owner evidence for historical secret remediation remains a release gate; unit + isolated integration + migration tests |
| 3 — Full-catalogue official enrichment | Verify 10-college pilot, expand to 50, then batches of up to 25 until all 205 dispositioned; research identity, descriptions, courses, admissions, fees, placements, scholarships, facilities, accreditation and official links | 10/10 pilot colleges have official identity/link evidence and ten-domain dispositions before scaling; final 205/205 have research attempt dates, field statuses, source/evidence trail or explicit blockers; zero invented facts/citations; zero automatic VERIFIED claims from retrieval alone | Phase 2 evidence model; legitimate source access/rights; independent reviewer capacity; import reconciliation and manual evidence review |
| 4 — Useful profiles and complete cutoff exploration | Improved programme-aware profiles, costs, outcomes, accreditation validity, facilities/scholarships, sources and corrections; shared cutoff service with filters, all supported seat pools, years/rounds and pagination | 61+ and 2,001+ fixture histories fully reachable with correct totals; PwD/female/category/quota/exam dimensions preserved; page/API agree; per-field unknown/stale/source rendering works; fees and placement definitions/year are visible | Phase 3 pilot minimum; shared query integration tests, mobile/keyboard E2E, empty/error/source checks |
| 5 — Search, comparison and shortlists | Search/filter/sort/autocomplete, truthful featured/recommendations, shareable comparisons, restoring saved comparisons, fresh persisted selection IDs | Shared 2–3-college URL reconstructs in a clean browser; saved comparison restores exact order; invalid/deleted IDs explicit; no null or demo value wins; all compared facts have matching scope/year or explicit incompatibility; API errors differ from zero results; deterministic pagination | Reviewed projections; unit and desktop/mobile E2E for search/back/forward/filtering/save/share/restore/delete and denied access |
| 6 — CollegeFit and responsible estimates | Explainable preference matching by eligible programme, location, verified cost and user priorities; distinguish preference fit from admission history; freshness-aware predictor | Reasons and exclusions reproducible; unknowns do not score as advantages; no demo inputs; changing one preference yields explainable results; unsupported/stale admission cycles withheld; no uncalibrated numeric admission probability published | Programme/rule coverage; deterministic fit tests; held-out per-exam/category evaluation before probabilistic claims; interval coverage alone is not probability calibration |
| 7 — Admissions planning | Private choice lists, application/counselling tasks, official deadlines, source-backed eligibility and optional reminders | Choice ordering persists across reload/login; deadlines have year/timezone/source/review validity; stale/conflicting dates explicit; unauthorized access denied; no promise of admission; notification sends require explicit consent/authorization | CollegeFit + official policy coverage; isolated integration and real-session E2E; exam-specific rules approved before enabling |
| 8 — Accounts, community and reviewer operations | Verification/recovery, account profile/export/deletion, session revocation, usable admin/reviewer queue, Q&A moderation, correction requests; reviews only with identity/moderation capacity | Recovery/verification tokens expire and cannot replay; real login/logout/save flows work; demoted admins lose privileges immediately; every publication/moderation decision audited; hidden content stays hidden; review aggregates use approved reviews only; privacy flows tested | Approved mail provider and delivery testing, privacy requirements review, reviewer staffing; auth/security integration and E2E |
| 9 — Production hardening and final verification | Gated CI incl. E2E, dependency/security checks, migrations separate from builds, backups/restore, monitoring, SEO, accessibility, mobile/low-bandwidth performance, full catalogue reconciliation | Exact release SHA passes lint/typecheck/unit/isolated integration/build/E2E; no unaccepted critical/high vulnerability; restore drill passes agreed RPO/RTO; real HTTP + browser smoke succeeds; no serious/critical automated a11y findings on core flows; 205/205 dispositions reconcile; no unresolved P0 or unaccepted P1 | Owner-approved production actions, safe environment access, current source reviews; retain artifacts and exact commands/results |

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

Maintain only the three approved files in this step. Future DATA_COVERAGE.md, VERIFICATION_EVIDENCE.md and BLOCKERS.md remain planned; their required ledgers live in UPGRADE_STATUS.md until file creation is authorized.

## Exact first Phase 2 task — not started

Harden the integration-test database target guard before any test connection or destructive reset.
Proposed files: tests/integration/db.ts, tests/integration/setup.ts, a small pure target-validator module and unit tests, plus relevant testing docs/status within the then-approved scope. No change is authorized by this plan alone.

Acceptance:

- Remove fallback from TEST_DATABASE_URL to DATABASE_URL; never construct a test client at module evaluation before validating the target.
- Require explicit disposable-test authorization and a target identity/allowlist tied to a disposable harness. A database name containing “test” is insufficient proof. Redact URLs in errors.
- Unit tests prove missing, malformed, unconfirmed, production-like and mismatched target inputs fail before Pool/Prisma construction or SQL; approved disposable target accepted.
- resetDb verifies the same guard before TRUNCATE; no secret-bearing error/log output.
- Prove both integration import order and beforeAll order cannot bypass validation; absent authorization exits without network connection.
- Lint/typecheck/unit tests pass. Run reset/integration only after creating and explicitly verifying a disposable DB; record isolated integration evidence or leave BLOCKED, never DONE.
- No real database/production connection, credential changes or deployment. Sol Medium/High reviews the safety boundary. Report exact changed files/tests and preserve the 205-record catalogue baseline.

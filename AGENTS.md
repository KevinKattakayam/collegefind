# CollegeFind working standards

Apply to every phase. Read relevant code and docs/UPGRADE_PLAN.md and docs/UPGRADE_STATUS.md before work; inspect branch/git status and preserve unrelated changes. Upgrade the existing Next.js App Router/React/TypeScript/PostgreSQL/Prisma app, authentication, URLs/slugs/IDs, user records, features and test infrastructure. Justify specific architectural changes; do not rebuild unnecessarily.

## Scope and execution

- Work one approved coherent milestone at a time in small reviewable diffs. Do not infer implementation approval from a plan. Current user authorization covers Phase 2 implementation and disposable local verification. Phase 3, production changes, push/merge/deploy and credential rotation require separate authorization.
- Preserve stronger user instructions and pre-existing V3 standards. No production deployment, live seed, credential rotation, real-service configuration change, force push or history rewrite without explicit owner authorization. Do not silently broaden file scope.
- Use Luna Medium for routine bounded implementation; Sol Medium/High for architecture, database integrity, admission rules and security. Use the lowest-cost capable model; escalate repeated failures. Report unavailable models honestly. Avoid repeat checks without changes/new uncertainty. Delegation/model changes do not replace tests or review.

## Data and product integrity

- Never fabricate college facts, fees/seats/cutoffs/placements/salaries, accreditation/ranks, scholarships, facilities, reviews/testimonials, contacts/deadlines, success rates/endorsements, metrics or citations. No missing→zero conversion.
- All 205 original demo records require individual completeness assessment and official-source enrichment attempt/disposition. A pilot is not completion. Keep a per-college field ledger and unresolved-source backlog until 205/205 originals are processed; never claim all facts exist.
- Each actionable claim needs field/type, value/unit, programme/campus/category where relevant, academic/reporting year or validity period, publisher, exact official URL, retrieval date, review status, verification method and evidence/reviewer trail; record staleness/conflicts. Retrieval/automated source validation is not human verification. One sourced cutoff never verifies unrelated college metrics.
- Unknowns show Not available; sourced-unreviewed facts show Not yet verified; expired facts show Outdated. Isolate/prominently label demo/test data in development. Exclude demo/fictional data from live rankings, comparative winners, personalized advice, costs and marketing counts.
- Prefer legitimate first-party institutional/authority sources. Check actual rights/licence/terms, robots and access limits; never bypass security/anti-bot restrictions or bulk republish without rights. Record inaccessible/nonreusable sources as blockers; supply verified official external links where possible. Never guess links or facts.
- Admission rules must match exam/rank unit/category/PwD/gender pool/year/home state/quota/programme/round. Distinguish historical comparison and preference fit from admission probability. No uncalibrated heuristic presented as calibrated likelihood; never promise admission.
- Every control must work end-to-end within authorized scope or be explicitly unavailable. No dead buttons/navigation, fake success toasts or silently swallowed errors.
- Preserve mobile, semantic HTML, keyboard/screen-reader access, meaningful chart alternatives, SEO, performance and graceful low-bandwidth behavior.

## Engineering and security

- Never run destructive tests/migrations against real or unverified databases. Explicitly validate an isolated disposable target before any connection/reset; database naming alone is insufficient. Rehearse migrations/backfills and backup/restore/rollback before approved production work.
- Never print/log/copy/commit credentials, sessions, private student data or sensitive personal information. Owner-side evidence is required to establish historic leak rotation/revocation; do not test old credentials or claim remediation without evidence.
- Preserve strict validation, authz/ownership, least privilege, abuse controls, privacy, audit logs and generic safe errors. Imports must be idempotent with source deduplication, natural keys, transactions and visible partial-run recovery.
- Preserve user data and relationships through additive migrations, bounded restartable backfills and reviewed projections. Rollback must not resurrect fabricated facts or compromised secrets.

## Evidence and completion

- DONE means requirements implemented end-to-end, relevant automated tests pass, essential permitted manual/browser flows verified, error/empty states work and evidence is recorded. PARTIAL, NOT TESTED, BLOCKED and CI green alone are not DONE/production health.
- Run targeted checks during implementation; at milestone gates run lint/typecheck/unit, isolated integration/migration checks, production build and E2E/browser as applicable. Record exact commands, environment and PASS/FAIL/BLOCKED with reasons; never run destructive coverage suites on unverified DBs.
- Maintain UPGRADE_PLAN.md and UPGRADE_STATUS.md. Standing V3 documentation also requires DATA_COVERAGE.md, VERIFICATION_EVIDENCE.md and BLOCKERS.md when file scope is authorized; until then keep their ledgers in UPGRADE_STATUS.md. Do not create extra files contrary to current approval.
- Track each college's verified, source-backed-unreviewed, demo, missing and stale fields, sources/retrieval/review dates and blockers. Catalogue completion is 100% assessed/research-dispositioned originals, never invented 100% factual coverage.
- End each task with changed files, implemented behavior, test outcomes, data coverage before/after, security implications, remaining blockers and next scoped task. Never claim implementation from documentation alone.

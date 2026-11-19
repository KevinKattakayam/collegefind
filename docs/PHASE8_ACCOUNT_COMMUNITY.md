# Phase 8 account, community and moderation workflows

This document covers the local Phase 8 implementation on `phase-8-accounts-community-admin`. It does not certify production configuration or genuine college evidence.

## Account and privacy

- `/account` requires an active signed-in account. The page edits display name and an IANA timezone preference; email is read-only because the current credentials provider has no verified email-change workflow.
- `GET/PATCH/DELETE /api/account` are session-scoped. The API exposes no password hash, token or session material. The owner can export their account data at `GET /api/account/export` as private, non-cacheable JSON.
- Account deactivation requires typing `DELETE`. Because evidence-review history references the user, the system retains an anonymized, disabled user row instead of hard-deleting it. It removes saved colleges/comparisons/plans and user reviews/reports, hides and replaces community content, revokes admin role, clears profile/timezone and stored credential-hash fields, and blocks future authentication/session authorization. The final active administrator cannot deactivate; concurrent admin deactivations are serialized.
- Email verification, password recovery and email replacement are unavailable until an owner approves a mail provider and a secure token lifecycle. No custom password handling was added.

## Student community

- College pages expose paginated questions and answers as personal community contributions, explicitly distinct from official/reviewed facts. Text is stored and rendered as escaped plain text; no HTML or Markdown renderer is used.
- Authors may edit/remove only their own visible contributions. Content hashes and database uniqueness prevent duplicate submissions, including concurrent duplicate posts. Removal hides content and retains its row/audit trail.
- Signed-in users can report visible questions or answers. A reporter can create only one report per target. `/api/admin/moderation` provides an authorized, paginated, stable-order moderation queue; reporter IDs/names are not included in queue payloads.
- Moderators must provide a reason and the observed content state. Content state changes and report resolution/audit records commit transactionally. Stale/repeated actions receive `409` instead of overwriting newer moderation state. Public question/answer queries include only visible records and visible-answer counts.
- Existing per-user community and per-admin mutation limits are reused. Production multi-instance rate limiting still depends on owner-configured Redis; local fallback is not production evidence.

## Evidence review integrity

- The existing `/admin/enrichment` UI and queue are reused. Review requests carry the currently observed decision ID; stale decisions return a conflict and require reload. Typed-record decisions are serialized and audited. Approval still obeys the existing fixture, freshness, conflict, identity and source holds.
- No staged claim was approved during implementation. Synthetic review actions occur only in disposable tests.

## Data and migration

Migration `20261120100000_phase8_accounts_community` is additive. It adds account deactivation/timezone fields; nullable hashes and uniqueness guards for duplicate Q&A; paginated-queue indexes; and a report table with exactly-one-target check, unique reporter-target keys and foreign keys. Existing college, user, evidence, and audit identities are not rewritten by the migration. Account deactivation is an application operation and must not be run against production without explicit owner authorization.

Rollback procedure for an unreleased build: revert Phase 8 app code first and leave the additive schema in place. Dropping `CommunityReport` or the new account/content-hash columns would discard student reports and duplicate-protection semantics; only consider that after an owner-approved backup/retention review. Never roll back by replaying older application code against an unknown schema.

## Owner-side local dashboard check

To check the local admin moderation dashboard, sign in using an existing authorized local ADMIN account and open `/admin/community`. Do not promote an arbitrary user. `/admin/enrichment` continues using the existing ADMIN gate. This implementation does not provision accounts or change roles.

Manual assistive-technology testing, owner-side production configuration/backup evidence, email verification/recovery, genuine human evidence review and genuine cutoff/source coverage remain outstanding.

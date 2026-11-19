# Security

Report vulnerabilities privately to the repository owner. Avoid posting credentials, student records or reproduction details in public issues.

## Historical credential incident

Revision `9b159ec` was previously found to contain database and session-signing credentials. Owner evidence of revocation and rotation is **BLOCKED**. Removing a file or editing Git history does not revoke credentials. Do not retrieve or test the old values.

The owner should review provider audit logs for unauthorized activity, revoke the exposed database credential, roll all approved clients to a new least-privilege credential, and rotate the session signing secret in all affected environments. Record revocation and rotation timestamps, affected environments and verification outcomes without values. Confirm old database principals or password versions are disabled in provider metadata and signed-in users must obtain new sessions. Coordinate history cleanup separately if needed. Preserve incident records under restricted access.

## Application controls

| Area | Control |
| --- | --- |
| Authentication | NextAuth credentials with bcrypt and JWT sessions. Server authorization checks active account status and current role in PostgreSQL. |
| Session cookies | NextAuth secure cookies under canonical HTTPS. Confirm the deployed browser sees Secure, HttpOnly and SameSite=Lax on the session cookie. |
| Private data | Account, shortlist, comparison and planner routes enforce owner scope. Deactivation removes private rows and preserves anonymized audit relationships. |
| CSRF | Cookie-authenticated mutations check browser Origin against the configured production origin when supplied and reject cross-site fetch metadata. NextAuth uses its own CSRF token and SameSite cookies. |
| Validation | Shared JSON reader rejects unsupported media types and caps actual streamed bytes. Prisma parameterizes user inputs. |
| XSS | Community text is rendered as React text. Source links retain their existing URL validation. CSP restricts origins and allows Next.js inline bootstrap scripts. |
| Abuse | Sensitive production actions require a working distributed limiter. Public predictor reads may use bounded per-instance counters during a provider outage. |
| HTTP seeding | GET and production POST return 404. Local development POST defaults off and requires a bearer token. |
| Errors | Generic responses for unexpected failures include a request ID. Structured events omit driver messages, stacks, student data and provider payloads. |
| Audits | Evidence and moderation decisions write audit events. Synthetic review actions are isolated in test databases. |

## Incident response

Identify the affected deployment SHA and UTC time window. Preserve access-controlled event metadata and provider audit records. Use request IDs to correlate project logs without recording request bodies, cookies or environment values. If account or evidence changes may have been unauthorized, preserve the decision history and pause affected operations through the owner’s approved incident process. Evaluate credential revocation, session invalidation and reviewed-data corrections before reopening traffic. Use the [production release runbook](PRODUCTION_RELEASE.md) for readiness and rollback.

Email verification, recovery and identity changes depend on an approved mail provider and a secure token lifecycle. Manual assistive-technology review and production controls require separate evidence.

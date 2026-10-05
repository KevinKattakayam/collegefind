# Security

## Reporting

Report vulnerabilities privately to the repository owner. Please do not open a public issue.

## Immediate action required for this repository

A live PostgreSQL password and `NEXTAUTH_SECRET` were committed in `render-new.yaml`
(commit `9b159ec`). The file is deleted, but **git history still contains them**:

1. Rotate the database password in the Neon console.
2. Generate a new `NEXTAUTH_SECRET` (`openssl rand -hex 32`) — the old one can forge any session.
3. Purge the blob from history (`git filter-repo --path render-new.yaml --invert-paths`) and
   force-push, or treat the repository as permanently compromised for those credentials.

## Controls

| Area | Control |
| --- | --- |
| Authentication | NextAuth credentials, bcrypt cost 12, JWT sessions (7 days) |
| Timing attacks | Login compares against a dummy hash when the email is unknown |
| Authorisation | Ownership is part of the SQL `WHERE` clause, so another user's id matches nothing |
| Admin | `requireAdmin()` on moderation; role is carried in the JWT |
| CSRF | `assertSameOrigin()` on every mutation, plus SameSite=Lax cookies |
| Input validation | Zod on every body and query string; unknown fields rejected |
| Injection | Prisma parameterises all queries; ids are charset-restricted; no raw SQL on user input |
| XSS | User text is rendered as React text nodes. **Never** use `dangerouslySetInnerHTML` for user content |
| Rate limiting | Register, login (IP and IP+email), questions, answers, saves, predictor, seed |
| Headers | CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, referrer and permissions policies |
| Transport | Database TLS certificates verified |
| Secrets | Validated at runtime (`src/lib/env.ts`); CI fails on credential-shaped strings |
| Errors | Generic client messages with a `requestId`; details only in server logs |
| Audit | Moderation and seeding write `AuditLog` rows |

## Notes and residual risk

- **Rate limiting is per-instance without Redis.** On Vercel each serverless instance keeps its
  own counters, so configure `UPSTASH_REDIS_REST_URL`/`_TOKEN` in production.
- **Role changes need re-login.** Role lives in the JWT, so promoting or demoting a user takes
  effect at their next sign-in. Switch to a database session check if immediate revocation matters.
- **User enumeration is reduced, not eliminated.** Because registration signs the user in
  immediately, a determined attacker can still infer existence. Email verification (roadmap)
  is the real fix.
- **CSP allows `'unsafe-inline'` for scripts,** which Next's bootstrap requires. Tightening this
  needs nonce plumbing through middleware.
- **No account lockout or MFA.** Rate limiting only slows credential stuffing.
- **`x-forwarded-for` is trusted** for client IPs. Correct on Vercel; behind another proxy make
  sure it overwrites rather than appends the header.

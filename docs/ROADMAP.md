# Roadmap

Ordered by risk reduction, then user value, then showpiece value.

## Do today (under an hour)

1. **Rotate the leaked Neon password and `NEXTAUTH_SECRET`** (see `docs/SECURITY.md`). Nothing
   else matters until this is done.
2. Purge `render-new.yaml` from git history and force-push.
3. Deploy this branch so the public destructive seed endpoint disappears.
4. Set `NEXT_PUBLIC_SITE_URL`, `NEXTAUTH_URL` and `DIRECT_URL` in Vercel; delete the Render service.
5. Add `UPSTASH_REDIS_REST_URL`/`_TOKEN` so rate limits work across instances.

## Days 1–30 — truthful and safe

- Import **one** real dataset end to end: JoSAA for the latest year, all rounds, with a mapping
  file. This unlocks the estimator.
- Verify the top ~50 colleges' fees from official pages; set `dataStatus = VERIFIED`.
- Backtest the predictor against a held-out year and publish the coverage number.
- Email verification and password reset (Resend or Amazon SES).
- Daily automated database backup with a **restore drill**, not just a dump.
- Error tracking (Sentry) and an uptime check on `/api/health`.

## Days 31–60 — trustworthy

- MCC/NEET import, and NIRF rankings to make `/rankings` real.
- Admin panel: edit colleges, review the moderation queue, inspect `AuditLog`.
- Verified reviews: identity check, moderation queue, then compute `College.rating`.
- Privacy policy, terms, and DPDP Act basics: consent at signup, data export, account deletion.
- Accessibility pass with axe; fix contrast and keyboard traps.
- Tamil and Hindi for the highest-traffic pages (next-intl).

## Days 61–90 — distinctive

- **Choice-list builder**: order JoSAA preferences and see the probability of each outcome.
- **Total cost of attendance**: fees plus hostel and travel, with an education-loan EMI view.
- **Cutoff trend charts** per branch, straight from `CutoffRecord`.
- Scholarship matching against National Scholarship Portal eligibility rules.
- Low-bandwidth mode and offline-capable shortlists.

## Worth doing vs overkill (for a student project)

| Item | Verdict |
| --- | --- |
| Email verification, password reset, backups, monitoring, CI | **Worth doing** — expected of anything real |
| Admin panel, moderation, audit log | **Worth doing** — already partly built |
| DPDP basics (consent, deletion, policy) | **Worth doing** — legally required if real users sign up |
| Verified reviews | **Worth doing**, but only with moderation capacity |
| OAuth login | Worth doing; low effort, removes password handling |
| Internationalisation | Worth doing for the target audience; start with two languages |
| Kubernetes, microservices, event sourcing, a separate API gateway | **Overkill** |
| Custom ML ranking model | **Overkill** until there is enough real data to validate it |
| Real-time seat-availability scraping during counselling | **Avoid** — brittle, legally risky, and wrong data here is harmful |

## Deliberately not shipped

- **Review submission UI** — publishing reviews without identity checks invites exactly the fake
  reviews this project criticises competitors for.
- **AI counselling chat** — only worth building grounded in verified data with citations, which
  requires the data work above first.
- **Any college data we cannot source.** The catalogue stays small and honest rather than large
  and invented.

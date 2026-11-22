# CollegeFind V3 upgrade status and evidence

Status refreshed: 2026-11-21. The current local content-readiness workstream is on `verified-content-release-readiness`, based on Phase 9 checkpoint `44a2a2a`. The 205 original college identities and evidence history remain intact. Baseline repository evidence is 377 STAGED claims, zero genuine approvals and zero verified official cutoffs. Phase 9 owner-controlled production gates remain open. Batch 028 added research-only source candidates without changing staged evidence counts; see the latest section at the end.

Phase 8 checklist is below. Account, community, moderation and evidence-review changes are recorded in the Phase 8 entry at the end. No real college records or evidence decisions were changed.

## Carried-forward engineering evidence (not rerun)

| Check | Outcome and limits |
| --- | --- |
| Lint | PASS: `npm run lint`, zero warnings, Phase 1 |
| Typecheck | PASS: `./node_modules/.bin/tsc --noEmit --incremental false`, Phase 1 |
| Unit | PASS: `npm test -- --no-file-parallelism`, 41 executed cases / three files; parameterized cases explain difference from textual it() count |
| Dependencies/lock | PASS limited consistency: root dependency/devDependency/engine declarations match lock; npm ls top-level satisfied, @emnapi/runtime and @img/sharp-wasm32 extraneous; clean install not done |
| Vulnerability audit | BLOCKED: `npm audit --omit=dev --audit-level=critical --cache /tmp/collegefind-audit-npm-cache --fetch-retries=0` failed EAI_AGAIN registry.npmjs.org; no current clean bill |
| Build | BLOCKED in isolated /tmp source/dependency copy with dummy local credentials: Next/Turbopack CSS subprocess bind returned Operation not permitted; no production DB accessed. Initial symlink attempt failed root boundary; hardlink attempt failed cross-device; normal copy reached sandbox bind failure |
| Integration | NOT RUN locally: no verified disposable DB; resetDb truncates all tables |
| E2E | NOT RUN locally: no verified seeded disposable DB or successful server/build; CI omits Playwright |
| Migration drift | NOT RUN locally: no disposable PostgreSQL/shadow DB; two tracked migrations inspected; historical CI drift gate passed |
| Deployment | UNVERIFIED: configured homepage https://college-discovery-zeta.vercel.app; web opens for /, /api/health, /api/stats failed; curl DNS failed; no observed production response status |

CI evidence: [run 37380414947](https://github.com/KevinKattakayam/collegefind/actions/runs/37380414947), exact audited SHA, 2026-10-05: verify, secret-scan and audit jobs success; verify included npm ci, Prisma format/schema drift, lint/typecheck, unit/integration/build. Later Dependabot success is not application CI. Current-main pointer rechecked in this documentation step: unchanged, so known CI checks were not repeated. Branch response previously reported unprotected main; no protection changes made.

Current workflow lacks E2E and coverage gates; audit uses continue-on-error and critical-only production advisory threshold. Secret scan searches current tree patterns, not historical blobs despite full checkout. Historical credential pattern and NEXTAUTH_SECRET reference in 9b159ec:render-new.yaml were confirmed without exposing/testing values; owner-side rotation, revocation and audit review remain UNVERIFIED (docs/SECURITY.md:9). No credential or production operation was performed.

Local .env exists with credential entries; values withheld and unused. Shell DB/auth/site variables were unset at Phase 1 check. NEXTAUTH_URL in local .env is localhost. getEnv has no callers (src/lib/env.ts:32); runtime Prisma reads process.env directly. Do not equate local .env presence with a safe test target.

## New gap investigation and reconciliation

- Workspace now has untracked CollegeFind_AGENTS_V3.md; earlier CollegeFind_AGENTS.md is absent. Treat this as pre-existing user state; preserve the V3 file. Its 19 standards are incorporated into AGENTS.md along with stronger earlier field-proof and approval rules.
- Individual seed examination: 205 unique names/slugs/shortNames, 145 GOVERNMENT and 60 PRIVATE records, 32 distinct state/UT labels. No duplicate in these three keys; this does not verify institutional identity or rule out real-world aliases/campuses.
- Each record has identity, established year, students, NAAC, fees, placement/package metrics, recruiters and courses. Every record lacks descriptions, contacts/official links, metric year, admissions records, scholarships and facilities. No individual claim became verified during this step.
- Integration setup validates TEST_DATABASE_URL inside beforeAll, but suites instantiate testDb at module scope and db.ts falls back to DATABASE_URL. A hook is too late to guarantee target validation before client construction. This is the first Phase 2 safety task (tests/integration/setup.ts:7; db.ts:7; josaa-ingest.test.ts:12).
- Integration source contains 39 textual test cases (22 security, 10 predictor, 7 ingest); these are not newly executed passes. Security tests mock getServerSession (api-security.test.ts:18), leaving real auth/cookie E2E unproved.
- Prisma declarations are caret ranges, contrary to docs/AUDIT.md's historical exact-pin assertion. Lock resolutions were previously consistent; no install or dependency change made.
- The explicit test target guard now runs at integration setup module evaluation (before suites instantiate module-scope clients), again at client access and before reset. The test client no longer falls back to DATABASE_URL. Confirmation flag does not prove disposability; an operator must confirm the isolated database.
- Vitest coverage includes lib/server/API, excludes page/component behavior and has no thresholds. Numerical coverage is NOT MEASURED: the configured mixed suite requires a safe DB, and no repeated unit-only coverage was run just to restate known unit results.

## Evidence-backed defect register

| ID / priority | Evidence | Disposition / phase |
| --- | --- | --- |
| S1 P0 | docs/SECURITY.md:9; historical manifest credential pattern | Rotation/revocation evidence absent; release blocked; P2/P9 |
| S2 P0 | tests/integration/db.ts:9,19; setup.ts:7 | Unsafe fallback and module initialization before hook; P2 first task |
| S3 P0 | No real deployment/restore evidence | Owner-side health, deployed SHA and restore drill pending; P9 |
| D1 P1 | src/server/seed/demo.ts:4; full ledger below | Demo summaries feed filters/decision paths; isolate and replace only with reviewed evidence; P2/P3 |
| D2 P1 | prisma/schema.prisma:151 | Source lacks per-field reviewer/validity/artifact trail; College status too coarse; P2 |
| D3 P1 | src/server/ingest/josaa.ts:221,229,252 | New Source per run, existing college update empty, institute-scoped transaction only; preserve stale demo metrics/status, partial imports; P2/P3 |
| C1 P1 | src/app/compare/page.tsx:74; context/CompareContext.tsx:17 | Share copies current URL, no selections; stale object persistence; P5 |
| C2 P1 | src/app/saved/page.tsx:102 | Saved compare opens plain /compare; no restoration; P5 |
| C3 P1 | src/components/RadarChart.tsx:96,119 | null→0 then inverted fees→best; P5 |
| C4 P1 | src/app/compare/page.tsx:38,144,155 | Two known out of three can win; null star/% display; P5 |
| H1 P1 | CutoffHistory.tsx:33; detail page:36; cutoffs API:16,32 | 60 displayed; 1000/2000 raw caps before dedup, excludes PwD; P4 |
| R1 P2 | src/app/api/colleges/similar/[id]/route.ts:8; detail page:59 | Alphabetical same-state/type; API fee fallback over unordered 50; duplicate recommendation logic; P5/P6 |
| P1 P1 | src/lib/predictor/service.ts:189,201,232,307 | Stale target year, unordered 1000 candidates, uncalibrated percentages; demo budget inputs; P6 |
| A1 P1 | src/lib/session.ts:22; auth.ts:52 | JWT role not immediately revoked; seven-day sessions; P8 |
| A2 P2 | src/app/login/page.tsx:54; schema Review:326 | Dead recovery span, no verification/account/admin/reviewer/review publication workflow; P8 |
| E1 P1 | src/lib/env.ts:32; Prisma/rate-limit direct env reads | Validator unused; production distributed limiter/config not established; P2/P9 |
| E2 P1 | src/app/colleges/page.tsx:103; rankings/page.tsx catch | Operational errors masquerade as no matches/not imported; P4/P5 |
| O1 P1 | scripts/vercel-build.mjs:7 | Production migration before build success; separate execution needed; P9 |
| T1 P2 | .github/workflows/ci.yml:79,115; vitest.config.mts | Missing E2E/coverage gate, advisory audit, limited secrets patterns; P9 |

## Catalogue completeness definitions

This is an individually computed repository-data report, not official-source verification or a production DB audit. Source: src/server/seed/demo-colleges.json at audited SHA; each row below is generated from that specific record, preserving file order and JSON line evidence. No source URL was guessed.

Codes: **U** = present identity label, unverified against official evidence; **D** = populated prototype/demo claim, not usable as fact; **M** = missing; **V** = verified against official evidence with review trail. V count is zero. Source-backed-but-unreviewed is a distinct future state, not assigned when no source exists.

Identity column records slug/name/location/type; established year/student count remain demo claims in the source file. Courses lists the actual record array (D), not accredited programme verification. Admissions M means no institution/programme eligibility/process/seat/cutoff evidence bundled; generic exam pages do not populate that domain. Placement is percentage/average/highest in prototype percent/LPA units, all D, with no cohort/year. Accreditation is recorded NAAC label D with no validity. Facilities M: student counts do not establish facilities. Scholarships M: no scheme/eligibility/cost benefit evidence. Official links M covers website/phone/email, all absent. Fees have no academic year. Every row's external research disposition is **PENDING**, not blocked-source research already performed.

## Aggregate baseline

| Domain | Present unverified/demo | Missing | Verified |
| --- | --- | --- | --- |
| Identity labels | 205 U | 0 | 0 |
| Descriptions (description/about) | 0 | 205 | 0 |
| Courses | 205 D | 0 | 0 |
| Admissions | 0 | 205 | 0 |
| Fees | 205 D | 0 | 0 |
| Placements | 205 D | 0 | 0 |
| Scholarships | 0 | 205 | 0 |
| Facilities | 0 | 205 | 0 |
| Accreditation | 205 D | 0 | 0 |
| Official links/contact | 0 | 205 | 0 |

205/205 repository records assessed; **0/205 official enrichment attempts completed**; 0 verified profiles established. Populated metrics and names do not constitute factual accuracy. Academic years are missing for all 205 metric summaries.

## Individual 205-college ledger

Columns: I=identity, Desc=description/about, C=courses, A=admissions, F=fees INR/year, P=placement % / average / highest LPA, S=scholarships, Fac=facilities, Acc=accreditation, L=official links/contact. G=GOVERNMENT; P=PRIVATE. Numbers below are reported legacy demo inputs, not endorsed facts.

| # / JSON line | College / slug | I: location; type | Desc | C | A | F | P | S | Fac | Acc | L |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 / 3 | Indian Institute of Technology Bombay (`indian-institute-of-technology-bombay`) | U: Mumbai, Maharashtra; G | M | D: B.Tech, M.Tech, PhD | M | D: 250000 | D: 95/16.5/80 | M | M | D: A++ | M |
| 2 / 29 | Indian Institute of Technology Delhi (`indian-institute-of-technology-delhi`) | U: New Delhi, Delhi; G | M | D: B.Tech, M.Tech, MBA, PhD | M | D: 240000 | D: 94/15.8/75 | M | M | D: A++ | M |
| 3 / 56 | Indian Institute of Technology Madras (`indian-institute-of-technology-madras`) | U: Chennai, Tamil Nadu; G | M | D: B.Tech, M.Tech, MS, PhD | M | D: 230000 | D: 93/14.5/70 | M | M | D: A++ | M |
| 4 / 83 | Indian Institute of Technology Kanpur (`indian-institute-of-technology-kanpur`) | U: Kanpur, Uttar Pradesh; G | M | D: B.Tech, M.Tech, PhD | M | D: 225000 | D: 91/13.2/65 | M | M | D: A++ | M |
| 5 / 109 | Indian Institute of Technology Kharagpur (`indian-institute-of-technology-kharagpur`) | U: Kharagpur, West Bengal; G | M | D: B.Tech, M.Tech, MBA, PhD | M | D: 220000 | D: 90/12.8/60 | M | M | D: A++ | M |
| 6 / 136 | Indian Institute of Technology Roorkee (`indian-institute-of-technology-roorkee`) | U: Roorkee, Uttarakhand; G | M | D: B.Tech, M.Tech, PhD | M | D: 215000 | D: 89/12/55 | M | M | D: A++ | M |
| 7 / 162 | Indian Institute of Technology Guwahati (`indian-institute-of-technology-guwahati`) | U: Guwahati, Assam; G | M | D: B.Tech, M.Tech, PhD | M | D: 210000 | D: 88/11.5/50 | M | M | D: A+ | M |
| 8 / 188 | Indian Institute of Technology Hyderabad (`indian-institute-of-technology-hyderabad`) | U: Hyderabad, Telangana; G | M | D: B.Tech, M.Tech, PhD | M | D: 220000 | D: 87/11/48 | M | M | D: A++ | M |
| 9 / 214 | National Institute of Technology Tiruchirappalli (`national-institute-of-technology-tiruchirappalli`) | U: Tiruchirappalli, Tamil Nadu; G | M | D: B.Tech, M.Tech, PhD | M | D: 175000 | D: 88/9.5/42 | M | M | D: A+ | M |
| 10 / 240 | National Institute of Technology Karnataka (`national-institute-of-technology-karnataka`) | U: Surathkal, Karnataka; G | M | D: B.Tech, M.Tech | M | D: 170000 | D: 86/9/38 | M | M | D: A+ | M |
| 11 / 265 | National Institute of Technology Warangal (`national-institute-of-technology-warangal`) | U: Warangal, Telangana; G | M | D: B.Tech, M.Tech, PhD | M | D: 165000 | D: 85/8.8/36 | M | M | D: A+ | M |
| 12 / 291 | National Institute of Technology Calicut (`national-institute-of-technology-calicut`) | U: Kozhikode, Kerala; G | M | D: B.Tech, M.Tech | M | D: 160000 | D: 83/8.2/32 | M | M | D: A | M |
| 13 / 316 | Motilal Nehru National Institute of Technology (`motilal-nehru-national-institute-of-technology`) | U: Prayagraj, Uttar Pradesh; G | M | D: B.Tech, M.Tech | M | D: 155000 | D: 82/7.8/30 | M | M | D: A | M |
| 14 / 341 | Malaviya National Institute of Technology (`malaviya-national-institute-of-technology`) | U: Jaipur, Rajasthan; G | M | D: B.Tech, M.Tech | M | D: 158000 | D: 81/7.5/28 | M | M | D: A | M |
| 15 / 366 | Indian Institute of Management Ahmedabad (`indian-institute-of-management-ahmedabad`) | U: Ahmedabad, Gujarat; G | M | D: MBA, PhD | M | D: 2300000 | D: 99/28/120 | M | M | D: A++ | M |
| 16 / 391 | Indian Institute of Management Bangalore (`indian-institute-of-management-bangalore`) | U: Bangalore, Karnataka; G | M | D: MBA, PhD | M | D: 2350000 | D: 98/27.5/110 | M | M | D: A++ | M |
| 17 / 416 | Indian Institute of Management Calcutta (`indian-institute-of-management-calcutta`) | U: Kolkata, West Bengal; G | M | D: MBA, PhD | M | D: 2200000 | D: 97/26/100 | M | M | D: A++ | M |
| 18 / 441 | Indian Institute of Management Lucknow (`indian-institute-of-management-lucknow`) | U: Lucknow, Uttar Pradesh; G | M | D: MBA, PhD | M | D: 1950000 | D: 96/24/90 | M | M | D: A+ | M |
| 19 / 466 | Vellore Institute of Technology (`vellore-institute-of-technology`) | U: Vellore, Tamil Nadu; P | M | D: B.Tech, M.Tech, MBA | M | D: 195000 | D: 80/7/42 | M | M | D: A++ | M |
| 20 / 492 | SRM Institute of Science and Technology (`srm-institute-of-science-and-technology`) | U: Chennai, Tamil Nadu; P | M | D: B.Tech, M.Tech, MBA, MBBS | M | D: 250000 | D: 78/6.5/35 | M | M | D: A++ | M |
| 21 / 519 | Manipal Institute of Technology (`manipal-institute-of-technology`) | U: Manipal, Karnataka; P | M | D: B.Tech, M.Tech | M | D: 400000 | D: 82/7.5/38 | M | M | D: A++ | M |
| 22 / 544 | BITS Pilani (`bits-pilani`) | U: Pilani, Rajasthan; P | M | D: B.E, M.E, PhD | M | D: 380000 | D: 90/11/55 | M | M | D: A | M |
| 23 / 570 | Amity University (`amity-university`) | U: Noida, Uttar Pradesh; P | M | D: B.Tech, MBA, BBA, LLB | M | D: 300000 | D: 65/5/20 | M | M | D: A+ | M |
| 24 / 597 | Lovely Professional University (`lovely-professional-university`) | U: Jalandhar, Punjab; P | M | D: B.Tech, MBA, BBA, B.Sc | M | D: 180000 | D: 60/4.5/18 | M | M | D: A+ | M |
| 25 / 624 | Indian School of Business (`indian-school-of-business`) | U: Hyderabad, Telangana; P | M | D: MBA | M | D: 3500000 | D: 98/28/100 | M | M | D: A++ | M |
| 26 / 648 | XLRI Jamshedpur (`xlri-jamshedpur`) | U: Jamshedpur, Jharkhand; P | M | D: MBA | M | D: 2500000 | D: 95/24/80 | M | M | D: A+ | M |
| 27 / 672 | Management Development Institute (`management-development-institute`) | U: Gurgaon, Haryana; P | M | D: MBA | M | D: 2000000 | D: 92/20/60 | M | M | D: A | M |
| 28 / 696 | MICA Ahmedabad (`mica-ahmedabad`) | U: Ahmedabad, Gujarat; P | M | D: MBA | M | D: 1800000 | D: 90/18/50 | M | M | D: A | M |
| 29 / 720 | Anna University (`anna-university`) | U: Chennai, Tamil Nadu; G | M | D: B.Tech, M.Tech, MBA, PhD | M | D: 50000 | D: 75/5.5/25 | M | M | D: A+ | M |
| 30 / 747 | University of Mumbai (`university-of-mumbai`) | U: Mumbai, Maharashtra; G | M | D: B.Sc, M.Sc, MBA, LLB | M | D: 35000 | D: 70/5/22 | M | M | D: A+ | M |
| 31 / 774 | University of Delhi (`university-of-delhi`) | U: New Delhi, Delhi; G | M | D: B.A, B.Com, B.Sc, MBA, LLB | M | D: 25000 | D: 72/5.2/20 | M | M | D: A+ | M |
| 32 / 802 | Savitribai Phule Pune University (`savitribai-phule-pune-university`) | U: Pune, Maharashtra; G | M | D: B.Tech, B.Sc, MBA, LLB | M | D: 40000 | D: 68/4.8/18 | M | M | D: A+ | M |
| 33 / 829 | Jadavpur University (`jadavpur-university`) | U: Kolkata, West Bengal; G | M | D: B.Tech, M.Tech, B.Sc, PhD | M | D: 30000 | D: 78/6.5/28 | M | M | D: A | M |
| 34 / 856 | Osmania University (`osmania-university`) | U: Hyderabad, Telangana; G | M | D: B.Tech, B.Sc, MBA, LLB | M | D: 28000 | D: 65/4.5/15 | M | M | D: A | M |
| 35 / 883 | Birla Institute of Technology Mesra (`birla-institute-of-technology-mesra`) | U: Ranchi, Jharkhand; P | M | D: B.Tech, M.Tech, MBA | M | D: 250000 | D: 80/7/30 | M | M | D: A | M |
| 36 / 909 | Thapar Institute of Engineering (`thapar-institute-of-engineering`) | U: Patiala, Punjab; P | M | D: B.Tech, M.Tech, MBA | M | D: 320000 | D: 82/7.5/32 | M | M | D: A | M |
| 37 / 935 | PSG College of Technology (`psg-college-of-technology`) | U: Coimbatore, Tamil Nadu; P | M | D: B.Tech, M.Tech | M | D: 120000 | D: 85/6.8/28 | M | M | D: A+ | M |
| 38 / 960 | Symbiosis International University (`symbiosis-international-university`) | U: Pune, Maharashtra; P | M | D: BBA, MBA, LLB, B.Sc | M | D: 350000 | D: 78/8.5/35 | M | M | D: A+ | M |
| 39 / 987 | KIIT University (`kiit-university`) | U: Bhubaneswar, Odisha; P | M | D: B.Tech, MBA, BBA, LLB | M | D: 250000 | D: 75/6/25 | M | M | D: A++ | M |
| 40 / 1014 | Shiv Nadar University (`shiv-nadar-university`) | U: Greater Noida, Uttar Pradesh; P | M | D: B.Tech, B.Sc, MBA | M | D: 450000 | D: 80/8/35 | M | M | D: A | M |
| 41 / 1040 | Chandigarh University (`chandigarh-university`) | U: Mohali, Punjab; P | M | D: B.Tech, MBA, BBA, B.Sc | M | D: 200000 | D: 72/5.5/22 | M | M | D: A+ | M |
| 42 / 1067 | All India Institute of Medical Sciences (`all-india-institute-of-medical-sciences`) | U: New Delhi, Delhi; G | M | D: MBBS, MD, MS, PhD | M | D: 8000 | D: 98/12/25 | M | M | D: A++ | M |
| 43 / 1094 | Christian Medical College (`christian-medical-college`) | U: Vellore, Tamil Nadu; G | M | D: MBBS, MD, MS | M | D: 30000 | D: 96/10/20 | M | M | D: A++ | M |
| 44 / 1119 | Armed Forces Medical College (`armed-forces-medical-college`) | U: Pune, Maharashtra; G | M | D: MBBS, MD | M | D: 50000 | D: 95/10/20 | M | M | D: A+ | M |
| 45 / 1143 | Kasturba Medical College (`kasturba-medical-college`) | U: Manipal, Karnataka; P | M | D: MBBS, MD, MS | M | D: 900000 | D: 90/8/18 | M | M | D: A+ | M |
| 46 / 1168 | Maulana Azad Medical College (`maulana-azad-medical-college`) | U: New Delhi, Delhi; G | M | D: MBBS, MD, MS | M | D: 15000 | D: 94/10/20 | M | M | D: A+ | M |
| 47 / 1193 | St Johns Medical College (`st-johns-medical-college`) | U: Bangalore, Karnataka; P | M | D: MBBS, MD | M | D: 650000 | D: 88/7.5/15 | M | M | D: A | M |
| 48 / 1217 | National Law School of India University (`national-law-school-of-india-university`) | U: Bangalore, Karnataka; G | M | D: LLB, LLM | M | D: 250000 | D: 95/15/45 | M | M | D: A++ | M |
| 49 / 1242 | Symbiosis Law School (`symbiosis-law-school`) | U: Pune, Maharashtra; P | M | D: LLB, LLM | M | D: 350000 | D: 82/8/25 | M | M | D: A+ | M |
| 50 / 1267 | Shri Ram College of Commerce (`shri-ram-college-of-commerce`) | U: New Delhi, Delhi; G | M | D: B.Com, M.Com | M | D: 20000 | D: 88/10/35 | M | M | D: A++ | M |
| 51 / 1292 | Loyola College (`loyola-college`) | U: Chennai, Tamil Nadu; P | M | D: B.A, B.Sc, B.Com, MBA | M | D: 35000 | D: 75/5/18 | M | M | D: A++ | M |
| 52 / 1319 | St Xaviers College (`st-xaviers-college`) | U: Mumbai, Maharashtra; P | M | D: B.A, B.Sc, B.Com, MBA | M | D: 30000 | D: 78/5.5/20 | M | M | D: A++ | M |
| 53 / 1346 | Fergusson College (`fergusson-college`) | U: Pune, Maharashtra; G | M | D: B.A, B.Sc, M.Sc | M | D: 15000 | D: 65/4/12 | M | M | D: A | M |
| 54 / 1372 | Bennett University (`bennett-university`) | U: Greater Noida, Uttar Pradesh; P | M | D: B.Tech, BBA, MBA | M | D: 350000 | D: 70/5.5/20 | M | M | D: B++ | M |
| 55 / 1398 | Ashoka University (`ashoka-university`) | U: Sonipat, Haryana; P | M | D: B.A, B.Sc, M.A, PhD | M | D: 500000 | D: 75/7/25 | M | M | D: A | M |
| 56 / 1425 | Plaksha University (`plaksha-university`) | U: Mohali, Punjab; P | M | D: B.Tech | M | D: 600000 | D: 72/8/30 | M | M | D: B+ | M |
| 57 / 1449 | Flame University (`flame-university`) | U: Pune, Maharashtra; P | M | D: BBA, MBA, B.A | M | D: 400000 | D: 68/5/18 | M | M | D: A | M |
| 58 / 1475 | Woxsen University (`woxsen-university`) | U: Hyderabad, Telangana; P | M | D: BBA, MBA, B.Tech | M | D: 450000 | D: 70/6/22 | M | M | D: A | M |
| 59 / 1501 | Sai University (`sai-university`) | U: Chennai, Tamil Nadu; P | M | D: B.Tech, B.Sc | M | D: 300000 | D: 60/4.5/15 | M | M | D: B++ | M |
| 60 / 1526 | IIT BHU Varanasi (`iit-bhu-varanasi`) | U: Varanasi, Uttar Pradesh; G | M | D: B.Tech, M.Tech, PhD | M | D: 220000 | D: 91/12.5/58 | M | M | D: A++ | M |
| 61 / 1552 | IIT Indore (`iit-indore`) | U: Indore, Madhya Pradesh; G | M | D: B.Tech, M.Tech, PhD | M | D: 210000 | D: 86/10.5/45 | M | M | D: A+ | M |
| 62 / 1578 | IIT Tirupati (`iit-tirupati`) | U: Tirupati, Andhra Pradesh; G | M | D: B.Tech, M.Tech | M | D: 200000 | D: 80/9/38 | M | M | D: A | M |
| 63 / 1603 | IIT Palakkad (`iit-palakkad`) | U: Palakkad, Kerala; G | M | D: B.Tech, M.Tech | M | D: 195000 | D: 78/8.5/35 | M | M | D: A | M |
| 64 / 1628 | IIT Dharwad (`iit-dharwad`) | U: Dharwad, Karnataka; G | M | D: B.Tech, M.Tech | M | D: 190000 | D: 75/8/32 | M | M | D: B++ | M |
| 65 / 1653 | IIT Bhilai (`iit-bhilai`) | U: Bhilai, Chhattisgarh; G | M | D: B.Tech, M.Tech | M | D: 185000 | D: 74/7.8/30 | M | M | D: B++ | M |
| 66 / 1678 | IIT Jammu (`iit-jammu`) | U: Jammu, Jammu & Kashmir; G | M | D: B.Tech, M.Tech | M | D: 180000 | D: 72/7.5/28 | M | M | D: B+ | M |
| 67 / 1703 | NIT Rourkela (`nit-rourkela`) | U: Rourkela, Odisha; G | M | D: B.Tech, M.Tech, PhD | M | D: 170000 | D: 85/8.5/35 | M | M | D: A+ | M |
| 68 / 1729 | NIT Durgapur (`nit-durgapur`) | U: Durgapur, West Bengal; G | M | D: B.Tech, M.Tech | M | D: 160000 | D: 82/7.8/30 | M | M | D: A | M |
| 69 / 1754 | NIT Silchar (`nit-silchar`) | U: Silchar, Assam; G | M | D: B.Tech, M.Tech | M | D: 145000 | D: 78/7/26 | M | M | D: A | M |
| 70 / 1779 | NIT Hamirpur (`nit-hamirpur`) | U: Hamirpur, Himachal Pradesh; G | M | D: B.Tech, M.Tech | M | D: 140000 | D: 76/6.5/24 | M | M | D: A | M |
| 71 / 1804 | NIT Agartala (`nit-agartala`) | U: Agartala, Tripura; G | M | D: B.Tech, M.Tech | M | D: 130000 | D: 70/5.8/20 | M | M | D: B++ | M |
| 72 / 1829 | NIT Meghalaya (`nit-meghalaya`) | U: Shillong, Meghalaya; G | M | D: B.Tech | M | D: 120000 | D: 65/5/18 | M | M | D: B+ | M |
| 73 / 1852 | IIIT Hyderabad (`iiit-hyderabad`) | U: Hyderabad, Telangana; G | M | D: B.Tech, M.Tech, PhD | M | D: 300000 | D: 92/14/65 | M | M | D: A++ | M |
| 74 / 1878 | IIIT Bangalore (`iiit-bangalore`) | U: Bangalore, Karnataka; G | M | D: B.Tech, M.Tech | M | D: 350000 | D: 90/13/55 | M | M | D: A+ | M |
| 75 / 1903 | IIIT Allahabad (`iiit-allahabad`) | U: Prayagraj, Uttar Pradesh; G | M | D: B.Tech, M.Tech | M | D: 180000 | D: 85/9/40 | M | M | D: A | M |
| 76 / 1928 | IIIT Delhi (`iiit-delhi`) | U: New Delhi, Delhi; G | M | D: B.Tech, M.Tech, PhD | M | D: 310000 | D: 91/13.5/60 | M | M | D: A+ | M |
| 77 / 1954 | Delhi Technological University (`delhi-technological-university`) | U: New Delhi, Delhi; G | M | D: B.Tech, M.Tech, MBA | M | D: 165000 | D: 87/9.5/42 | M | M | D: A+ | M |
| 78 / 1980 | Netaji Subhas University of Technology (`netaji-subhas-university-of-technology`) | U: New Delhi, Delhi; G | M | D: B.Tech, M.Tech | M | D: 160000 | D: 86/9/40 | M | M | D: A+ | M |
| 79 / 2005 | PEC Chandigarh (`pec-chandigarh`) | U: Chandigarh, Chandigarh; G | M | D: B.Tech, M.Tech | M | D: 120000 | D: 82/7.5/30 | M | M | D: A | M |
| 80 / 2030 | IIM Indore (`iim-indore`) | U: Indore, Madhya Pradesh; G | M | D: MBA, PhD | M | D: 2000000 | D: 96/23/85 | M | M | D: A+ | M |
| 81 / 2055 | IIM Kozhikode (`iim-kozhikode`) | U: Kozhikode, Kerala; G | M | D: MBA, PhD | M | D: 1950000 | D: 95/22/80 | M | M | D: A+ | M |
| 82 / 2080 | IIM Shillong (`iim-shillong`) | U: Shillong, Meghalaya; G | M | D: MBA | M | D: 1500000 | D: 90/16/50 | M | M | D: A | M |
| 83 / 2104 | IIM Ranchi (`iim-ranchi`) | U: Ranchi, Jharkhand; G | M | D: MBA | M | D: 1600000 | D: 91/17/55 | M | M | D: A | M |
| 84 / 2128 | FMS Delhi (`fms-delhi`) | U: New Delhi, Delhi; G | M | D: MBA | M | D: 25000 | D: 96/25/90 | M | M | D: A++ | M |
| 85 / 2152 | JIPMER Puducherry (`jipmer-puducherry`) | U: Puducherry, Puducherry; G | M | D: MBBS, MD, MS, PhD | M | D: 12000 | D: 96/10/22 | M | M | D: A++ | M |
| 86 / 2178 | King Georges Medical University (`king-georges-medical-university`) | U: Lucknow, Uttar Pradesh; G | M | D: MBBS, MD, MS | M | D: 25000 | D: 92/9/18 | M | M | D: A+ | M |
| 87 / 2203 | Grant Medical College (`grant-medical-college`) | U: Mumbai, Maharashtra; G | M | D: MBBS, MD | M | D: 20000 | D: 90/8.5/16 | M | M | D: A+ | M |
| 88 / 2227 | BJ Medical College (`bj-medical-college`) | U: Ahmedabad, Gujarat; G | M | D: MBBS, MD, MS | M | D: 22000 | D: 89/8/16 | M | M | D: A | M |
| 89 / 2252 | Manipal Academy of Higher Education (`manipal-academy-of-higher-education`) | U: Manipal, Karnataka; P | M | D: B.Tech, MBBS, MBA, BBA | M | D: 500000 | D: 85/8.5/40 | M | M | D: A++ | M |
| 90 / 2279 | Amrita Vishwa Vidyapeetham (`amrita-vishwa-vidyapeetham`) | U: Coimbatore, Tamil Nadu; P | M | D: B.Tech, M.Tech, MBBS, MBA | M | D: 250000 | D: 80/7/30 | M | M | D: A++ | M |
| 91 / 2306 | Jamia Millia Islamia (`jamia-millia-islamia`) | U: New Delhi, Delhi; G | M | D: B.Tech, B.A, MBA, LLB, B.Com | M | D: 35000 | D: 75/5.5/22 | M | M | D: A++ | M |
| 92 / 2334 | Banaras Hindu University (`banaras-hindu-university`) | U: Varanasi, Uttar Pradesh; G | M | D: B.Tech, MBBS, B.A, B.Sc, MBA, LLB, PhD | M | D: 15000 | D: 78/5.8/24 | M | M | D: A++ | M |
| 93 / 2364 | Aligarh Muslim University (`aligarh-muslim-university`) | U: Aligarh, Uttar Pradesh; G | M | D: B.Tech, MBBS, B.A, B.Sc, MBA, LLB | M | D: 12000 | D: 72/4.8/18 | M | M | D: A | M |
| 94 / 2393 | Presidency University (`presidency-university`) | U: Kolkata, West Bengal; G | M | D: B.A, B.Sc, M.A, M.Sc, PhD | M | D: 8000 | D: 70/4.5/15 | M | M | D: A+ | M |
| 95 / 2421 | Christ University (`christ-university`) | U: Bangalore, Karnataka; P | M | D: BBA, MBA, B.Com, B.A, B.Sc, LLB | M | D: 200000 | D: 78/6/25 | M | M | D: A++ | M |
| 96 / 2451 | NMIMS Mumbai (`nmims-mumbai`) | U: Mumbai, Maharashtra; P | M | D: MBA, B.Tech, BBA, LLB | M | D: 500000 | D: 88/12/45 | M | M | D: A+ | M |
| 97 / 2478 | SP Jain Institute (`sp-jain-institute`) | U: Mumbai, Maharashtra; P | M | D: MBA | M | D: 2100000 | D: 97/26/95 | M | M | D: A++ | M |
| 98 / 2502 | NALSAR University of Law (`nalsar-university-of-law`) | U: Hyderabad, Telangana; G | M | D: LLB, LLM | M | D: 200000 | D: 90/12/40 | M | M | D: A+ | M |
| 99 / 2527 | NLIU Bhopal (`nliu-bhopal`) | U: Bhopal, Madhya Pradesh; G | M | D: LLB, LLM | M | D: 180000 | D: 85/10/32 | M | M | D: A | M |
| 100 / 2552 | IIT Mandi (`iit-mandi`) | U: Mandi, Himachal Pradesh; G | M | D: B.Tech, M.Tech, PhD | M | D: 200000 | D: 82/9.5/40 | M | M | D: A | M |
| 101 / 2578 | IIT Ropar (`iit-ropar`) | U: Rupnagar, Punjab; G | M | D: B.Tech, M.Tech | M | D: 195000 | D: 80/9/38 | M | M | D: A | M |
| 102 / 2603 | IIT Patna (`iit-patna`) | U: Patna, Bihar; G | M | D: B.Tech, M.Tech, PhD | M | D: 190000 | D: 79/8.8/36 | M | M | D: A | M |
| 103 / 2629 | IIT Bhubaneswar (`iit-bhubaneswar`) | U: Bhubaneswar, Odisha; G | M | D: B.Tech, M.Tech, PhD | M | D: 205000 | D: 83/10/42 | M | M | D: A+ | M |
| 104 / 2655 | IIT Gandhinagar (`iit-gandhinagar`) | U: Gandhinagar, Gujarat; G | M | D: B.Tech, M.Tech, PhD | M | D: 210000 | D: 84/10.5/45 | M | M | D: A+ | M |
| 105 / 2681 | IIT Jodhpur (`iit-jodhpur`) | U: Jodhpur, Rajasthan; G | M | D: B.Tech, M.Tech | M | D: 195000 | D: 80/9/38 | M | M | D: A | M |
| 106 / 2706 | NIT Jamshedpur (`nit-jamshedpur`) | U: Jamshedpur, Jharkhand; G | M | D: B.Tech, M.Tech | M | D: 155000 | D: 81/7.5/28 | M | M | D: A | M |
| 107 / 2731 | NIT Kurukshetra (`nit-kurukshetra`) | U: Kurukshetra, Haryana; G | M | D: B.Tech, M.Tech | M | D: 150000 | D: 80/7.2/26 | M | M | D: A | M |
| 108 / 2756 | NIT Patna (`nit-patna`) | U: Patna, Bihar; G | M | D: B.Tech, M.Tech | M | D: 145000 | D: 78/6.8/24 | M | M | D: A | M |
| 109 / 2781 | NIT Raipur (`nit-raipur`) | U: Raipur, Chhattisgarh; G | M | D: B.Tech, M.Tech | M | D: 135000 | D: 75/6.2/22 | M | M | D: B++ | M |
| 110 / 2806 | NIT Srinagar (`nit-srinagar`) | U: Srinagar, Jammu & Kashmir; G | M | D: B.Tech, M.Tech | M | D: 130000 | D: 72/5.8/20 | M | M | D: B++ | M |
| 111 / 2830 | NIT Goa (`nit-goa`) | U: Goa, Goa; G | M | D: B.Tech | M | D: 125000 | D: 70/5.5/18 | M | M | D: B+ | M |
| 112 / 2853 | NIT Uttarakhand (`nit-uttarakhand`) | U: Srinagar, Uttarakhand; G | M | D: B.Tech | M | D: 120000 | D: 68/5.2/17 | M | M | D: B+ | M |
| 113 / 2876 | NIT Arunachal Pradesh (`nit-arunachal-pradesh`) | U: Yupia, Arunachal Pradesh; G | M | D: B.Tech | M | D: 115000 | D: 62/4.5/14 | M | M | D: B+ | M |
| 114 / 2898 | NIT Sikkim (`nit-sikkim`) | U: Ravangla, Sikkim; G | M | D: B.Tech | M | D: 110000 | D: 60/4.2/13 | M | M | D: B+ | M |
| 115 / 2920 | NIT Manipur (`nit-manipur`) | U: Imphal, Manipur; G | M | D: B.Tech | M | D: 112000 | D: 61/4.3/13.5 | M | M | D: B+ | M |
| 116 / 2943 | NIT Mizoram (`nit-mizoram`) | U: Aizawl, Mizoram; G | M | D: B.Tech | M | D: 108000 | D: 58/4/12 | M | M | D: B+ | M |
| 117 / 2965 | NIT Nagaland (`nit-nagaland`) | U: Dimapur, Nagaland; G | M | D: B.Tech | M | D: 105000 | D: 57/3.8/11.5 | M | M | D: B+ | M |
| 118 / 2987 | VJTI Mumbai (`vjti-mumbai`) | U: Mumbai, Maharashtra; G | M | D: B.Tech, M.Tech | M | D: 90000 | D: 85/8/32 | M | M | D: A+ | M |
| 119 / 3012 | College of Engineering Pune (`college-of-engineering-pune`) | U: Pune, Maharashtra; G | M | D: B.Tech, M.Tech | M | D: 95000 | D: 84/7.8/30 | M | M | D: A+ | M |
| 120 / 3037 | IISc Bangalore (`iisc-bangalore`) | U: Bangalore, Karnataka; G | M | D: B.Sc, M.Tech, PhD | M | D: 35000 | D: 92/14/60 | M | M | D: A++ | M |
| 121 / 3063 | Indian Statistical Institute (`indian-statistical-institute`) | U: Kolkata, West Bengal; G | M | D: B.Sc, M.Sc, PhD | M | D: 10000 | D: 88/12/50 | M | M | D: A++ | M |
| 122 / 3089 | CMI Chennai (`cmi-chennai`) | U: Chennai, Tamil Nadu; G | M | D: B.Sc, M.Sc, PhD | M | D: 15000 | D: 85/11/45 | M | M | D: A | M |
| 123 / 3114 | IIM Nagpur (`iim-nagpur`) | U: Nagpur, Maharashtra; G | M | D: MBA | M | D: 1400000 | D: 85/15/45 | M | M | D: B++ | M |
| 124 / 3138 | IIM Amritsar (`iim-amritsar`) | U: Amritsar, Punjab; G | M | D: MBA | M | D: 1350000 | D: 84/14.5/42 | M | M | D: B++ | M |
| 125 / 3162 | IIM Bodh Gaya (`iim-bodh-gaya`) | U: Bodh Gaya, Bihar; G | M | D: MBA | M | D: 1300000 | D: 82/13/38 | M | M | D: B+ | M |
| 126 / 3185 | IIM Jammu (`iim-jammu`) | U: Jammu, Jammu & Kashmir; G | M | D: MBA | M | D: 1250000 | D: 81/12.5/36 | M | M | D: B+ | M |
| 127 / 3208 | IIM Sambalpur (`iim-sambalpur`) | U: Sambalpur, Odisha; G | M | D: MBA | M | D: 1280000 | D: 80/12/35 | M | M | D: B+ | M |
| 128 / 3232 | IIM Sirmaur (`iim-sirmaur`) | U: Sirmaur, Himachal Pradesh; G | M | D: MBA | M | D: 1200000 | D: 78/11/32 | M | M | D: B+ | M |
| 129 / 3255 | Madras Medical College (`madras-medical-college`) | U: Chennai, Tamil Nadu; G | M | D: MBBS, MD, MS | M | D: 18000 | D: 94/9.5/20 | M | M | D: A++ | M |
| 130 / 3280 | Seth GS Medical College (`seth-gs-medical-college`) | U: Mumbai, Maharashtra; G | M | D: MBBS, MD, MS | M | D: 22000 | D: 93/9/19 | M | M | D: A+ | M |
| 131 / 3305 | Lady Hardinge Medical College (`lady-hardinge-medical-college`) | U: New Delhi, Delhi; G | M | D: MBBS, MD | M | D: 15000 | D: 92/8.5/18 | M | M | D: A+ | M |
| 132 / 3329 | Stanley Medical College (`stanley-medical-college`) | U: Chennai, Tamil Nadu; G | M | D: MBBS, MD | M | D: 16000 | D: 88/8/16 | M | M | D: A | M |
| 133 / 3353 | Bangalore Medical College (`bangalore-medical-college`) | U: Bangalore, Karnataka; G | M | D: MBBS, MD, MS | M | D: 25000 | D: 90/8.5/17 | M | M | D: A+ | M |
| 134 / 3378 | NLU Delhi (`nlu-delhi`) | U: New Delhi, Delhi; G | M | D: LLB, LLM | M | D: 280000 | D: 92/14/42 | M | M | D: A+ | M |
| 135 / 3403 | NLU Jodhpur (`nlu-jodhpur`) | U: Jodhpur, Rajasthan; G | M | D: LLB, LLM | M | D: 220000 | D: 85/10/35 | M | M | D: A | M |
| 136 / 3428 | GNLU Gandhinagar (`gnlu-gandhinagar`) | U: Gandhinagar, Gujarat; G | M | D: LLB, LLM | M | D: 200000 | D: 82/9/30 | M | M | D: A | M |
| 137 / 3452 | NUJS Kolkata (`nujs-kolkata`) | U: Kolkata, West Bengal; G | M | D: LLB, LLM | M | D: 240000 | D: 88/11/38 | M | M | D: A+ | M |
| 138 / 3477 | RGNUL Patiala (`rgnul-patiala`) | U: Patiala, Punjab; G | M | D: LLB, LLM | M | D: 160000 | D: 75/7/22 | M | M | D: B++ | M |
| 139 / 3501 | SRM AP (`srm-ap`) | U: Amaravati, Andhra Pradesh; P | M | D: B.Tech, M.Tech, BBA | M | D: 280000 | D: 72/5.5/22 | M | M | D: A | M |
| 140 / 3527 | Jain University (`jain-university`) | U: Bangalore, Karnataka; P | M | D: B.Tech, BBA, MBA, B.Com, B.Sc | M | D: 180000 | D: 74/5.5/22 | M | M | D: A+ | M |
| 141 / 3555 | UPES Dehradun (`upes-dehradun`) | U: Dehradun, Uttarakhand; P | M | D: B.Tech, MBA, BBA, LLB | M | D: 280000 | D: 75/6/25 | M | M | D: A | M |
| 142 / 3582 | KLE Technological University (`kle-technological-university`) | U: Hubballi, Karnataka; P | M | D: B.Tech, M.Tech | M | D: 150000 | D: 78/6.5/26 | M | M | D: A | M |
| 143 / 3607 | Dhirubhai Ambani Institute (`dhirubhai-ambani-institute`) | U: Gandhinagar, Gujarat; P | M | D: B.Tech, M.Tech | M | D: 250000 | D: 85/9.5/40 | M | M | D: A | M |
| 144 / 3632 | RVCE Bangalore (`rvce-bangalore`) | U: Bangalore, Karnataka; P | M | D: B.Tech, M.Tech | M | D: 200000 | D: 82/7.5/30 | M | M | D: A+ | M |
| 145 / 3657 | BMS College of Engineering (`bms-college-of-engineering`) | U: Bangalore, Karnataka; P | M | D: B.Tech, M.Tech | M | D: 180000 | D: 80/7/28 | M | M | D: A | M |
| 146 / 3682 | MS Ramaiah Institute (`ms-ramaiah-institute`) | U: Bangalore, Karnataka; P | M | D: B.Tech, M.Tech | M | D: 190000 | D: 79/6.8/27 | M | M | D: A | M |
| 147 / 3707 | PES University (`pes-university`) | U: Bangalore, Karnataka; P | M | D: B.Tech, M.Tech, MBA | M | D: 300000 | D: 82/8/35 | M | M | D: A+ | M |
| 148 / 3733 | IIITDM Kancheepuram (`iiitdm-kancheepuram`) | U: Kancheepuram, Tamil Nadu; G | M | D: B.Tech, M.Tech, PhD | M | D: 180000 | D: 82/8/32 | M | M | D: A | M |
| 149 / 3759 | NIT Puducherry (`nit-puducherry`) | U: Karaikal, Puducherry; G | M | D: B.Tech | M | D: 118000 | D: 65/5/16 | M | M | D: B+ | M |
| 150 / 3782 | NIT Andhra Pradesh (`nit-andhra-pradesh`) | U: Tadepalligudem, Andhra Pradesh; G | M | D: B.Tech | M | D: 115000 | D: 63/4.8/15 | M | M | D: B+ | M |
| 151 / 3805 | NIT Delhi (`nit-delhi`) | U: New Delhi, Delhi; G | M | D: B.Tech, M.Tech | M | D: 155000 | D: 80/7.5/28 | M | M | D: A | M |
| 152 / 3830 | Cochin University (`cochin-university`) | U: Kochi, Kerala; G | M | D: B.Tech, M.Tech, MBA, LLB | M | D: 45000 | D: 78/6/24 | M | M | D: A+ | M |
| 153 / 3857 | Visvesvaraya Technological University (`visvesvaraya-technological-university`) | U: Belgaum, Karnataka; G | M | D: B.Tech, M.Tech | M | D: 40000 | D: 72/5/20 | M | M | D: A+ | M |
| 154 / 3882 | Gujarat Technological University (`gujarat-technological-university`) | U: Ahmedabad, Gujarat; G | M | D: B.Tech, MBA, BBA | M | D: 35000 | D: 68/4.5/16 | M | M | D: A | M |
| 155 / 3908 | JNTU Hyderabad (`jntu-hyderabad`) | U: Hyderabad, Telangana; G | M | D: B.Tech, M.Tech, MBA, PhD | M | D: 30000 | D: 70/5/18 | M | M | D: A | M |
| 156 / 3935 | Rajasthan Technical University (`rajasthan-technical-university`) | U: Kota, Rajasthan; G | M | D: B.Tech, M.Tech | M | D: 35000 | D: 65/4.2/14 | M | M | D: B++ | M |
| 157 / 3959 | Punjab Technical University (`punjab-technical-university`) | U: Jalandhar, Punjab; G | M | D: B.Tech, MBA | M | D: 40000 | D: 62/4/13 | M | M | D: B++ | M |
| 158 / 3984 | Siksha O Anusandhan (`siksha-o-anusandhan`) | U: Bhubaneswar, Odisha; P | M | D: B.Tech, MBBS, MBA, BBA | M | D: 250000 | D: 78/6.5/26 | M | M | D: A+ | M |
| 159 / 4011 | Kalasalingam University (`kalasalingam-university`) | U: Virudhunagar, Tamil Nadu; P | M | D: B.Tech, M.Tech | M | D: 150000 | D: 72/5/20 | M | M | D: A | M |
| 160 / 4036 | Vel Tech University (`vel-tech-university`) | U: Chennai, Tamil Nadu; P | M | D: B.Tech, M.Tech, MBA | M | D: 180000 | D: 70/5/20 | M | M | D: A+ | M |
| 161 / 4062 | Sathyabama Institute (`sathyabama-institute`) | U: Chennai, Tamil Nadu; P | M | D: B.Tech, M.Tech, MBA | M | D: 200000 | D: 75/5.5/22 | M | M | D: A+ | M |
| 162 / 4088 | Hindustan University (`hindustan-university`) | U: Chennai, Tamil Nadu; P | M | D: B.Tech, M.Tech, MBA | M | D: 220000 | D: 72/5.2/20 | M | M | D: A | M |
| 163 / 4114 | Saveetha University (`saveetha-university`) | U: Chennai, Tamil Nadu; P | M | D: MBBS, MD, BBA, B.Tech | M | D: 800000 | D: 82/7/18 | M | M | D: A+ | M |
| 164 / 4140 | St Johns College (`st-johns-college`) | U: Agra, Uttar Pradesh; P | M | D: B.A, B.Sc, B.Com | M | D: 25000 | D: 60/3.5/10 | M | M | D: B++ | M |
| 165 / 4165 | Banasthali Vidyapith (`banasthali-vidyapith`) | U: Tonk, Rajasthan; P | M | D: B.Tech, MBA, B.Sc, B.A, PhD | M | D: 120000 | D: 72/5/18 | M | M | D: A++ | M |
| 166 / 4193 | LNMIIT Jaipur (`lnmiit-jaipur`) | U: Jaipur, Rajasthan; P | M | D: B.Tech, M.Tech | M | D: 350000 | D: 82/8/32 | M | M | D: A | M |
| 167 / 4218 | IIIT Kottayam (`iiit-kottayam`) | U: Kottayam, Kerala; G | M | D: B.Tech, M.Tech | M | D: 160000 | D: 78/7/28 | M | M | D: A | M |
| 168 / 4243 | IIIT Gwalior (`iiit-gwalior`) | U: Gwalior, Madhya Pradesh; G | M | D: B.Tech, M.Tech, PhD | M | D: 200000 | D: 84/9/38 | M | M | D: A+ | M |
| 169 / 4269 | IIIT Jabalpur (`iiit-jabalpur`) | U: Jabalpur, Madhya Pradesh; G | M | D: B.Tech, M.Tech | M | D: 170000 | D: 78/7/26 | M | M | D: A | M |
| 170 / 4294 | IIIT Sri City (`iiit-sri-city`) | U: Sri City, Andhra Pradesh; G | M | D: B.Tech | M | D: 200000 | D: 75/7.5/28 | M | M | D: B++ | M |
| 171 / 4318 | Calcutta University (`calcutta-university`) | U: Kolkata, West Bengal; G | M | D: B.A, B.Sc, B.Com, M.A, M.Sc, PhD | M | D: 10000 | D: 68/4/12 | M | M | D: A | M |
| 172 / 4347 | Madras University (`madras-university`) | U: Chennai, Tamil Nadu; G | M | D: B.A, B.Sc, B.Com, MBA, PhD | M | D: 12000 | D: 70/4.2/14 | M | M | D: A+ | M |
| 173 / 4375 | Mysore University (`mysore-university`) | U: Mysore, Karnataka; G | M | D: B.A, B.Sc, B.Com, M.Sc, PhD | M | D: 10000 | D: 68/4/12 | M | M | D: A+ | M |
| 174 / 4402 | Andhra University (`andhra-university`) | U: Visakhapatnam, Andhra Pradesh; G | M | D: B.Tech, B.Sc, MBA, LLB | M | D: 15000 | D: 70/4.5/15 | M | M | D: A | M |
| 175 / 4429 | Patna University (`patna-university`) | U: Patna, Bihar; G | M | D: B.A, B.Sc, B.Com, LLB | M | D: 8000 | D: 60/3.5/10 | M | M | D: B++ | M |
| 176 / 4455 | Gauhati University (`gauhati-university`) | U: Guwahati, Assam; G | M | D: B.A, B.Sc, B.Com, MBA, LLB | M | D: 12000 | D: 65/4/12 | M | M | D: A | M |
| 177 / 4483 | Dibrugarh University (`dibrugarh-university`) | U: Dibrugarh, Assam; G | M | D: B.A, B.Sc, B.Tech, MBA | M | D: 10000 | D: 62/3.8/11 | M | M | D: B++ | M |
| 178 / 4509 | Tezpur University (`tezpur-university`) | U: Tezpur, Assam; G | M | D: B.Tech, B.Sc, MBA, M.Tech | M | D: 25000 | D: 72/5/18 | M | M | D: A | M |
| 179 / 4536 | Central University of Kerala (`central-university-of-kerala`) | U: Kasaragod, Kerala; G | M | D: B.A, B.Sc, M.A, M.Sc | M | D: 15000 | D: 68/4.5/14 | M | M | D: A | M |
| 180 / 4562 | Central University of Rajasthan (`central-university-of-rajasthan`) | U: Ajmer, Rajasthan; G | M | D: B.Tech, B.Sc, MBA, M.Sc | M | D: 18000 | D: 65/4.2/13 | M | M | D: A | M |
| 181 / 4588 | Central University of Haryana (`central-university-of-haryana`) | U: Mahendragarh, Haryana; G | M | D: B.A, B.Sc, B.Tech, MBA | M | D: 15000 | D: 62/3.8/11 | M | M | D: B++ | M |
| 182 / 4614 | Central University of Punjab (`central-university-of-punjab`) | U: Bathinda, Punjab; G | M | D: B.Sc, M.Sc, MBA, PhD | M | D: 16000 | D: 64/4/12 | M | M | D: A | M |
| 183 / 4640 | Central University of Tamil Nadu (`central-university-of-tamil-nadu`) | U: Thiruvarur, Tamil Nadu; G | M | D: B.A, B.Sc, M.A, M.Sc | M | D: 12000 | D: 60/3.5/10 | M | M | D: B++ | M |
| 184 / 4665 | Pondicherry University (`pondicherry-university`) | U: Puducherry, Puducherry; G | M | D: B.Tech, B.Sc, MBA, M.Tech, PhD | M | D: 20000 | D: 72/5/18 | M | M | D: A+ | M |
| 185 / 4693 | North Eastern Hill University (`north-eastern-hill-university`) | U: Shillong, Meghalaya; G | M | D: B.A, B.Sc, M.Sc, PhD | M | D: 12000 | D: 62/3.8/11 | M | M | D: A | M |
| 186 / 4719 | Tripura University (`tripura-university`) | U: Agartala, Tripura; G | M | D: B.A, B.Sc, M.Sc | M | D: 8000 | D: 58/3.2/9 | M | M | D: B++ | M |
| 187 / 4744 | Mizoram University (`mizoram-university`) | U: Aizawl, Mizoram; G | M | D: B.A, B.Sc, M.Sc, MBA | M | D: 10000 | D: 60/3.5/10 | M | M | D: A | M |
| 188 / 4769 | Nagaland University (`nagaland-university`) | U: Lumami, Nagaland; G | M | D: B.A, B.Sc, M.A | M | D: 8000 | D: 55/3/8 | M | M | D: B+ | M |
| 189 / 4792 | Sikkim University (`sikkim-university`) | U: Gangtok, Sikkim; G | M | D: B.A, B.Sc, M.Sc, MBA | M | D: 10000 | D: 58/3.2/9 | M | M | D: B+ | M |
| 190 / 4817 | Rajiv Gandhi University (`rajiv-gandhi-university`) | U: Itanagar, Arunachal Pradesh; G | M | D: B.A, B.Sc, M.A, LLB | M | D: 8000 | D: 55/3/8.5 | M | M | D: B++ | M |
| 191 / 4841 | Manipur University (`manipur-university`) | U: Imphal, Manipur; G | M | D: B.A, B.Sc, M.Sc, MBA | M | D: 10000 | D: 58/3.2/9 | M | M | D: B++ | M |
| 192 / 4866 | GITAM University (`gitam-university`) | U: Visakhapatnam, Andhra Pradesh; P | M | D: B.Tech, MBA, BBA, B.Sc | M | D: 250000 | D: 78/6/25 | M | M | D: A+ | M |
| 193 / 4893 | Centurion University (`centurion-university`) | U: Bhubaneswar, Odisha; P | M | D: B.Tech, MBA, BBA | M | D: 180000 | D: 68/4.5/16 | M | M | D: A | M |
| 194 / 4918 | GD Goenka University (`gd-goenka-university`) | U: Gurgaon, Haryana; P | M | D: B.Tech, BBA, MBA, LLB | M | D: 350000 | D: 65/5/18 | M | M | D: B++ | M |
| 195 / 4945 | OP Jindal University (`op-jindal-university`) | U: Sonipat, Haryana; P | M | D: BBA, MBA, LLB, B.A | M | D: 500000 | D: 80/8/32 | M | M | D: A+ | M |
| 196 / 4972 | Chitkara University (`chitkara-university`) | U: Rajpura, Punjab; P | M | D: B.Tech, MBA, BBA | M | D: 250000 | D: 76/6/24 | M | M | D: A+ | M |
| 197 / 4998 | Graphic Era University (`graphic-era-university`) | U: Dehradun, Uttarakhand; P | M | D: B.Tech, MBA, BBA, B.Sc | M | D: 200000 | D: 72/5/20 | M | M | D: A | M |
| 198 / 5025 | DIT University (`dit-university`) | U: Dehradun, Uttarakhand; P | M | D: B.Tech, MBA, BBA | M | D: 180000 | D: 70/4.8/18 | M | M | D: A | M |
| 199 / 5050 | Galgotias University (`galgotias-university`) | U: Greater Noida, Uttar Pradesh; P | M | D: B.Tech, MBA, BBA, LLB | M | D: 200000 | D: 68/4.5/16 | M | M | D: A | M |
| 200 / 5077 | Nirma University (`nirma-university`) | U: Ahmedabad, Gujarat; P | M | D: B.Tech, MBA, LLB, B.Sc | M | D: 250000 | D: 82/7.5/30 | M | M | D: A+ | M |
| 201 / 5104 | ICT Mumbai (`ict-mumbai`) | U: Mumbai, Maharashtra; G | M | D: B.Tech, M.Tech, PhD | M | D: 60000 | D: 90/10/45 | M | M | D: A++ | M |
| 202 / 5130 | IISER Pune (`iiser-pune`) | U: Pune, Maharashtra; G | M | D: B.Sc, M.Sc, PhD | M | D: 40000 | D: 85/10/40 | M | M | D: A++ | M |
| 203 / 5156 | IISER Kolkata (`iiser-kolkata`) | U: Kolkata, West Bengal; G | M | D: B.Sc, M.Sc, PhD | M | D: 35000 | D: 82/9/35 | M | M | D: A+ | M |
| 204 / 5181 | IISER Mohali (`iiser-mohali`) | U: Mohali, Punjab; G | M | D: B.Sc, M.Sc, PhD | M | D: 38000 | D: 80/8.5/32 | M | M | D: A+ | M |
| 205 / 5206 | NISER Bhubaneswar (`niser-bhubaneswar`) | U: Bhubaneswar, Odisha; G | M | D: B.Sc, M.Sc, PhD | M | D: 30000 | D: 82/9/35 | M | M | D: A+ | M |

## Source-research backlog and blockers

All ledger rows: official-source research PENDING. Next action: after Phase 2 evidence/safety foundation, select/review 10-college pilot and process each of ten domains; expand through the 205-slug manifest. Do not bulk mark fields VERIFIED. Record source-specific blocked rights/access, absent publication, conflict or expired evidence individually when encountered. No actual source-access/rights conclusion has been reached in this documentation step.

Operational blockers: disposable DB not verified; fresh advisory registry unreachable; local build sandbox port binding; public deployment retrieval unavailable; owner rotation/revocation and backup/restore evidence absent; external-source rights/reviewer capacity not established. Broader DATA_COVERAGE.md / VERIFICATION_EVIDENCE.md / BLOCKERS.md files were requested by standing V3 standards but are not authorized in this step; their content lives here until separately authorized.

## Completion tracking

Phase 1: documentation and 205-row repository completeness assessment delivered. Phase 2 currently has only the integration target guard implemented; remaining Phase 2 work is not complete. Existing CI remains historical evidence, not new feature completion. Data coverage: assessed 205; verified facts 0; external enrichment attempts 0. No production coverage assertion.

## Phase 2 implementation evidence (2026-11-17)

Branch: `phase-2-safety-integrity`, based on audited main SHA. Changed files: `tests/integration/target.ts` (new), `tests/integration/db.ts`, `tests/integration/setup.ts`, `tests/unit/integration-target.test.ts` (new), `docs/TESTING.md`, this status file. Existing untracked `CollegeFind_AGENTS_V3.md` preserved. No schema migration, production connection, credential action, application deploy or external service change.

| Requirement | Status / evidence |
| --- | --- |
| Missing TEST_DATABASE_URL rejected | PASS: unit regression test; integration command exits during setup before DB connection |
| Malformed/non-PostgreSQL URL rejected | PASS: unit regression cases |
| Explicit disposable confirmation required | PASS: unit regression case for missing confirmation |
| Production-like target rejected | PASS: unit cases for production database path and prod host |
| Runtime DATABASE_URL fallback removed | PASS by code inspection in tests/integration/db.ts |
| Validate before clients / destructive reset | PASS by setup module evaluation, testDb guard, resetDb guard; unit tests verify target predicate, not actual Prisma/pg constructor spy |
| Unsafe target cannot reach DB | PASS for regression: constructor mocks prove setup import and direct client access reject before pg.Pool/PrismaClient construction when TEST_DATABASE_URL is missing despite DATABASE_URL being set |
| Destructive operation guards | PASS by inspection: the only test-suite TRUNCATE is in resetDb, which validates before obtaining a client/issuing SQL; resetDb has no other destructive statements |
| Lint | PASS: `npm run lint` |
| Typecheck | PASS: `./node_modules/.bin/tsc --noEmit --incremental false` |
| Unit | PASS: `npm test -- --no-file-parallelism`; 45 tests, four files |
| Integration against disposable DB | BLOCKED: no TEST_DATABASE_URL or confirmation configured. `npm run test:integration` previously exited in setup with expected missing-target guard before tests/connections. Local `psql` reports no server and socket operation is not permitted; `initdb`/`pg_ctl` are unavailable; Docker daemon access is denied. No substitute database used |
| Build | BLOCKED: `npm run build` reached Next.js Turbopack and failed when CSS processing attempted subprocess port binding (`Operation not permitted`); no DB migration ran |
| Playwright/browser | BLOCKED: requires built app and seeded disposable DB; neither is available |
| Migration status | No schema change/migration created. Existing migration history untouched |
| Historical credential rotation | UNVERIFIED: no owner-side evidence. Required: rotate DB password and NEXTAUTH_SECRET at their owners, revoke old DB credentials/session tokens, review provider access/audit records without exposing values, document timestamps and active deployment references; rotation/rotation approval remains outside current authorization |
| Production auth/seed/rate-limit | Code was previously inspected; runtime/deployment behavior remains unverified. No production HTTP access in this step |

Constructor/import-order regression is now covered by `tests/unit/integration-target.test.ts`; local integration/migration/E2E verification remains blocked by unavailable PostgreSQL tooling/service and sandbox access. Remaining Phase 2 tasks—field evidence schema, source/import-run integrity, demo isolation, comparisons, null handling, errors/auth/mobile flows—are NOT STARTED. Continue these in separate scoped tasks, recording tests, but Phase 3 remains blocked until all acceptance criteria have verified evidence and blockers are resolved or explicitly accepted.

## Phase 2 continuation evidence (2026-11-17)

Branch remains `phase-2-safety-integrity`. This increment preserves the guard above and adds comparison correctness, demo-metric exclusions, safer catalogue error display and pure evidence/import-run preparation. No migration, database, credential, production resource, push or deployment was used.

Files changed in this increment: `src/lib/comparison.ts`, `src/context/CompareContext.tsx`, `src/app/compare/page.tsx`, `src/app/saved/page.tsx`, `src/components/RadarChart.tsx`, `src/server/colleges.ts`, `src/app/api/colleges/similar/[id]/route.ts`, `src/app/colleges/[id]/page.tsx`, `src/lib/predictor/service.ts`, `src/app/colleges/page.tsx`, `src/server/ingest/evidence.ts`, `tests/unit/comparison.test.ts`, `tests/unit/evidence.test.ts`, `tests/e2e/smoke.spec.ts`, and this status file. Prior database safety files remain changed as listed above.

| Requirement | Status / evidence |
| --- | --- |
| Comparison URL uses 2–3 canonical slugs | IMPLEMENTED; unit tests cover 2/3 accepted, duplicates, malformed slug, too few IDs, URL serialization |
| Shared comparison restores current records | IMPLEMENTED by query parameter loader fetching `/api/colleges/{slug}` then replacing local state; invalid/deleted slug clears list and reports an error. Browser/device round-trip NOT TESTED because production build/browser stack is blocked |
| Refresh/cross-device restoration | Shared URL survives refresh and uses server records by implementation; E2E test added for serialized share payload but NOT RUN. localStorage draft remains local-device-only by design |
| Saved comparison uses current server records | IMPLEMENTED: saved page obtains comparison college records via existing API and creates a slug URL from that response; removal/deletion path is not browser-tested |
| Duplicate/invalid/deleted IDs | Invalid/duplicate URL slug unit-tested. Deleted identifier is handled by API fetch catch; browser test NOT RUN |
| Null-safe best highlights | IMPLEMENTED: missing/non-finite value in any compared college yields no winner. Unit tested |
| Demo/unverified comparison metrics | IMPLEMENTED: no best-value/verdict highlight unless every college has VERIFIED status. Demo values remain visible under existing demo banner for transparent comparison; radar excludes them |
| Radar unknown data | IMPLEMENTED: null metrics are skipped, demo/unverified colleges are not plotted, polygon is drawn only when all axes are verified/present; explicit note and accessible label added. Canvas browser behavior NOT TESTED |
| Demo numeric fee filters | IMPLEMENTED: any numeric fee constraint excludes DEMO rows; pure query-builder unit regression passes |
| Demo fee predictor filters | IMPLEMENTED: budget-filtered predictor queries exclude DEMO colleges. Existing unfiltered predictor results can still list admissions (cutoffs/source records are separate); production acceptance needs data/reviewer policy checks |
| Demo recommendations | IMPLEMENTED: similar-college page/API excludes DEMO candidates, and fee-distance sorting no longer treats null as zero. Query integration NOT RUN |
| Trusted ranking/featured paths | NIRF rankings remain sourced record-only; featured remains a catalogue starter list and can show labelled demo records. No ranking promotion from demo values found in inspected paths |
| Misleading catalogue empty/error state | IMPLEMENTED: catalogue request failures now show a distinct retry alert instead of “No colleges found.” Browser/network-failure test NOT RUN |
| Evidence/import architecture preparation | PARTIAL: pure `EvidenceDraft` validation, explicit UNREVIEWED/APPROVED/REJECTED states, stable evidence identity and import-run transition rules added and unit-tested in `src/server/ingest/evidence.ts`. No persisted schema, migration, source dedup in importer, atomic/recoverable import-run persistence or rollback rehearsal; these require Phase 2 schema/DB work and disposable database |
| Authz, mobile workflows and seed protections | NOT CHANGED in this increment; code-level prior audit remains, live/session/browser checks remain unverified |
| Lint/typecheck/unit | PASS: `npm run lint`; `./node_modules/.bin/tsc --noEmit --incremental false`; `npm test -- --no-file-parallelism` → 53 tests / six files |
| Build | BLOCKED: `npm run build` failed in Turbopack CSS subprocess port bind with `Operation not permitted`. This is consistent with sandbox restriction; cannot certify no build defect beyond this failure point |
| Integration/migration | BLOCKED: no verified isolated PostgreSQL; psql server unavailable, socket access denied, server binaries absent, Docker socket denied. No DB URL/confirmation set; no database operation attempted |
| Browser tests | NOT RUN/BLOCKED: E2E needs built app/database; new share test is authored but has no execution evidence |

### Phase 2 state after this increment

Implemented with unit evidence: comparison slug/URL helpers, shared-link hydration from current API records, saved comparison route hydration by slug, null/demo-safe comparison highlights and radar behavior, numeric demo fee-filter exclusion, demo exclusion from the inspected similar-college and budget-filtered predictor paths, distinct catalogue fetch error state, integration-test target guard, and pure evidence/import transition validation. Partial only: shared-link and visual behavior lack browser evidence; evidence/import model is pure/in-memory preparation, not persistent architecture.

Still not started or not accepted: persisted field-evidence/reviewer schema and additive migration, source artifact deduplication and import-run persistence/recovery, comprehensive demo isolation for all API/search/saved/home/predictor paths, comparison real-browser restoration and saved-comparison flow, chart/manual accessibility verification, error/authorization/mobile E2E, authenticated save/retrieve browser tests, disposable DB integration/migration tests, successful build, Playwright execution, current advisory/deployment/owner-side secret-rotation verification. Phase 2 is IN PROGRESS and Phase 3 is NOT READY.

Documentation validation: generated ledger reconciles 205 unique original slugs; all ten requested domain columns included; 145 government / 60 private / 32 state-label totals; no placeholders masquerading as citations. Final git diff/status inspection must show only approved docs plus pre-existing untracked V3 instructions. No application tests rerun for documentation-only edits.

## Phase 2 persistent foundation increment — 2026-11-17

This entry supersedes earlier NOT STARTED statements for persistent profile evidence and durable JoSAA runs. Branch: phase-2-safety-integrity. No database, production resource or credential was modified. All 205 original seed records and slugs remain unchanged; verified facts/enrichment attempts remain zero.

### Implemented

- Prisma: FieldEvidence records reference College and the existing Source, with claim value/unit/scope, academic year, publication/validity dates and same-field supersession history. Competing values coexist. EvidenceDecision records individual reviewer decisions and retains history. Staging is idempotent; review service checks the reviewer's current ADMIN role and writes AuditLog in the same transaction. Import never promotes a college or claim to VERIFIED.
- Source: nullable unique artifact identity and publication metadata; no retrospective merging or deletion of legacy Source rows. Repeated identical new artifacts use upsert; changed content retains a new source.
- ImportRun: durable unique run identity, checksum, source, status, timestamps, summaries and rejected/unmatched reports. CLI supplies the raw-file checksum. Run identity includes year/round/exam and institute mappings so mapping fixes are retryable.
- JoSAA writes now publish in one serializable file transaction. Conflicting old cutoff values abort, preserve history and leave a FAILED run. PUBLISHED retries return recorded summaries. PARTIAL runs retain unmatched/rejected rows. Concurrent serialization failures require caller retry; no production auto-retry was added. Interrupted transactions can be retried against the durable run.
- Demo visibility: runtime Prisma read extension recursively masks demo fee/placement/package/accreditation/recruiter/student/establishment/rating metrics for catalogue, detail, saved, comparisons and nested API results. Stored fixture records remain intact, available through explicitly constructed development seed clients. Demo fee sorts, NAAC and establishment/rating filters exclude DEMO rows; numeric fee exclusion remains. Similar-college fee comparisons use a verified source college's fee only. Production predictor programme selection excludes DEMO colleges. NIRF readers continue to use typed ranking records, not demo ratings.

### Files in this increment

`prisma/schema.prisma`; `prisma/migrations/20261117000000_field_evidence_import_runs/migration.sql`; `src/server/ingest/identity.ts`; `src/server/ingest/field-evidence.ts`; `src/server/ingest/evidence.ts`; `src/server/ingest/josaa.ts`; `scripts/ingest-josaa.ts`; `src/lib/data-visibility.ts`; `src/lib/prisma.ts`; `src/server/colleges.ts`; `src/app/api/colleges/similar/[id]/route.ts`; `src/lib/predictor/service.ts`; `tests/unit/data-foundation.test.ts`; `tests/integration/josaa-ingest.test.ts`; `docs/PHASE2_MIGRATION.md`; this file. All earlier worktree changes preserved.

### Actual verification

| Check | Result |
| --- | --- |
| Prisma schema format + client generation | PASS: local `prisma format` and `prisma generate`; initial relation placement error corrected before final generation |
| Additive migration preparation | PASS: `prisma migrate diff --from-schema /tmp/collegefind-before.prisma --to-schema prisma/schema.prisma --script`; generated offline from original schema, then added validity/status CHECK constraints. No DB connection/execution |
| Lint | PASS: `npm run lint` |
| Typecheck | PASS: `./node_modules/.bin/tsc --noEmit --incremental false` |
| Unit tests | PASS: `npm test -- --no-file-parallelism` → 57 tests, 7 files; includes source identity/checksum, nested demo masking/input preservation and published-run retry contract. Existing validation/transition tests retained |
| New integration cases | AUTHORED, NOT RUN: identical import asserts one Source/run; changed-cutoff import asserts historical values unchanged and failed run retained |
| Build | BLOCKED: safe `npm run build` with dummy loopback DB/auth overrides fails in Turbopack CSS process port binding: Operation not permitted. No security bypass or migration executed |
| PostgreSQL migration/integration | BLOCKED: previously established unavailable disposable PostgreSQL/tooling; no substitution or confirmation flag set |
| Browser/E2E | BLOCKED: no successful build and isolated seeded database; no fresh browser pass claimed |

### Readiness and remaining tasks

Data foundation code and additive SQL are ready for isolated verification, not production deployment or Phase 3. Rollback/backup/restore procedure is in PHASE2_MIGRATION.md. Existing Prisma runtime readers require schema migration first; do not deploy new generated client to unmigrated DB.

Remaining Phase 2 acceptance work: execute migration/drift checks on verified disposable PostgreSQL; exercise transactional rollback/retry/concurrent imports and recovery; verify direct EvidenceDecision links to FeesRecord/PlacementRecord/CutoffRecord/NirfRanking and their exactly-one-target constraint (implemented with no duplicated numeric values); test staging/reviewer/supersession authorization with real DB; implement approved per-field projection/freshness/conflict resolution before any verification badge can be based on new evidence; audit runtime demo suppression under actual Prisma relation queries and production predictor/aggregate counts; finish comparison draft freshness, same-route URL navigation/refresh and deleted-saved-item browser cases; test authentication/authorization, errors/retry/mobile workflows; successful production build, Playwright and current external security/deployment evidence. The runtime mask is application protection, not a claim all legacy summaries are source-verified. College-wide VERIFIED remains legacy metadata until field projection is implemented. No evidence publication UI or automatic summary promotion was added.

Phase 2 IN PROGRESS. Phase 3 NOT STARTED / NOT READY.


Final additions in this increment: EvidenceDecision references existing typed fee/placement/cutoff/ranking records directly with a database CHECK requiring exactly one review target; the review service enforces current ADMIN status and records an audit event. Pure `resolveReviewedField` withholds unreviewed/expired/conflicting claims and follows approved supersession; tests cover unknown, conflict, expiry and replacement. Public stats' official-cutoff count now excludes DEMO-college cutoffs (`src/app/api/stats/route.ts`, additional changed file). Final unit result: 57 PASS across seven files. Public field projection is deliberately not enabled until isolated DB/reviewer tests establish the new evidence data; legacy VERIFIED badges are not certified by these changes.

## Phase 2 public projection, review and workflow increment — 2026-11-17

Branch `phase-2-safety-integrity`; prior edits and 205-college seed preserved. This entry supersedes earlier statements that public projection/review API and comparison freshness are not implemented. Phase 2 remains IN PROGRESS; Phase 3 is NOT READY.

### Implemented and local evidence

| Acceptance item | Implementation / evidence | Remaining verification |
| --- | --- | --- |
| Individual public profile facts | `publicEvidenceSelect` supplies claim/source/review records to list/detail/saved/comparison reads. `projectPublicCollege` has no fallback to legacy metrics or whole-row VERIFIED flags. HTTPS publisher/retrieval metadata, review, conflict, publication date and validity are checked. Profile validity requires an explicit expiry or current/recent academic year except evergreen description/about/establishment fields. Approved annual tuition must be college-wide, current/recent, consistently valued and reviewed; other financial summaries stay unknown because their typed records do not establish average/highest salary or comparable placement definitions | Actual Prisma extension/relation behavior needs PostgreSQL tests; publication review by humans remains necessary |
| Verification, conflict and supersession | Authorized admin evidence API invokes current-role-checked services; decisions and audit are transactional. Latest decisions control display; ambiguous simultaneous decisions fail closed. Superseded claims are not resurrected when replacements expire. Unreviewed/rejected/expired/conflicting claims are withheld; field statuses and official source links appear on detail pages | Real session/API authorization and DB constraints need integration/E2E |
| Typed facts | Runtime cutoff/fee/placement/ranking finds require latest APPROVED decisions. Decision internals are stripped from public records. Existing typed values are reused. Legacy college-wide VERIFIED cannot certify a public profile; stats no longer counts it as verified | Review filtering now precedes typed-record distinct/pagination; measure the cost of fetching candidates before large-catalogue acceptance |
| Public catalogue filters/sorts | Search API fetches identity/exam-matched candidates, projects source-reviewed fields, filters metrics/courses/NAAC/establishment/rating, then paginates. Unknown fees cannot pass budgets. Fee and rating sorts use projected values; course pages use projected course lists. Featured starter ordering is alphabetical rather than trusting legacy dataStatus | Post-projection filtering loads matched catalogue candidates; correct for the current catalogue but requires performance measurement/indexed projection before large-scale growth |
| Demo isolation | Legacy summaries never supply public financial/accreditation/recruiter facts; reviewed field evidence is required independently. Similar source-college reads use projection; predictor budget filtering uses projected fees; its latest-year selection uses reviewed cutoff reads. Counts exclude unreviewed cutoffs. Demo fixtures and stored rows are untouched | Full Prisma-backed API/aggregate/predictor fixture verification pending |
| Comparison persistence/share | Only id/slug persisted; old snapshots are refetched on mount and tab-storage events. Shared URLs respond to search-param navigation and refresh; deleted/duplicate/invalid selections clear or report failure. Saved comparisons with missing records show unavailable state. Fee winners require matching reporting years; highlights/chart use field availability rather than whole-row verification | Browser tests authored for clean-browser shared load, refresh, invalid/deleted slugs and stale storage; not executed |
| Sessions/errors/mobile | Current User role/existence is queried for session authorization, allowing immediate admin demotion/deleted-account denial. Catalogue retry now reruns fetch; saved fetch errors remain errors rather than empty lists; ranking outage differs from no reviewed data. Share failures are reported except user cancellation. Layout/mobile features retained | Desktop/mobile browser interaction, real auth-cookie flows and delivery/account recovery remain unverified/deferred per roadmap |
| Import concurrency/recovery/records | Added isolated integration cases for same-file concurrent attempts followed by retry, rollback of an earlier newly created programme when a later cutoff conflicts, reviewer denial/approval/audit/supersession and preservation of saved relationships | Authored only. Migration-upgrade/restore compatibility must still be rehearsed with existing baseline rows on disposable PostgreSQL |

### Files in this increment

New: `src/server/public-evidence.ts`, `src/server/public-search.ts`, `src/app/api/admin/evidence/route.ts`, `tests/unit/public-evidence.test.ts`, `tests/unit/public-search.test.ts`, `tests/unit/evidence-review.test.ts`, `tests/integration/evidence.test.ts`, `tests/e2e/comparison.spec.ts`.
Modified: `src/server/colleges.ts`, `src/lib/prisma.ts`, `src/server/ingest/evidence.ts`, `src/server/ingest/field-evidence.ts`, `src/context/CompareContext.tsx`, `src/app/compare/page.tsx`, `src/components/RadarChart.tsx`, `src/app/saved/page.tsx`, `src/app/colleges/page.tsx`, `src/app/colleges/[id]/page.tsx`, `src/app/courses/[slug]/page.tsx`, `src/app/rankings/page.tsx`, `src/app/api/colleges/route.ts`, `src/app/api/colleges/featured/route.ts`, `src/app/api/colleges/similar/[id]/route.ts`, `src/app/api/stats/route.ts`, `src/app/page.tsx`, `src/lib/predictor/service.ts`, `src/lib/session.ts`, `src/types/index.ts`, `tests/unit/evidence.test.ts`, `tests/integration/josaa-ingest.test.ts`, `docs/TESTING.md`, `docs/PHASE2_MIGRATION.md`, this file. No schema/migration change in this increment; prepared migration remains unexecuted.

### Actual check results

- PASS: `npm test -- --no-file-parallelism` — 64 tests, 10 unit files. Tests cover reviewed vs legacy/unreviewed/rejected/expired/conflicting fields, no resurrection after supersession expiry, reviewer denial and transactional audit contract, and unknown-fee filtering/sorting; prior passing tests retained.
- PASS: `npm run lint`; `./node_modules/.bin/tsc --noEmit --incremental false`; `prisma generate`; `git diff --check`.
- BLOCKED: default `npm run build` with dummy loopback DB and dummy auth environment fails in Turbopack subprocess port bind (Operation not permitted). No security changes or production connections used.
- Diagnostic only: `next build --webpack` with dummy environment also fails: Next cannot parse TypeScript --showConfig output. Direct `node node_modules/typescript/bin/tsc --showConfig` emits valid JSON and exits 0. This does not establish a successful alternative build or prove there are no later application build defects.
- NOT RUN/BLOCKED: PostgreSQL integration, migration/rollback/restore rehearsal. No independently verified disposable DB is available; no confirmation flag was set. No old database substituted. Existing environment-access evidence reused.
- NOT RUN/BLOCKED: Playwright. New browser cases are authored and typechecked but not executed; no built server/verified seeded DB or permission to use an unknown database.

### Exact acceptance gates left

1. Provision a fresh PostgreSQL instance/database with server/create-db access; independently verify database/user/host and isolation, then set the explicit test confirmation. Apply old migrations, create baseline users/colleges/saved relationships, apply additive migration, compare preservation, and run full isolated integration suite/schema drift checks.
2. Execute review API/role-revocation/supersession and import concurrent-retry/rollback/failure recovery tests against that target; test backup restoration and record rollback evidence. Check new Prisma query extensions on actual relation queries. No migration execution is authorized for production.
3. Resolve reviewed-query completeness before final acceptance: typed record review now precedes distinct/pagination, and rankings categories/years come from reviewed records. These corrections require actual Prisma integration evidence. Catalogue candidate projection also needs performance evidence. Field semantics for median vs average salary and programme-specific fees must stay distinct; withheld unsupported summaries are intentional.
4. Run desktop/mobile Playwright with a working app server and controlled fixtures; verify share/refresh/same-route/cross-tab and saved flows, error retry, real login/logout/save, deleted users and demoted admins. Confirm chart/table accessibility and null/year behavior.
5. Achieve a successful production build in an environment permitting required subprocess/loopback operations; investigate the webpack diagnostic separately. Supply owner-side credential rotation/revocation and deployment/backup evidence without exposing secrets. No live action is implied by this status.

Data coverage unchanged: 205 originals retained, 205 completeness assessments, zero new official enrichment attempts or verified profiles. Implementation is ready for isolated verification, with the explicit completeness/performance follow-ups above. Phase 3 has not begun.

Final completeness correction: typed findMany now applies review filtering before distinct/skip/take; NIRF available years/categories derive from reviewed records. This preserves complete approved result selection at the cost of fetching candidates before pagination; performance evidence remains outstanding.

## Phase 2 executed verification — 2026-11-17 (supersedes environmental blockers above)

Phase 2 implementation and extensive local checks now have execution evidence. **Overall Phase 2 is NOT declared complete**: owner-side historical credential remediation/production protection evidence is unavailable, and the plan's proposed 80% changed-module branch coverage target is not met in several modules. Phase 3 remains NOT STARTED. No remote CI run, push, merge, deployment, production connection or credential rotation occurred.

### Environments and isolation

With narrow permitted execution outside the sandbox, Docker 29.9.3 and loopback binding worked. Docker Compose 5.7.0 and PostgreSQL client tools were available; PostgreSQL server binaries were not. Created a brand-new PostgreSQL 16 container `collegefind-phase2-verify-20261117`, ID `5289b4c0e61e`, label `collegefind.disposable=phase2`, image digest `sha256:dd2bf3ce2dc83a81674cf7f217fcfd8a5009a4b325dda5b843bfee82a06cff6f`, dynamically published only on `127.0.0.1:32768`.

Before confirmation, Docker inspection verified its label/container/loopback mapping and SQL verified `collegefind_test|postgres|0` (database, user, public-table count). Only then was COLLEGEFIND_TEST_DATABASE_CONFIRMED set. Additional new databases: `collegefind_upgrade_test` (old-schema rehearsal), `collegefind_restore_test` (dump restore), `collegefind_e2e_test` (browser fixtures). E2E was independently checked empty before migration. Local-only postgres/postgres credentials and dummy NextAuth secret were used. Inherited .env DB values were overridden for every application command; no unknown database was contacted.

A verification orchestration error briefly overlapped seed/E2E with integration resets on the same disposable database, causing a seed FK failure and an integration row-count failure. Those runs are FAILED, not accepted passes. Corrected by separate integration and E2E databases; all affected checks were rerun. First browser launch also failed because Playwright's matching browser was absent; installed Chromium/headless shell v1243 (Chrome 153.0.8010.12). Initial raw `prisma db seed` lacked tsx on PATH; using `npm run db:seed` supplies the correct local executable PATH.

### Commands and actual results

Commands used a local runner that injected only the verified fixture URL and dummy auth/optional-service settings. Equivalent portable commands are below.

| Command / check | Executed result |
| --- | --- |
| `prisma migrate deploy` on clean collegefind_test | PASS, all three migrations applied |
| `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` | PASS, no difference |
| `tsx scripts/verify-phase2-upgrade.ts` on fresh collegefind_upgrade_test | PASS: applies previous two migrations, inserts baseline fixtures, applies new migration, compares all original columns/IDs in seven legacy tables (College/User/SavedCollege/SavedComparison/Source/Program/CutoffRecord) |
| `pg_dump -Fc` upgrade DB → `pg_restore` new restore DB | PASS: saved college=1, saved comparison=1, preserved slug; only disposable databases involved |
| `npm run test:integration` | PASS after isolation fix: 45 tests/5 files; final demoted-admin regression rerun documented below |
| `npm run test:coverage -- --maxWorkers=2` | PASS: 111 tests/16 files (66 unit +45 integration), 74.75% lines /62.55% branches /69.71% statements /71.42% functions; HTML report in ignored coverage/. Earlier successful run before env tests had 109 tests |
| `npm run test:e2e -- --workers=2` | PASS: 26 tests, desktop Chromium + Pixel 7 emulation, latest full run 14.1s. Covers search/detail/404, shared refresh/invalid/deleted/stale snapshots, sharing payload, actual credentials login/save/retrieve/saved-comparison refresh, reviewer denial, request error states and demo exclusion |
| `npm run build` | PASS clean Turbopack, both original Next16.3.8 and security-updated16.4.6; latest production build compiled in4.9s |
| `next build --webpack` | PASS clean Next16.4.6 build, compiled13.5s; no production config/security change |
| `npm run lint`, `tsc --noEmit --incremental false`, `prisma generate`, `git diff --check` | PASS; Prisma client7.10.1 after compatible security updates |
| `npm audit --omit=dev --audit-level=high` | PASS: zero vulnerabilities after fixes; full `npm audit fix --ignore-scripts` also reported zero |
| Seed and lock checks | PASS: seed bytes equal HEAD, 205 records, SHA256 a9321b82b6f390790e09a647dfaf589b90c5736819aed6b9a5908922bfcc1637; package root dependencies/devDependencies match lockfile |
| CI YAML parse | PASS locally. Workflow updated with fresh-service identity check, confirmation flag, old-schema/restore rehearsal, separate browser DB and desktop/mobile E2E. Remote workflow NOT EXECUTED; no push/dispatch |

Build diagnosis: sandbox loopback/process restrictions caused the original Turbopack failure, and failed generated .next artifacts kept reproducing it after permissions changed. Moving generated artifacts to /tmp and performing a clean permitted build resolved it. Direct Next TypeScript helper output and direct tsc showConfig were valid; a clean permitted webpack build also passed. No source security protections were relaxed. ESLint now ignores generated coverage/Playwright output; it still checks application/test sources with zero warnings.

### Defects/remediation discovered during verification

- Comparison restoration could finish after a newer user edit; revision checks now prevent overwriting current selections. Empty restore does not clear a newly edited list.
- Smoke search clicked stale initial results before debounced filtering; assertions now wait for the Synthetic query and the expected matching result. This strengthens the searched-record assertion.
- Sharing test used obsolete non-canonical seed aliases and after-load snapshot injection; now it loads mocked current records through the shared URL. Old snapshot restoration has its separate browser regression.
- Predictor smoke expected invented demo cutoffs to generate production advice. Updated it to assert rank/percentile validation plus exclusion of those cutoffs, not fictional admission explanations. Scoped validation-alert locator avoids confusing Next's route announcer with the field error.
- Runtime environment validator was still unused. Prisma construction now validates it, pool bounds and secret minimum; optional empty service entries are normalized. Two unit tests exercise errors/caching without exposing values.
- Public advisory audit initially found7 production vulnerabilities including critical Next.js. Installed Next/eslint-config-next16.4.6 and ran compatible `npm audit fix --ignore-scripts`; regenerated Prisma client. No forced major upgrade or security feature removal. package.json/lockfile capture fixes (including Prisma7.10.1/transitives).
- CI previously omitted the new explicit test confirmation and E2E. Workflow now verifies its fresh local service before migration, runs independent upgrade/restore/browser DB steps and installs the matching browser. This is prepared, locally parsed workflow code; no remote pass is claimed.

### Performance and limits

Latest desktop-context five-request catalogue API sample: median71.1ms, max724.8ms. Pixel7-context sample: median36.0ms, max302.6ms. Earlier full-run samples:47.0/524.4ms and26.1/208.2ms. These include local server/DB/contention/cold effects; they are not production latency or Core Web Vitals claims. Post-projection filters fetch matched candidates before filtering/pagination; real deployment scale/load, network throttling and 80% branch coverage goals remain unaccepted. No fabricated college fact was added; all browser fixture institutions/cutoffs were synthetic in the isolated E2E DB.

### Requirement-by-requirement acceptance

| Phase 2 requirement | Status |
| --- | --- |
| Explicit disposable target and pre-client/reset guards | PASS local guard tests + verified isolated execution; no runtime DB fallback |
| Clean migrations and old-schema preservation | PASS local deployment, drift, seven-table upgrade comparison |
| Reviewer decisions, audit, supersession/conflict/expiry/rejection | PASS unit + actual Prisma integration; E2E unauthorized/session paths exercised |
| Import source identity/idempotency/concurrency/recovery/atomic rollback | PASS isolated integration including retry after concurrent attempts and rollback of earlier programme writes on later conflict |
| Foreign keys and saved relationships | PASS integration, old-schema comparison, dump/restore and actual saved-comparison browser refresh |
| Public field projection/filtering/unsafe-data isolation | PASS local unit/integration/API/browser scenarios; exhaustive future field types and production-scale performance remain outside this evidence |
| Desktop/mobile shared comparison and current server values | PASS browser clean contexts, refresh, malformed/missing IDs, stale snapshots, share payload, saved comparison restoration |
| Auth/authz/errors and immediate demotion | PASS local real login/save/retrieve,401 reviewer denial, authenticated403 and stale-role integration regression (final result below) |
| Lint/typecheck/unit/integration/browser/default build | PASS local; prepared CI not remotely executed |
| Dependency security | PASS public npm advisory audit after same-major compatible fixes; owner-side historical secret rotation/revocation remains UNVERIFIED |
| Backup/rollback safety | PASS disposable upgrade dump/restore and compatible old-column reads; no production backup/restore or rollout approved |
| Coverage target/performance acceptance | PARTIAL: measured coverage below proposed80% branch target in several changed modules; local HTTP samples only, no production SLA acceptance |
| Production protections/credential remediation | BLOCKED on owner evidence, not on local tooling: rotation/revocation timestamps, provider access review, actual seed/Redis/deployment protection configuration and production backup evidence must be supplied without secrets |

Phase 2 remains pending coverage/risk and owner operational acceptance; do not start Phase 3 or deploy these changes.

### Reproducible local commands (fresh disposable resources only)

These commands use publicly documented local test credentials, never .env runtime/production values. Run where Docker/loopback/browser subprocesses are permitted. Use a new container name; do not substitute an existing database. Run integration and E2E against separate databases.

```bash
CF_CONTAINER="collegefind-phase2-$(date +%s)"
docker run -d --name "$CF_CONTAINER" --label collegefind.disposable=phase2 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=collegefind_test -p 127.0.0.1::5432 postgres:16
until docker exec "$CF_CONTAINER" pg_isready -U postgres; do sleep 1; done
CF_PORT="$(docker port "$CF_CONTAINER" 5432/tcp | cut -d: -f2)"
test "$(docker inspect --format '{{index .Config.Labels "collegefind.disposable"}}' "$CF_CONTAINER")" = phase2
test "$(docker exec "$CF_CONTAINER" psql -U postgres -d collegefind_test -Atqc "SELECT current_database() || '|' || current_user || '|' || (SELECT count(*) FROM information_schema.tables WHERE table_schema='public')")" = 'collegefind_test|postgres|0'
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:$CF_PORT/collegefind_test"
export DIRECT_URL="$DATABASE_URL" TEST_DATABASE_URL="$DATABASE_URL"
export COLLEGEFIND_TEST_DATABASE_CONFIRMED=true
export NEXTAUTH_SECRET=local-fixture-secret-at-least-32-characters
export NEXTAUTH_URL=http://127.0.0.1:3100 NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3100
export UPSTASH_REDIS_REST_URL='' UPSTASH_REDIS_REST_TOKEN=''
npm ci
npm run db:deploy
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
npm run lint
npx tsc --noEmit --incremental false
npm test
npm run test:integration
npm run test:coverage -- --maxWorkers=2

docker exec "$CF_CONTAINER" createdb -U postgres collegefind_upgrade_test
TEST_DATABASE_URL="${DATABASE_URL%/*}/collegefind_upgrade_test" npx tsx scripts/verify-phase2-upgrade.ts
docker exec "$CF_CONTAINER" pg_dump -U postgres -d collegefind_upgrade_test -Fc > /tmp/collegefind-upgrade.dump
docker exec "$CF_CONTAINER" createdb -U postgres collegefind_restore_test
docker cp /tmp/collegefind-upgrade.dump "$CF_CONTAINER":/tmp/upgrade.dump
docker exec "$CF_CONTAINER" pg_restore -U postgres -d collegefind_restore_test /tmp/upgrade.dump
docker exec "$CF_CONTAINER" psql -U postgres -d collegefind_restore_test -Atqc 'SELECT count(*) FROM "SavedComparison"'

docker exec "$CF_CONTAINER" createdb -U postgres collegefind_e2e_test
# Confirm empty before using this separately provisioned DB.
docker exec "$CF_CONTAINER" psql -U postgres -d collegefind_e2e_test -Atqc "SELECT current_database(),current_user,(SELECT count(*) FROM information_schema.tables WHERE table_schema='public')"
export DATABASE_URL="${DATABASE_URL%/*}/collegefind_e2e_test" DIRECT_URL="${DIRECT_URL%/*}/collegefind_e2e_test"
npm run db:deploy
SEED_SYNTHETIC_CUTOFFS=true npm run db:seed
npm run build
npx playwright install --with-deps chromium
npm run test:e2e -- --workers=2
# Optional independent clean bundler diagnosis: move .next aside first.
npx next build --webpack
npm audit --omit=dev --audit-level=high
# Remove only the named disposable container after retaining desired evidence.
docker rm -f "$CF_CONTAINER"
```

For CI, the prepared workflow runs the equivalent isolated operations using its own PostgreSQL service. Remote execution still requires a separately authorized push/PR or workflow run; none was performed.


Final verification additions: `npm run test:integration` after adding stale-ADMIN demotion coverage passes **46 tests/5 files**. Unit total is **66** (64 prior plus two runtime-env cases). Full browser suite passes26; the enhanced real-session flow (authenticated403 plus save/retrieve/saved-comparison refresh) initial targeted rerun failed because its loose URL assertion matched /colleges inside the login callback query before login completed. Tightened it to assert the actual pathname; corrected rerun results follow. The111-case coverage run predates the last demotion case; its exact coverage percentages above remain a snapshot, not a112-case coverage claim.

Additional files changed during this verification turn: `.github/workflows/ci.yml`, `package.json`, `package-lock.json`, `eslint.config.mjs`, `scripts/verify-phase2-upgrade.ts`, `src/context/CompareContext.tsx`, `src/lib/env.ts`, `src/lib/prisma.ts`, `tests/unit/env.test.ts`, `tests/unit/integration-target.test.ts`, `tests/integration/api-security.test.ts`, `tests/integration/public-projection.test.ts`, `tests/e2e/fixtures.ts`, `tests/e2e/smoke.spec.ts`, `tests/e2e/comparison.spec.ts`, `AGENTS.md`, `docs/UPGRADE_PLAN.md`, `docs/PHASE2_MIGRATION.md`, this status file. Prior Phase2 changes retained. CI YAML parses locally. Generated coverage files are ignored by lint, avoiding a generated-file warning without suppressing source diagnostics.

Accepted final browser rerun after strengthening login pathname synchronization: **26/26 PASS,12.5s**, including authenticated403 for both desktop/mobile, saved comparison creation/restoration and refresh. Performance sample from that run: desktop median38.9ms/max553.3ms; mobile median28.4ms/max241.9ms. The intermediate two-test failure is retained above as test-harness evidence, not an accepted pass. Final lint/typecheck/diff checks pass.

Remaining access: local tooling restrictions were resolved with narrow permitted execution; PostgreSQL, Chromium and build verification are no longer blocked. Finishing operational acceptance requires owner-supplied evidence of historic credential rotation/revocation, production backup/restore and actual deployment/seed/Redis protection configuration. No production secret values are needed. Coverage improvements (or explicit acceptance of the measured shortfall) and agreed deployment-scale performance criteria are also outstanding; they are not hidden behind an environment blocker.

Cleanup: verified the disposable container ID/label again, then removed only `collegefind-phase2-verify-20261117` after tests. Ignored coverage/browser reports and `/tmp/collegefind-phase2-*` logs/fixture dump remain available locally. Reproducible commands provision new databases; no running local test service is required to keep the recorded evidence valid.

## Phase 2 coverage, performance and security follow-up — 2026-11-17

This entry supersedes the earlier 111-test coverage snapshot and five-request performance samples above. It covers this follow-up only; no application or schema source changed in this increment. Phase 2 remains **INCOMPLETE** and Phase 3 remains **NOT STARTED**.

### Changes in this increment

- Added `tests/unit/auth.test.ts` and `tests/unit/session.test.ts` for invalid credentials, rate-limit denial, dummy-hash timing behavior, deleted accounts, persisted role refresh, demotion denial and JWT/session defaults.
- Added `tests/unit/admin-evidence-route.test.ts` for reviewer denial, CSRF/origin rejection, invalid payloads, rate limiting, field/typed service dispatch and no-store responses.
- Added `tests/unit/field-evidence.test.ts` for unsupported/reviewed claims, bad validity periods, source mismatch, cross-field supersession, stable identity and typed-record audit linkage.
- Expanded `tests/unit/public-evidence.test.ts`, `tests/unit/public-search.test.ts`, and `tests/unit/comparison.test.ts` for unsafe/outdated sources, malformed typed values, comparable fees, filter boundaries and null-safe winner selection.
- Added `tests/unit/josaa-parser.test.ts` for bad quota/gender/rank ranges, duplicate natural keys and invalid mappings.
- Expanded `tests/integration/api-security.test.ts` for canonical saved-comparison signatures, current server-side record restoration, deleted IDs, duplicate signatures and the per-user limit.
- Updated only this status file for this increment; earlier application, migration and data files remain as recorded above.

The comparison API integration assertion initially expected a `signature` property in the create response. That response deliberately selects only ID, college IDs and timestamp; the corrected test reads and verifies the persisted canonical signature from PostgreSQL. No application defect was found.

### Latest executed checks

| Command / check | Result |
| --- | --- |
| `npm run test:coverage -- --maxWorkers=2` | **PASS:** 137 tests / 21 files (89 unit, 48 PostgreSQL integration); 77.18% statements, 73.69% branches, 78.77% functions, 80.21% lines. Run used the independently confirmed disposable PostgreSQL integration database. |
| `npm test -- --maxWorkers=2` | **PASS:** 89 unit tests / 16 files. |
| `npx vitest run --project integration tests/integration/api-security.test.ts` | **PASS:** 25 tests, including saved-comparison API restoration and limit cases. |
| `npm run lint` | **PASS:** zero errors and warnings on final run. An earlier run failed only for an unused test import; final rerun passed after removal. |
| `npm run typecheck` | **PASS:** final run after test additions. |
| `git diff --check` | **PASS.** |
| Build, Prisma generation, migration deployment/drift, dump/restore, `npm audit`, Playwright | Not rerun in this tests-only increment. Latest successful evidence remains the previous section: builds, Prisma generation, isolated migration/upgrade/restore, zero npm advisories and 26/26 desktop/mobile Playwright tests. No application/schema input changed since those checks. |
| Remote GitHub CI / production HTTP | **NOT TESTED:** no push/dispatch, production request or deployment change was authorized. |

### Coverage findings from the final V8 HTML report

The planned 80% line and branch goal is met on the principal Phase 2 trust boundaries:

| Critical module | Lines | Branches |
| --- | ---: | ---: |
| `src/lib/session.ts` | 100% | 100% |
| `src/lib/auth.ts` | 100% | 81.81% |
| `src/app/api/admin/evidence/route.ts` | 100% | 100% |
| `src/server/public-evidence.ts` | 100% | 88.88% |
| `src/server/ingest/field-evidence.ts` | 100% | 87.5% |
| `src/server/ingest/josaa.ts` | 97.22% | 87.96% |
| `src/server/public-search.ts` | 100% | 92.64% |
| `src/app/api/comparisons/route.ts` | 100% | 83.33% |
| `src/lib/data-visibility.ts` | 100% | 92.3% |

The 80/80 requirement is **not met for every changed module**. Examples: `src/server/colleges.ts` 60.6% lines / 59.52% branches; `src/lib/prisma.ts` 76.31% / 63.63%; `src/app/api/comparisons/[id]/route.ts` 85.71% / 50%; `src/app/api/admin/moderation/route.ts` 90% / 50%; `src/app/api/seed/route.ts` 92.85% / 78.57%. Some page/component code is outside `vitest.config.mts` coverage includes. Existing browser scenarios verify key user flows but do not remove this gap. Coverage acceptance is therefore **FAIL/PARTIAL**, while the named critical trust-boundary modules pass. Next coverage work should target authorization/error branches in the comparison-item, moderation and seed routes, plus query/projection variants in `server/colleges.ts` and `lib/prisma.ts`; keep tests behavior-driven.

Negative-case inventory is represented by executed tests: invalid DB targets and pre-client guards; invalid search/body fields; anonymous and demoted-admin requests; stale/deleted comparison IDs and current-record reload; rejected/conflicting/expired/superseded evidence; changed-import conflict, failed-run persistence, concurrent retry and transaction rollback; nested demo metrics excluded from public outputs. The combined coverage run includes the database tests. Prior 26/26 Playwright evidence covers desktop/mobile shared URL refresh, stale local snapshots, authenticated save/retrieve, reviewer denial, search, outage/error and unsafe demo-data exclusion.

### Reproducible local performance gate

For the **205-row local catalogue gate only**, require three warmed runs of 200 requests each at concurrency 10 against a fresh disposable PostgreSQL database seeded by `npm run db:seed`. Mix these paths evenly: `GET /api/colleges?limit=20&page=1`, `?search=IIT&limit=20&page=1`, `?state=Kerala&limit=20&page=1`, and `?maxFees=500000&limit=20&page=1`. Pass each run only if all responses are HTTP 200, p95 <= 250 ms and p99 <= 500 ms. This is a local regression budget, not a production SLA.

Measured against clean disposable PostgreSQL 16 database `collegefind_load_test`, after migrations and seeding exactly 205 `DEMO` colleges (0 FieldEvidence, 0 CutoffRecord, 0 Program rows), using the existing Next.js 16.4.6 production build bound only to `127.0.0.1:3100`, Node fetch on the same host, eight warm-ups per run, and no other load:

| Run | Requests / concurrency | p50 | p95 | p99 | max | Throughput | non-200/errors |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 200 / 10 | 82.6 ms | 106.1 ms | 145.5 ms | 150.9 ms | 116.4 req/s | 0 |
| 2 | 200 / 10 | 76.1 ms | 88.9 ms | 92.5 ms | 99.5 ms | 130.5 req/s | 0 |
| 3 | 200 / 10 | 73.6 ms | 89.5 ms | 106.0 ms | 107.6 ms | 133.1 req/s | 0 |

Local 205-row gate: **PASS (3/3)**. Production/network/Core Web Vitals, concurrent DB contention, 2,000+ catalogue scale and cold-start behavior are **NOT TESTED**. This benchmark used demo records only and is not evidence of enrichment accuracy or production-scale capacity. The seed JSON remained byte-identical at SHA-256 `a9321b82b6f390790e09a647dfaf589b90c5736819aed6b9a5908922bfcc1637`.

To repeat, provision a newly labeled disposable PostgreSQL container, confirm the empty database identity and loopback-only port, apply migrations and seed a separate load database, start the built server with `--hostname 127.0.0.1`, then run this Node command:

```bash
node <<'NODE'
const base='http://127.0.0.1:3100';
const paths=['/api/colleges?limit=20&page=1','/api/colleges?search=IIT&limit=20&page=1','/api/colleges?state=Kerala&limit=20&page=1','/api/colleges?maxFees=500000&limit=20&page=1'];
async function request(i){const t=performance.now();try{const r=await fetch(base+paths[i%paths.length]);const d=await r.json();return {ms:performance.now()-t,status:r.status,count:d.colleges?.length??0};}catch(e){return {ms:performance.now()-t,status:0,error:String(e)};}}
for(let run=1;run<=3;run++){for(let i=0;i<8;i++)await request(i);const all=[];let next=0;async function worker(){while(next<200)all.push(await request(next++));}const t=performance.now();await Promise.all(Array.from({length:10},worker));const elapsed=performance.now()-t;const times=all.map(x=>x.ms).sort((a,b)=>a-b);const pct=p=>times[Math.ceil(p*times.length)-1];console.log(JSON.stringify({run,requests:all.length,concurrency:10,rps:+(all.length/(elapsed/1000)).toFixed(1),errors:all.filter(x=>x.status!==200).length,p50:+pct(.5).toFixed(1),p95:+pct(.95).toFixed(1),p99:+pct(.99).toFixed(1),max:+times.at(-1).toFixed(1)}));}
NODE
```

The server was stopped and the exact disposable container ID/label/loopback mapping was checked before cleanup. A cleanup approval review timed out once; one retry was approved and removed only the container created for this run. No other database/container was accessed.

### Security evidence and owner-side checks

Repository/code evidence only; no secrets or production values were read:

- `src/app/api/seed/route.ts` returns 404 unless seeding is enabled, also requires explicit production allowance in production, enforces a >=32-character bearer token, rate-limits requests, rejects synthetic production seed requests, inserts only missing demo colleges and audits runs. This proves code controls, **not** Vercel variable values.
- `src/lib/rate-limit.ts` uses Upstash only when both variables exist; otherwise it falls back to per-instance memory, and Redis errors also fail open to memory. Production-wide rate limiting is therefore unproven. The seed bearer check is a separate code gate.
- `src/lib/session.ts` reloads account and current role from PostgreSQL, so deletion/demotion is enforced even with a stale JWT. `docs/SECURITY.md` still says role changes take effect only after re-login; that statement is stale. The same document recommends history rewriting, which is not authorization to rewrite history.
- `vercel.json` proves only the Next.js framework, `bom1` region and `npm run vercel-build`; it contains no public production URL, secret-presence evidence, protected-environment settings, Redis configuration or backup policy.
- CI's credential scan inspects the checked-out worktree patterns, not historical blobs. Although it checks out full history, no history-scanning command is present. The audit job is `continue-on-error: true` and critical-only; the earlier local `npm audit --omit=dev --audit-level=high` found zero advisories, but remote CI was not run.
- `docs/SECURITY.md` identifies a historical PostgreSQL credential and `NEXTAUTH_SECRET` disclosure at commit `9b159ec`. Values were not displayed, extracted, tested or copied. Rotation/revocation and impact review remain **BLOCKED on owner evidence**.

Owner must provide non-secret evidence before production-security acceptance:

1. Confirm the disclosed DB credential was rotated and revoked at the provider; supply rotation/revocation timestamps and access-review outcome, never the credential.
2. Confirm `NEXTAUTH_SECRET` was replaced in every active environment, record the change time, and verify old sessions no longer authenticate using a disposable test account. Do not send either secret.
3. From deployment settings or sanitized configuration, confirm seeding is disabled in production. Do not invoke the live seed endpoint.
4. Confirm Upstash variable presence (names only) for every production deployment, record Redis health and safe staging rate-limit behavior, including explicit fail-open policy acceptance.
5. Provide backup cadence/retention/access/encryption policy and latest isolated restore-drill date/result with measured RPO/RTO and relationship checks. Do not supply production dumps or user data.
6. Provide deployed SHA and deployment-protection evidence; authorize any non-destructive production HTTP/browser smoke separately. No production URL was tested in this turn.

### Phase 2 acceptance checklist (current)

| Acceptance criterion | Status | Evidence / remaining action |
| --- | --- | --- |
| Explicit disposable DB confirmation, validation before clients/resets, no runtime fallback | **PASS** | constructor/import-order guard tests and isolated local PostgreSQL runs recorded above |
| Clean migrations, schema drift, previous-schema compatibility, relationships and recovery | **PASS (local only)** | clean deploy/drift, seven-table old-schema preservation, disposable dump/restore; no production backup/migration claim |
| Field evidence, review authorization/audit, conflict/expiry/rejection/supersession | **PASS (local only)** | unit + actual Prisma integration tests and reviewer API errors; no college has been newly enriched |
| Import identity, idempotency, concurrency, failure and rollback | **PASS (local only)** | PostgreSQL tests include retry, concurrency, conflict-preserved history and transaction rollback |
| Public projection and demo isolation in filters, comparisons, predictor and outputs | **PASS for tested local paths** | projection/search/predictor tests, desktop/mobile unsafe-data E2E; 205-row benchmark contained DEMO only |
| Shared/saved comparison round-trip, canonical IDs, deleted IDs and current records | **PASS** | previous desktop/mobile 26/26 Playwright plus current PostgreSQL GET/POST, stale-ID, duplicate and cap regressions |
| Authentication, authorization, ownership, error states and existing desktop/mobile flows | **PASS for tested paths** | current 89-unit/48-integration combined run and previous 26/26 browser run; full account recovery/privacy/admin workflow is outside this foundation |
| 80% line AND branch coverage for every changed module | **FAIL** | aggregate 80.21% lines but 73.69% branches; examples below target are in coverage findings above |
| Repeatable 205-row local API performance budget | **PASS (3 local runs)** | 3x 200 requests, concurrency 10, max p95 106.1ms / p99 145.5ms, zero errors under stated fixture/host conditions |
| Production-scale latency/performance | **NOT TESTED** | no production traffic, network emulation or 2,000+ dataset |
| Historical credential rotation/revocation and production configuration | **BLOCKED** | owner evidence listed above; no secret values required |
| Production seed/Redis protections and backup retention/restore readiness | **BLOCKED** | implementation controls are visible in code; deployment settings and restore drill require owner evidence |
| Latest remote CI and production HTTP health | **NOT TESTED** | requires separately authorized CI dispatch/PR or owner-approved smoke; no push/deploy/request occurred |
| 205-college source-enrichment completion/readiness | **NOT TESTED / Phase 3 prerequisite** | original seed checksum preserved; zero official research attempts or enrichment additions in this work |

**Decision:** Phase 2 implementation and isolated local verification are substantially complete, but the all-changed-module coverage gate fails and production owner-evidence gates remain blocked. Phase 2 is **not complete**. Do not begin Phase 3 until coverage is accepted and owner-controlled checks are supplied/accepted. No Phase 3 source research started.

### Exact remaining steps to close Phase 2 and prepare Phase 3

1. Add behavior-driven tests for remaining changed-module branches in `src/server/colleges.ts`, `src/lib/prisma.ts`, `src/app/api/comparisons/[id]/route.ts`, `src/app/api/admin/moderation/route.ts`, and `src/app/api/seed/route.ts`; rerun combined coverage until each agreed changed module reaches >=80% lines and branches, or obtain explicit acceptance/revision of that target. Add browser coverage where Vitest does not instrument pages/components.
2. Obtain the sanitized owner evidence above for historical credential revocation, production seed settings, distributed rate-limit configuration/health, deployed SHA/protection and protected backup/restore RPO/RTO. Keep secrets and personal data out of the evidence packet.
3. Run the prepared CI workflow against the reviewed branch SHA after separately authorized PR/dispatch; retain the actual workflow result. If separately authorized, perform a non-destructive production HTTP/browser smoke without invoking seed or migration routes.
4. Reconfirm migration and backup gates before any future production migration; this branch has no production approval.
5. Only after Phase 2 acceptance, begin the Phase 3 10-college pilot: choose a diverse cohort from the preserved manifest, establish official identity/source reuse constraints, record ten-domain research dispositions and evidence, and independently review every claim. Keep the 205-college catalogue gate open until all originals have dated research dispositions.

## Phase 2 quality follow-up — 2026-11-17

This entry supersedes the prior coverage snapshot and its list of below-threshold modules. It records coverage after behavior-driven tests were added for college query filtering, Prisma evidence visibility, similar-college recommendations and additional API security paths. No migration or production operation was performed. Phase 3 remains **NOT STARTED**.

### Coverage review and defect fixed

The prior report's uncovered paths in `src/server/colleges.ts` and `src/lib/prisma.ts` were specifically query filter combinations, establishment-year boundaries, projection of decisions before pagination/distinct, include-vs-select evidence loading, rejected/tied decisions, DEMO college projection and leaving writes untouched. Focused tests now exercise those behaviors. The similar-college API also lacked evidence-aware and null-safe fee ordering: the route relied on college-level VERIFIED status even when the projected annual-fee field was reviewed, and null candidate fees could participate in arithmetic as `NaN`. It now orders using the projected finite fee field, puts unknown-fee candidates after known values when a target fee exists, and uses a stable alphabetical fallback when the target itself is unknown. Added tests cover reviewed field values on an UNVERIFIED parent, unknown values and stale IDs.

| Critical changed module / route | Lines | Branches | Result |
| --- | ---: | ---: | --- |
| `src/server/colleges.ts` | 100% | 95.23% | PASS |
| `src/lib/prisma.ts` | 97.36% | 86.36% | PASS |
| `src/app/api/colleges/route.ts` | 100% | 85.71% | PASS |
| `src/app/api/colleges/similar/[id]/route.ts` | 100% | 90% | PASS |
| `src/app/api/comparisons/route.ts` | 100% | 83.33% | PASS |
| `src/app/api/rankings/route.ts` | 100% | 87.5% | PASS |
| `src/app/api/seed/route.ts` | 100% | 92.85% | PASS |
| `src/app/api/stats/route.ts` | 80% | 100% | PASS at line threshold |
| `src/lib/predictor/model.ts` | 96% | 80% | PASS at branch threshold |
| `src/lib/predictor/service.ts` | 98.09% | 83.33% | PASS |

The final combined V8 report is **88.4% lines, 80.95% branches, 85.97% statements and 86.53% functions**. Modules below those percentages in the global report are pre-existing, unmodified support/API modules such as `src/lib/api.ts`, logger, rate-limit, safe-redirect, utils and untested auth/health endpoints; pages and components are outside this Vitest instrumentation. This is not a claim that those unrelated modules meet 80/80. Browser UI evidence remains the prior executed 26/26 desktop/mobile Playwright tests; the current change was confined to server-side similar-college ordering and focused API/data logic, so Playwright was not rerun.

### Commands and actual results

| Exact command/check | Result |
| --- | --- |
| `npm run test:coverage -- --maxWorkers=2` | **PASS:** 156 tests / 24 files; 88.4% lines, 80.95% branches, 85.97% statements, 86.53% functions. Included PostgreSQL integration tests against the previously created and independently confirmed disposable PostgreSQL 16 container `collegefind-phase2-coverage-20261117`, mapped only to loopback. |
| `npm run lint` | **PASS:** zero ESLint errors/warnings after tightening new test types. |
| `npm run typecheck` | **PASS:** `tsc --noEmit`, after using safe test-only environment mutation for readonly `NODE_ENV` typing and typed Prisma test fixtures. |
| `git diff --check` | **PASS** before the final test-typing corrections; rerun with the status update before commit/review. |
| `npm run build` | **BLOCKED by execution environment:** Turbopack failed processing `src/app/globals.css` because its worker could not bind a local port (`Operation not permitted`, `os error 1`). Retrying with elevated sandbox execution produced the same failure. This is a sandbox worker-port restriction, not evidence of a source compile error; security protections/configuration were not weakened. The earlier successful build remains historical evidence, not a pass for this final changed tree. |
| PostgreSQL migration/integration, import recovery, browser checks | The coverage command executed the integration project on the confirmed local disposable database. No migration files changed in this increment. Prior migration/restore and 26/26 Playwright results remain the most recent execution. No production/staging database was accessed. |
| Remote main CI / deployment HTTP | **NOT TESTED:** no push, dispatch, deployment or production URL request was made. |

### Owner-side production security checklist

Repository evidence can establish code behavior only. An owner with deployment/provider access must return non-secret evidence for each item:

1. **Historical credentials:** confirm the PostgreSQL credential disclosed in historical commit `9b159ec` was rotated and revoked, and the exposed `NEXTAUTH_SECRET` was replaced in every active environment. Provide timestamps and access/session impact review only. Never provide either value; do not rewrite Git history or rotate from this task.
2. **Seed endpoint:** verify sanitized production deployment settings show seed enablement and production seed allowance disabled. Confirm deployed revision and route protection without invoking the live seed route.
3. **Distributed rate limiting:** confirm the Upstash URL/token variable names are configured (presence only), Redis health is monitored, staging requests exercise shared limits, and the code's memory fallback/fail-open behavior has explicit operational acceptance.
4. **Production database backups:** provide backup cadence, retention, encryption/access controls, and last successful backup timestamp from provider records.
5. **Restore readiness:** provide a recent restore drill into an isolated database with result, relationship/integrity checks, and measured RPO/RTO. Do not share production dumps or user data.
6. **Deployment verification:** provide deployed SHA/protection state and, only with separate approval, run a non-destructive HTTP/browser smoke against the approved public URL. No public deployment URL is configured in the repository evidence.

### Acceptance checklist — latest

| Phase 2 gate | Status | Evidence / blocker |
| --- | --- | --- |
| Critical changed-module 80% line and branch coverage | **PASS for measured changed server/data/API modules** | Table above and combined report. UI files are not in Vitest coverage; prior 26/26 Playwright is the available UI evidence. |
| Meaningful null, invalid, stale, conflict, authorization and recovery cases | **PASS for tested paths** | Added query/projection/similar-route tests plus existing auth/evidence/import/comparison integration tests in the 156-test run. |
| Lint and typecheck | **PASS** | Exact commands above. |
| Combined unit + isolated PostgreSQL integration coverage run | **PASS (local only)** | 156 tests / 24 files against the verified disposable database. |
| Final-tree production build | **BLOCKED** | Turbopack worker local port bind denied even on retry outside sandbox. Build gate not passed for this exact tree. |
| Browser suite | **PASS historically; NOT RERUN this increment** | 26/26 earlier; changed behavior is server recommendation ordering, covered by current unit/API tests. |
| Production credentials, seed configuration, Redis rate limit and backups/restore | **BLOCKED on owner evidence** | Checklist above; no production secrets/settings/resources accessed. |
| Latest main CI and production HTTP health | **NOT TESTED** | Requires authorized CI dispatch or owner-approved production smoke; no push/deploy/request. |
| 205-college official enrichment | **NOT STARTED** | Remains Phase 3; original demo catalogue is preserved. |

**Decision:** the coverage target is now met for measured critical changed server/data/API modules, and the documented local checks passed. Phase 2 is still **NOT COMPLETE** because the final-tree build is blocked and owner-controlled security/deployment verification remains outstanding. Phase 3 is **NOT READY**. Required next inputs are: owner-provided non-secret checklist evidence; an approved runner/environment where Turbopack can bind its local worker port; and authorized CI/deployment verification where required. After those gates, review the Phase 2 checklist and only then authorize the Phase 3 official-source pilot.


## Final Phase 2 verification handoff — 2026-11-17

This entry supersedes the build blocker and browser snapshot above. Phase 2 remains INCOMPLETE; Phase 3 is NOT STARTED. This increment changes only `tests/e2e/comparison.spec.ts` and this status file. No application, dependency, schema, security configuration or production resource changed.

### Build diagnosis and exact checks

The prior successful build evidence explicitly required moving failed generated `.next` artifacts aside before a permitted build. The latest failed retries had reused those artifacts. With the same installed Next 16.4.6, Node v22.23.2, Tailwind 3.4.19 and PostCSS 8.5.33, clean builds now pass. The evidence supports environment port restrictions plus stale generated artifacts as the cause; no dependency or application defect was reproduced. Clean builds isolate this from source compilation. No security settings were changed.

Commands executed, in order:

1. `docker run --name collegefind-phase2-handoff -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=collegefind_e2e_test -l collegefind.disposable=phase2 -p 127.0.0.1::5432 -d postgres:16` — created disposable container `c9ec6b63364beacc33ab10ff8bd02d3a5a3ea85d1a39a6d63f176a009f8c10a4`.
2. `docker inspect` of that exact container confirmed label `phase2` and only `127.0.0.1:32771`; `docker exec collegefind-phase2-handoff psql -U postgres -d collegefind_e2e_test -Atqc ...` independently returned database `collegefind_e2e_test`, user `postgres`, zero public tables. Only then set disposable confirmation.
3. Set DATABASE_URL, DIRECT_URL and TEST_DATABASE_URL to the public local fixture `postgresql://postgres:postgres@127.0.0.1:32771/collegefind_e2e_test`; set `COLLEGEFIND_TEST_DATABASE_CONFIRMED=true`, dummy local auth secret, localhost:3100 auth/site URLs, empty Upstash variables and telemetry disabled. These overrides were stored in `/tmp/collegefind-handoff-env.sh`; no runtime credential was read or displayed.
4. `if [ -d .next ]; then mv .next /tmp/collegefind-next-before-handoff-$(date +%s); fi` — retained failed generated artifacts outside the repository.
5. `. /tmp/collegefind-handoff-env.sh; npm run db:deploy && SEED_SYNTHETIC_CUTOFFS=true npm run db:seed && npm run build` — PASS: all three migrations, 205 demo colleges and 240 synthetic cutoff records in the disposable database; clean Turbopack compiled in 3.6s and completed TypeScript/static generation successfully.
6. `mv .next /tmp/collegefind-turbo-handoff-success`; `. /tmp/collegefind-handoff-env.sh; npx next build --webpack` — PASS: independent clean webpack build, compiled in 7.2s, completed TypeScript, static generation and traces. Generated webpack build used for browser run.
7. `. /tmp/collegefind-handoff-env.sh; npm run test:e2e -- --workers=2` — final PASS: **29 passed, 1 deliberately skipped desktop-only instance of the mobile drawer test**, 11.5s. Desktop Chromium and Pixel 7 emulation against local production server, isolated fixture DB. Initial run had 28 passes, one intentional skip and one new-test locator failure (selected footer link behind drawer); corrected locator to the drawer, no application change, full rerun passed.
8. `npm run lint && npm run typecheck` — PASS. `git diff --check` — PASS. The 156-test / 88.4% line / 80.95% branch evidence is retained; no server source changed, so coverage/integration suite was not repeated.
9. `sha256sum src/server/seed/demo-colleges.json` — unchanged `a9321b82b6f390790e09a647dfaf589b90c5736819aed6b9a5908922bfcc1637`.

Browser coverage rechecks search/details/404, unsafe demo data, predictor denial, login/save/retrieve/ownership, shared comparison serialization, clean context and refresh restoration, stale snapshots, invalid/deleted IDs, reviewer 401/403, catalogue outage messaging, keyboard access and mobile drawer navigation. Added real-HTTP check confirms demo peers are absent from recommendations and demo detail pages remain labeled. Known-fee recommendation ordering remains covered by existing unit tests; the browser fixture has no reviewed fees and does not establish positive reviewed-fee ordering. Five-request timings printed by existing E2E are smoke diagnostics only; retain the earlier 600-request performance gate.

### Repository security evidence and required owner packet

- Seed route (`src/app/api/seed/route.ts`): default-off 404; production requires separate explicit allowance; minimum 32-character token checked by hashed timing-safe comparison; rate limiting before bearer check; synthetic production seed rejected; insert-missing behavior and audit. Deployed settings remain unverified. Owner must confirm seed enablement and production allowance are disabled, with sanitized setting names/states and deployed SHA; never invoke live seed for this check.
- Rate limiting (`src/lib/rate-limit.ts`): missing Redis settings and Redis request failure fall back to local memory, with warning/error logging. This is **not distributed fail-closed enforcement**. Owner must show variable presence only, sanitized Redis health/monitoring, safe staging multi-instance and outage test results, and explicit acceptance of fallback policy or separately authorize a policy change. Repository inspection cannot verify Redis connectivity.
- Historical disclosure: owner must supply provider revocation/rotation timestamps for the disclosed database credential, confirmation old credential is revoked without sending/testing it here, affected environment inventory, access-log review outcome, and session-secret replacement timestamps across active environments plus old-session invalidation evidence using a disposable account. Never provide credential values or historical blobs.
- Backups: owner must supply provider backup/PITR enablement, cadence, retention, encryption/access policy, latest successful backup timestamp, latest isolated restore-drill date/result, measured RPO/RTO and relationship checks. Local fixture restore proves tooling only, not production backup readiness.
- Deployment: sanitized deployed SHA, environment protection state and separately approved public HTTP/browser smoke remain outstanding. No production access or credential extraction occurred.

### Requirement-by-requirement disposition

| Phase 2 acceptance criterion | Status | Evidence / remaining gate |
| --- | --- | --- |
| Disposable target guards before clients/destructive operations; no runtime fallback | PASS | Previously executed constructor/import-order/unit guards; new independently verified empty local fixture |
| Additive migrations, previous schema compatibility, preserved IDs/relationships | PASS locally | Prior compatibility/restore tests; all three migrations applied to fresh isolated DB this run |
| Field evidence validity, conflicts, review authorization/auditing, supersession/rejection | PASS for tested paths | Prior real PostgreSQL integration and unit results; current reviewer denial browser checks |
| Import idempotency, source identity, concurrency, partial failure and rollback | PASS locally | Retained executed integration evidence; not repeated without source changes |
| Demo isolation and unknown handling across public paths | PASS for tested paths | Retained projection/filter/predictor tests plus current real HTTP/UI unsafe-data tests |
| Comparison sharing/current-record restore, refresh/deleted/invalid IDs | PASS | Current desktop/mobile suite |
| Auth, saving, retrieval, denial, errors and mobile navigation | PASS for tested paths | Current desktop/mobile suite, 29 pass/1 intentional skip |
| Clean production build | PASS | Both clean Turbopack and webpack builds this run |
| Lint/typecheck and combined 156-test suite | PASS | Current static checks; retained unchanged-server test results |
| Aggregate coverage >=80% lines/branches | PASS | Retained 88.4%/80.95% |
| Every changed module >=80% lines AND branches | PASS for measured modules | `src/server/ingest/evidence.ts` now reaches 96.42% lines and **88.88% branches** after behavior-focused optional-date, future-validity, conflicting-review and complete transition-matrix cases. UI modules remain outside Vitest instrumentation and retain prior browser evidence. |
| Local 205-row performance budget | PASS | Prior three 200-request runs; no source change affecting benchmark |
| Production scale/network performance | NOT TESTED | Local benchmark is not production capacity evidence |
| Historical credential remediation | BLOCKED | Owner non-secret packet above |
| Production seed/Redis configuration and outage policy | BLOCKED | Owner settings/connectivity/policy evidence above |
| Production backup retention and restore readiness | BLOCKED | Owner backup/restore evidence above |
| Remote CI / deployed HTTP health | NOT TESTED | No authorized push/dispatch/deployment or production access |

The build blocker is resolved. This follow-up closes the evidence-service coverage gap; combined coverage is now 88.4% lines and 81.64% branches (159 tests, 24 files). Locally executed checks pass. Owner-controlled production security and deployment evidence remains blocked/unavailable as listed above. Phase 2 still requires owner evidence and final acceptance review before Phase 3 enrichment. No Phase 3 research or implementation occurred.

### Git handoff inventory

Branch: `phase-2-safety-integrity`. HEAD: `3ddf88d7f0dec224cde1984100e9208ce6285328` (`ci: fix prisma migrate diff for Prisma 7, scope audit to production deps`). `git log main..HEAD` is empty: no new commits; all Phase 2 changes remain uncommitted. Pre-existing `CollegeFind_AGENTS_V3.md` was preserved untouched. Exact tracked changes and untracked files below were captured with `git diff --name-only` and `git ls-files --others --exclude-standard`:

```text
TRACKED MODIFICATIONS
.github/workflows/ci.yml
docs/TESTING.md
eslint.config.mjs
package-lock.json
package.json
prisma/schema.prisma
scripts/ingest-josaa.ts
src/app/api/colleges/featured/route.ts
src/app/api/colleges/route.ts
src/app/api/colleges/similar/[id]/route.ts
src/app/api/rankings/route.ts
src/app/api/stats/route.ts
src/app/colleges/[id]/page.tsx
src/app/colleges/page.tsx
src/app/compare/page.tsx
src/app/courses/[slug]/page.tsx
src/app/page.tsx
src/app/rankings/page.tsx
src/app/saved/page.tsx
src/components/RadarChart.tsx
src/context/CompareContext.tsx
src/lib/env.ts
src/lib/predictor/service.ts
src/lib/prisma.ts
src/lib/session.ts
src/server/colleges.ts
src/server/ingest/josaa.ts
src/types/index.ts
tests/e2e/smoke.spec.ts
tests/integration/api-security.test.ts
tests/integration/db.ts
tests/integration/josaa-ingest.test.ts
tests/integration/setup.ts
tests/unit/predictor-service.test.ts

UNTRACKED
AGENTS.md
CollegeFind_AGENTS_V3.md
docs/PHASE2_MIGRATION.md
docs/UPGRADE_PLAN.md
docs/UPGRADE_STATUS.md
prisma/migrations/20261117000000_field_evidence_import_runs/migration.sql
scripts/verify-phase2-upgrade.ts
src/app/api/admin/evidence/route.ts
src/lib/comparison.ts
src/lib/data-visibility.ts
src/server/ingest/evidence.ts
src/server/ingest/field-evidence.ts
src/server/ingest/identity.ts
src/server/public-evidence.ts
src/server/public-search.ts
tests/e2e/comparison.spec.ts
tests/e2e/fixtures.ts
tests/integration/evidence.test.ts
tests/integration/public-projection.test.ts
tests/integration/target.ts
tests/unit/admin-evidence-route.test.ts
tests/unit/auth.test.ts
tests/unit/college-query.test.ts
tests/unit/comparison.test.ts
tests/unit/data-foundation.test.ts
tests/unit/env.test.ts
tests/unit/evidence-review.test.ts
tests/unit/evidence.test.ts
tests/unit/field-evidence.test.ts
tests/unit/integration-target.test.ts
tests/unit/josaa-parser.test.ts
tests/unit/prisma-visibility.test.ts
tests/unit/public-evidence.test.ts
tests/unit/public-search.test.ts
tests/unit/session.test.ts
tests/unit/similar-route.test.ts
```

Cleanup: after the browser server exited, rechecked the exact container ID, `phase2` label and loopback-only port with `docker inspect`, then `docker rm -f c9ec6b63364beacc33ab10ff8bd02d3a5a3ea85d1a39a6d63f176a009f8c10a4` successfully removed only this disposable fixture. Final lint/typecheck and `git diff --check` passed after the corrected mobile locator. No production resources were accessed.

### Evidence validation coverage follow-up

Added behavior tests in `tests/unit/evidence.test.ts` for malformed optional publication/validity dates, reversed validity windows, future-start evidence, unreviewed claims, simultaneous approve/reject decisions, later rejection overriding approval, and every allowed/denied import-run transition pair. No defect was found; implementation and coverage settings were unchanged.

- `npm test -- --maxWorkers=2 tests/unit/evidence.test.ts`: **PASS**, 9 tests.
- First `npm run test:coverage -- --maxWorkers=2` without DB variables: integration setup refused to run, as designed; 5 integration suites failed before tests, 103 unit tests passed. This was a configuration guard result, not a product test failure.
- Created a new PostgreSQL 16 container labeled `collegefind.disposable=phase2`; independently confirmed empty `collegefind_test`, `postgres` role and loopback-only port `127.0.0.1:32772` before setting the explicit test confirmation. `npm run db:deploy`: **PASS**, all 3 migrations.
- With `DATABASE_URL`, `DIRECT_URL`, `TEST_DATABASE_URL` set only to that fixture and `COLLEGEFIND_TEST_DATABASE_CONFIRMED=true`, `npm run test:coverage -- --maxWorkers=2`: **PASS**, 159 tests / 24 files. Overall 88.4% lines, 81.64% branches, 86.21% statements, 86.53% functions. `src/server/ingest/evidence.ts`: **96.42% lines, 88.88% branches**.
- `npm run lint`: **PASS**; `npm run typecheck`: **PASS**; `git diff --check`: **PASS**.
- Prior clean Turbopack/webpack builds and 29-pass/1-skip Playwright run remain applicable: this increment changed only unit tests and status documentation. Database fixture was isolated and used only for migration and integration coverage. Production requirements remain owner-blocked: historic DB credential revoke/rotation and NEXTAUTH_SECRET replacement evidence; sanitized production seed-off settings; Upstash presence, health, staging shared-limit/outage exercise and fallback policy acceptance; backup retention/encryption/access and isolated restore-drill evidence with RPO/RTO. No secrets or production systems were accessed.

## Phase 3 fixture enrichment foundation — local increment

Branch `phase-3-catalogue-enrichment` starts from recoverable Phase 2 commit `19d8c91`. Pre-existing `CollegeFind_AGENTS_V3.md` remains untracked and untouched. Real institutions enriched: **0**. No official source material imported. Catalogue remains 205 DEMO/MISSING entries as recorded in `docs/DATA_COVERAGE.json`; fixture imports never count as real coverage. Owner-side Phase 2 credential, production seed/Redis and backup/restore release blockers remain unchanged.

Implemented:
- Additive InstitutionAlias relation with internal college ID, namespace (AISHE/AICTE/UGC/NIRF/JoSAA/NAME), campus scope, validity dates and source URL; existing college IDs/slugs and relationships preserved. Multiple candidates return AMBIGUOUS instead of automatic merge. Admin alias endpoint audits reconciliation and rejects competing mappings transactionally.
- Fixture adapter and CLI: strict input envelope, row rejection report, exact slug/alias matching, default dry-run, source checksums, identical-content run/claim deduplication, changed-content versions, staged evidence snippets/locators, audit trail and transaction rollback. No automatic supersession/publication. Fixture CLI requires the explicit disposable DB guard before client construction.
- Admin-only `/admin/enrichment` recent-runs/claim dashboard with source links, fixture labels, dates, stale flags, decision history and approve/reject controls. Existing origin/rate-limit/current-role/audit controls protect mutations. Server refuses fixture approvals; public projection independently excludes fixture claims.
- DATA_COVERAGE documents include all 205 original records, explicit status vocabulary, source-policy register, operating commands and prioritized backlog. AISHE permissions and JoSAA/NIRF unresolved reuse/access restrictions remain blocked, without interpreting public access as bulk redistribution permission.

Verification:
- Fresh PostgreSQL16 container `57f3e5073ba80476810f069867ebb328ac17d6abd5966343e5d75e95d1488d49`, label `phase3`, loopback `127.0.0.1:32773`; independently confirmed database `collegefind_test` had zero public tables before confirmation.
- `npx prisma generate`: PASS.
- `npm run db:deploy`: PASS, all four migrations on empty disposable DB including additive identity/fixture fields.
- `npm run test:all -- --maxWorkers=2`: final PASS, **161 tests / 25 files**. Initial run caught two test-fixture defects (old review mock missing claim lookup; user fixture used wrong password field/name), fixed without weakening application guards.
- `npx vitest run --project integration tests/integration/catalogue.test.ts`: PASS **2/2**, after expanding assertions for changed-content versions and unauthorized decisions. Tests cover dry-run no writes, rejected rows, ambiguous pure matching, repeated imports, fixture-approval denial, rejection audit and actual transaction rollback when audit persistence fails after staging.
- `npx tsx scripts/ingest-catalogue.ts --file /tmp/collegefind-phase3-cli-fixture.json` then same with `--apply`: PASS dry-run and stage of one clearly fictional row against the isolated fixture college, zero rejections. No public real-college enrichment.
- `npm run lint` and `npm run typecheck`: PASS; `npm run build`: PASS clean local Turbopack (compiled 5.7s), including new admin routes. Fixture DB overrides only; no production request.
- No Playwright execution for new admin workflow yet. Existing UI regression evidence is historical; build success is not an admin UI end-to-end pass.

Remaining limits: alias management has authenticated API but no entry form; the dashboard shows latest100 claims/latest20 runs rather than complete paginated coverage; conflicts are retained as competing claims/issues rather than a dedicated grouped resolution UI. Alias writes have authorization/audit code but no route-level browser/integration test yet. Future provider policy gates must be implemented before enabling any real-source adapter; current adapter accepts only explicit fixtures. Only profile fields are staged here; programme/seat/fees/placement-specific adapters must reuse typed tables with their own validators before supported real imports. Field/year/source changes create immutable versions but no automatic approval or supersession. Name/campus alias history supports storage; historical-date reconciliation is not yet implemented. No real 20–30-college pilot is ready.

Migration/rollback: additive only, no backfill, ID mutation or existing-row deletion. Retain new columns/table when reverting application code; do not drop fixture markers while fixture claims exist. Import rollback tested on disposable DB; production migrations/restore remain unauthorized.

Next safe task: test the new identity endpoint and admin browser flows, add paginated conflict grouping and explicit alias-history date matching, then obtain artifact-specific permission/access evidence and build a provider adapter for the first legitimate official-source pilot. Never approve a fixture claim or count it as an enriched institution.

## Phase 3 review queue follow-up

Latest uncommitted work preserved. Evidence GET now applies status/conflict filtering before slicing, returns total/hasMore and uses createdAt/id stable order. Conflict queue groups distinct values by college and field; identity GET requires admin and resolves aliases only within campus and validity dates. This fix is pending integration/browser verification. The server page currently still loads all evidence before filtering, so large-catalogue database-side pagination remains a performance limitation.

## Phase 3 database review queue — verified latest tree

This entry supersedes the earlier unverified in-memory queue notes. Branch remains `phase-3-catalogue-enrichment`; Phase 2 commit `19d8c91`, all previous uncommitted work and unrelated `CollegeFind_AGENTS_V3.md` are preserved. Real institutions enriched: **0**.

Implemented shared `src/server/evidence-queue.ts` for both the admin API and server page. A parameterized Prisma `$queryRaw` CTE classifies latest decisions, matches search/conflicting values, counts filtered rows and performs ORDER BY/LIMIT/OFFSET in PostgreSQL. Only selected page IDs are hydrated using Prisma `findMany`; the application never downloads the entire evidence table. Page defaults to1, page size25, bounded1–100, maximum page100000; invalid API input returns400. Both readers require current ADMIN access. Unique ordering is createdAt DESC/id DESC, including decision ordering; equal timestamps no longer yield unstable page ordering. Count and ID slicing use a single statement snapshot. Offset navigation is stable for an unchanged queue; concurrent inserts/reviews can move rows between separately requested pages, so this is not an immutable export snapshot.

Conflict definition: differing JSON values within identical college/field/programScope/academicYear, excluding fixture/rejected/stale candidates, with a competing candidate not superseded by approved evidence. This deliberately surfaces pending disagreements for human review. It is an administrative triage signal, not a public verification assertion. Both API/page use the same implementation. New additive indexes support evidence chronological ordering and latest-decision lookup. No existing rows/IDs/slugs were backfilled or deleted. Roll back code while retaining additive indexes; no destructive down migration is required. SQL plan/performance at large evidence volumes is NOT TESTED.

Verified with fresh PostgreSQL16 container `13d75178b9c69cba3cb817ea555398f62826e7ba1a46c79900419f3abcf5ef08`, label `phase3`, only127.0.0.1:32774. Identity `collegefind_test|0` (zero public tables) independently checked before disposable confirmation. Separately created and verified `collegefind_browser_test|0` for browsers. Test credentials were local fixtures; no runtime/production database accessed.

| Exact check | Latest result |
| --- | --- |
| `npx prisma generate` | PASS, Prisma7.10.1 |
| `npm run db:deploy` with fixture overrides | PASS, all5 migrations including review queue indexes, both clean disposable databases |
| `npm run test:all -- --maxWorkers=2` | PASS, **162 tests /26 files**, final rerun20.32s after all integration assertions |
| `npm run build` | PASS, final clean Turbopack compile5.0s, TypeScript/static generation completed after mobile layout correction |
| `npm run test:e2e -- --workers=2` | PASS, **31 passed /1 intentional skip**,18.0s, Desktop Chromium/Pixel7, separate seeded browser DB |
| `npm run lint` / `npm run typecheck` / `git diff --check` | PASS final run |
| `sha256sum src/server/seed/demo-colleges.json` | unchanged `a9321b82b6f390790e09a647dfaf589b90c5736819aed6b9a5908922bfcc1637` |

New integration coverage: filters before page slicing, conflict peers across page boundaries, tied timestamps with no duplicate IDs on adjacent static pages, zero-result search, out-of-range page, invalid page/size, unauthenticated401/nonadmin403/current-role admin access, historical expired alias exclusion, identity write audit and anonymous identity denial. Existing import tests rerun: dry-run, duplicate import, changed version, rejection report, audit rollback and fixture approval denial. Added public projection assertion proves even a fixture with an injected approval is withheld. Admin browser scenarios run in both projects: real login, anonymous queue denial, search, two-page navigation, conflict queue, successful approve/reject, and disabled fixture approval. Synthetic browser approval data exists only in disposable DB and is never counted as real enrichment.

Failures corrected during verification: first browser run shared integration leftovers and failed a demo recommendation assumption; moved to separately verified browser DB. Initial new select locator included option text in accessible label; used role-based combobox locator. Mobile audit JSON overflow intercepted review controls; wrapped histories/long content and stacked controls. Full browser rerun then passed. No force clicks, security relaxation, test skips beyond existing mobile-only desktop skip, or production operations.

Changed this increment: shared queue service, admin evidence GET/page and responsive review controls, additive queue index migration/schema indexes, queue integration tests, explicit public fixture exclusion assertion in catalogue integration test, admin Playwright tests, status/coverage docs. Earlier identity endpoint work preserved and tested. No new official source access investigation or real pilot. Remaining blockers are artifact-specific source permissions/access, positive real-source pilot and independent human review, production owner credential/seed/Redis/backups evidence, and large-volume queue query performance verification. None prevents local fixture operation; none is claimed verified.

Cleanup: exact container ID/phase3 label/loopback port rechecked; `docker rm -f 13d75178b9c69cba3cb817ea555398f62826e7ba1a46c79900419f3abcf5ef08` removed only this disposable fixture. No test database remains from this run. Final documentation diff check passed.

## First real official-reference pilot

Local-only Phase3 increment, existing branch/Phase2 snapshot preserved. Ten existing institutions selected with regional/public/private variety; manifests/checklists in `data/pilot`. Eight accessible official website references staged, two access-blocked, zero human review/VERIFIED claims. No fees, placements, accreditation or admissions claims imported. `docs/DATA_COVERAGE.json` now reconciles all205 field dispositions and eight local STAGED website fields; ledger records local disposable execution, not production state. Human review credentials/approval unavailable; no real claims approved.

Added narrow `official-reference.ts` adapter plus `ingest-official-references.ts` CLI. Only manually observed public official HTML hyperlinks with explicit LINK_REFERENCE_ONLY use accepted; no crawling, copying documents/prose or inferring reuse permission. Exact URL/publisher/collectedAt/unknown publishedAt/locator stored. Existing source identities, field evidence, import runs and audits reused; default dry run, idempotent upsert, per-source transaction and90-day recheck policy. No schema change. Existing IDs/slugs untouched. Replay manifest/staging IDs retained after disposable cleanup; do not mistake exported staging status for deployed data.

Actual checks after source changes:
- Fresh PostgreSQL16 container `85288ad05c56bc16ec8e10a0b2f6e512170195dde483480e789a9a9cbf30b98a`, label phase3, loopback32775, `collegefind_test|0` independently checked before confirmation. Separate empty `collegefind_browser_test|0` verified for E2E.
- `npx prisma generate`, `npm run lint`, `npm run typecheck`: PASS.
- `npm run db:deploy`: PASS all5 migrations on isolated integration and browser databases.
- `npm run test:all -- --maxWorkers=2`: PASS163 tests/27files,21.14s. New adapter regression checks no-write dry-run, idempotency/audit, zero decisions, source-use rejection and public withholding; existing provenance/identity/import/queue tests rerun.
- `npm run build`: PASS clean Turbopack compile6.3s, TypeScript8.6s and static generation.
- `npm run test:e2e -- --workers=2`: PASS31/1intentional skip,17.7s; synthetic desktop/mobile review/approval/rejection/search/comparison/projection scenarios. No real-review simulation; these tests prove code behavior, not factual verification. Public display of genuinely reviewed real pilot claims remains NOT TESTED because none is approved.
- `npm run db:seed` only on disposable DB; `npx tsx scripts/ingest-official-references.ts --file data/pilot/official-references.json` dry run PASS8. Same with `--apply --report data/pilot/staging-results.json` PASS8. Repeat `--apply` returned same IDs. Read-back excluding synthetic TEST publisher:8 real-reference claims/8institutions; zero review decisions. Adapter integration fixture adds one synthetic TEST source, not counted as real enrichment.

Sources/terms/access observations and remaining field-level research actions are in DATA_COVERAGE. Public factual linking is treated separately from protected document copying/bulk redistribution; no blanket reuse licence asserted. Two inaccessible sources moved to blocked instead of bypassed. No real source documents or quoted prose persisted. Bulk extraction stays disabled pending artifact-specific conditions. Existing production credential/seed/Redis/backup release blockers remain unchanged. Next safe task: independent human website/domain/campus review of the8 references, then focused programme/fee publication research with explicit scope/rights validation. Do not promote unrelated demo metrics when approving website fields.

Final diff check PASS; original205 seed SHA unchanged (`a9321b82b6f390790e09a647dfaf589b90c5736819aed6b9a5908922bfcc1637`). Reconfirmed exact disposable container ID/phase3 label/loopback mapping and removed that container only after tests and staging read-back. The8 STAGED records persist as replayable source manifest plus execution report, not a running database. No production resource, push/merge/deployment or credential changes occurred.

## Phase3 catalogue scale-out and publication handoff — latest

Preserved `phase-3-catalogue-enrichment`, Phase2 `19d8c91`, all earlier uncommitted work, original205 seed and original eight staging-result IDs. Completed100 institution-level source-reference attempts (not multi-domain research),63 cumulative institutions with accessible official references,37 access-limited,105 not researched. Local archived STAGED claims66 =63website URLs +3admissions links; genuine VERIFIED0, real human review0, fully enriched0. Current run staged58 new claims (55new institutional websites plus3admissions on original pilot); original8 retained from earlier execution artifacts, not re-created or silently re-IDed. Original8 full audit database was removed earlier; only original report IDs/manifests remain. No audit history is fabricated. New58 source/claim/run/audit records archived in `data/pilot/local-stage-snapshot.json`, no users/secrets/reviewer decisions.

All205 plan: `data/pilot/catalogue-batch-plan.json`, bounded25 groups/cumulative50/100/150/205 reference research milestones. Actual research groups10+40+25+25 with successful reference counts8+25+17+13; broad institution/region coverage incl newer private universities, engineering, medicine, law and management.150/205 targets remain future. Exact per-college outcomes, source scope/permissions and all205 field totals updated in DATA_COVERAGE JSON/MD; no fabricated fee/placement/eligibility data or claim of full profile enrichment.

Implemented focused changes: optional admissions-link field on manually-observed official-reference adapter, preserving original website manifest/hash behavior; public projection validates HTTPS and only exposes reviewed/unexpired/nonconflicting admissions URL; profile renders approved admissions link and field source attribution. CLI now bounds rows to25, validates offsets, checkpoints success/rejection report and continues after per-source rejection, keeping per-source transactions. No new schema/migration or source crawler. Real source references were read via ordinary public requests, no CAPTCHA/authentication/403 bypass, copyrighted-document storage or bulk reuse licence assumptions.37 source-access limitations recorded. Multicampus identity remains human-review pending; no whole-college VERIFIED promotion.

Publication tests extended existing synthetic browser scenario: STAGED website not visible, reviewer API approval makes URL/source attribution visible, parent retains DEMO badge, later rejection withholds URL and two review audit records exist. Fixture approvals/public withholding and conflict/staleness/rollback remain in rerun regressions. Synthetic actions are not counted as real approvals. Existing real8 domain recheck found IITBombay/BIT-home intermittent timeout, six public headers, and institution-wide VIT/MAHE/Amrita portals requiring campus review; preserve original claims as STAGED, not autoapprove from accessibility. New BIT admissions page accessible despite homepage timeout. No genuine real student-facing publication is claimed.

Latest execution environment: PostgreSQL16 disposable container `ac8828d5bb3eca815870fe4c08f5d34e0d947a7016b17206355df6a8e7a72072`, phase3label,127.0.0.1:32776; independently checked empty `collegefind_test|0`. Separately created/verified `collegefind_browser_test|0` and `collegefind_regression_test|0` to avoid truncating staged real-reference history. Only public local fixture credentials used. No production resources changed.

Commands/results after latest code changes:
- `npx prisma generate`: PASS.
- `npm run db:deploy`: PASS all5 additive migrations on isolated databases.
- `npm run test:all -- --maxWorkers=2`: PASS **163 tests/27 files**, final16.78s including admissions reference staging regression; no automated real approvals.
- `npm run lint`, `npm run typecheck`, `git diff --check`: PASS after latest adapter/CLI/publication changes.
- `npm run build`: PASS clean Turbopack5.4s, TypeScript8.8s/static generation; latest app publication/admissions changes included. Subsequent CLI/report-only updates do not alter built app.
- `npm run test:e2e -- --workers=2`: PASS **31/1intentional skip**,15.2s including new profile-publication actions on desktop/mobile.
- `npm run db:seed` only on disposable stage/browser DB. `npx tsx scripts/ingest-official-references.ts --file data/pilot/admissions-references.json --apply --report data/pilot/admissions-staging-results.json`: PASS3. Batch00225,00317,00413 imports PASS, reports preserve actual IDs. Batch002 repeat with `--offset 0 --limit 25` returned identical IDs. Latest partial-write/report behavior is per-source; batch-wide atomicity is intentionally not claimed.
- Read-back from staging DB58 new real claims/58 colleges (3admissions on prior pilot +55new sites), no genuine review decisions; cumulative unique count63 institutions after union with old8. Snapshot asserts58 claims and58 audits, excluding synthetic TEST rows.

Remaining work:105 institution sources unresearched;37 limitations need alternate sources; every college needs deeper programme/fees/hostel/scholarship/accreditation/placement/ranking research. All63 staged institutions require human identity/campus approval. No authorized human reviewer available. Permission for broader extraction/snippets/documents must be checked per source. Large-scale queue performance, original8 full audit restoration and real reviewed publication remain unverified. Owner-side historical credential/seed/Redis/backup release blockers persist. No push/merge/deploy/production/credential changes.

## Phase 3 substantive source research and clean restoration — latest, 2026-11-18

This entry supersedes prior substantive-research counts above and in the coverage ledger. Work remained on `phase-3-catalogue-enrichment`; no commit, push, merge or deployment occurred. Preserved prior Phase 3 work, all 205 seed institutions and slugs, all staged claim IDs already in the local artifacts, and audit history without synthesizing old decisions. `src/server/seed/demo-colleges.json` remains SHA-256 `a9321b82b6f390790e09a647dfaf589b90c5736819aed6b9a5908922bfcc1637`.

### Catalogue and evidence results

- 205/205 original catalogue rows and unique slugs preserved.
- Prior institution-reference research remains 205 attempted, 130 staged website links, 17 admissions links, 75 blocked or conflicted. This pass did not repeat it.
- Substantive research: 17 institutions attempted across five bounded batches; 13 with supported staged facts, four with no staged facts, 188 still without substantive research.
- 22 substantive claims staged and unreviewed: 10 course/programme summaries for 10 colleges, 8 admissions process facts for 8 colleges, 2 phones for 2 colleges, and 2 emails for 2 colleges. No fees, placement, accreditation, ranking, hostel or scholarship claims were staged. One IIT Bombay 2026–27 fee notice was researched but deliberately held back because current types cannot preserve its component/category/waiver distinctions safely.
- Combined local record count after restore and these batches: 169 claims (147 reference claims + 22 substantive claims), 164 sources, 164 import runs, 169 staging audit events, zero reviewer decisions, zero fixture claims, zero orphan sources and zero claims lacking a staging audit. All substantive real claims remain STAGED; genuinely VERIFIED real claims/institutions: 0/0; full profiles: 0/205.
- Source pages were manually viewed using public HTTPS access. The manifests record publisher, exact URL, collection time, locators and use notes. No full documents or substantial copyrighted text were copied, and no automated bulk collection or access bypass was used. Public readability was not taken as a bulk reuse licence. The selected-campuses and all fact claims still need authorized human identity, scope and correctness review.

### Snapshot recovery and idempotency

On fresh, independently verified, loopback-only disposable PostgreSQL databases, additive migrations and the archived 147-claim restore succeeded twice. Both clean restore runs yielded 205 catalogue rows, 147 sources, 147 claims, 147 import runs and 147 audit events, with no decisions or fixture claims. Replay manifests named 147 old claims; the archive contained full payloads for 139. The eight absent original pilot claims were reintroduced via the normal importer with new IDs and new staging audit events; their old IDs/history beyond retained manifests are not reconstructed. The archive had original College IDs for 125 claim-bearing rows; IDs for the other 80 catalogue rows were not present in the snapshot, so those IDs cannot be claimed as restored from the archive. Original seed checksum and 205 slugs matched. Reports are `data/pilot/restore-report-batch-002.json` and `data/pilot/restore-report-repeatability.json`.

All five fact batches passed dry-run, first staging and immediate retry; retry counts were 11/11, 5/5, 3/3, 2/2 and 1/1 reused. A restore against a disposable database containing unrelated integration-fixture colleges stopped at identity mismatch and transactionally rolled back; it was not reused as a restore target. No production/staging database was accessed.

### Latest verification evidence

After the only application-code change in this continuation (`src/server/ingest/official-facts.ts` result overload typing, fixing test callers incorrectly receiving the dry-run return type), the following latest results were recorded:

| Command/check | Result |
| --- | --- |
| `npx prisma generate` | PASS |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run test:integration -- tests/integration/official-facts.test.ts` | PASS, 2/2 |
| `npm run test:all -- --maxWorkers=2` | PASS, 165 tests / 28 files |
| `npm run build -- --webpack` | PASS, production build completed with Next.js 16 webpack |
| `npm run test:e2e -- tests/e2e/admin.spec.ts` | PASS, 2/2, desktop and mobile synthetic admin review/publication scenarios |
| Prisma deploy on fresh disposable restore/test DBs | PASS, all five additive migrations |
| Snapshot restoration repeatability | PASS, two clean restores with identical counts above |
| Per-batch idempotency | PASS, all five retries reused all staged claim IDs |

The database and browser tests used only newly provisioned, explicitly verified disposable local PostgreSQL containers; test confirmation was set only after independent identity/isolation checks. The production build and test commands used disposable/test database environment overrides. The browser approval/rejection records are synthetic and do not count as genuine human review. Since the final code checks, only source-manifest and documentation/coverage ledger files changed; tests were not rerun for those data/docs-only edits. Final `git diff --check`, JSON/ledger consistency, final DB count read-back and exact worktree file inventory must be recorded before handoff.

### Current blockers and next task

No real institution has genuinely verified information yet. A human reviewer with the authorized ADMIN role must independently review each source URL, campus match, field value, year/scope, freshness and reuse basis, then explicitly approve or reject in the audited workflow. Bulk extraction, evidence-snippet storage and redistribution permissions remain provider/artifact-specific and unresolved; continue manual factual research only within the recorded scope. Fee enrichment requires a typed programme/year/category/component-aware model before any fee amount is staged. Continue substantive source research across the remaining188 institutions in bounded batches; do not declare any profile complete from the presence of one source or a few facts. Phase 2 owner-side production checks remain separate blockers: historical credential revocation/rotation evidence, production seed-route restrictions, Redis rate-limit configuration/outage behavior, and backup retention/restore readiness. No production configuration, credentials or data were changed.

### Follow-up official-source research batch 006 — 2026-11-18

Four previously substantively unresearched institutions were checked on official pages: NIT Rourkela, IIT Roorkee, MNNIT Allahabad/Prayagraj and Anna University. NIT Rourkela's official copyright policy permits accurate reproduction with prominent acknowledgement (excluding third-party-owned content). Its UG page supports one concise JEE Main/JoSAA/CSAB admission-route candidate, with current-year eligibility explicitly deferred to JoSAA/MoE. It was not imported because the prior disposable PostgreSQL container and confirmation files are absent from this environment and Docker API access returned permission denied. IIT Roorkee has unresolved institute-wide reuse terms and visible programme-count differences; MNNIT reuse terms are unresolved; Anna University reuse and multi-campus scope are unresolved. No claims from those sources were staged. URLs, publishers, source dates/academic-year limitations, retrieval timestamps, evidence locations and decisions are recorded in `data/pilot/substantive-research-batch-006.json` and `docs/DATA_COVERAGE.json`.

Exact checks in this increment:

- `node --import tsx ./scripts/ingest-official-facts.ts --file data/pilot/substantive-research-batch-006.json --report data/pilot/substantive-batch-006-dry-run-report.json`: **PASS**, `DRY_RUN`, 1 candidate, no database changes.
- `npx tsx scripts/ingest-official-facts.ts --file data/pilot/substantive-research-batch-006.json --report data/pilot/substantive-batch-006-dry-run-report.json`: **BLOCKED by sandbox runtime**, Node/tsx listener creation at `/tmp/tsx-1000/16.pipe` returned `EPERM`; this is a runner limitation. The direct Node `--import tsx` invocation succeeded.
- `docker ps --filter name=collegefind-p3-batch002-20261118 --format '{{.Names}} {{.ID}} {{.Ports}}'`: **BLOCKED**, Docker socket permission denied. The earlier `/tmp/cf-p3-*` database confirmation files and container are no longer present.
- No DB connection, migration, import apply, or destructive operation was attempted. New batch status is 1 candidate validated, 0 new claims staged.
- Coverage now records 205 catalogue rows; 21 substantive research attempts; 13 institutions with 22 previously staged claims; 8 attempts with no claim imported; 184 institutions still lacking a substantive attempt; one additional NIT Rourkela candidate pending safe DB stage; 0 genuinely verified claims/institutions. Original seed SHA-256 unchanged.
- `git diff --check`: **PASS**, no whitespace errors. JSON/manifest check: **PASS** (all JSON parsed; importer dry-run accepted one fact); coverage integrity assertions **PASS** (205 seed rows/unique slugs/ledger entries; 21 attempts + 184 not attempted = 205; 13 staged-claim institutions + 8 no-import attempts + 184 not attempted = 205; batch 006 candidate count/report match). Seed SHA-256 remains `a9321b82b6f390790e09a647dfaf589b90c5736819aed6b9a5908922bfcc1637`.

No application code changed in batch 006. New files: `data/pilot/substantive-research-batch-006.json`, `data/pilot/substantive-batch-006-dry-run-report.json`; updated `docs/DATA_COVERAGE.json`, `docs/DATA_COVERAGE.md` and this status file. The earlier full tests/build/browser evidence remains applicable to the unchanged application code but is not evidence that this candidate was database-staged or human-reviewed. Next safe task: provision and independently verify a fresh disposable PostgreSQL database, dry-run then import this candidate with an idempotent retry, and continue source research in bounded batches. Never apply a review decision without an authorized reviewer.

## Phase 3: full-catalogue source-reference pass — latest

This entry supersedes the immediately preceding 100-college scale-out counts. Preserved branch `phase-3-catalogue-enrichment`, all earlier uncommitted code and artifacts, the exact original205 slugs/seed rows, and Phase2 `19d8c91`. `src/server/seed/demo-colleges.json` SHA-256 remains `a9321b82b6f390790e09a647dfaf589b90c5736819aed6b9a5908922bfcc1637`. The separate test DB contained an extra synthetic slug `preserved`; all205 original slugs were present, with none missing. No source seed rows were changed.

### Catalogue progress and data quality

Completed a bounded official-site reference attempt for **all205** existing catalogue institutions in nine groups of25 (last group5). Cumulative milestones50/100/150/205 were reached. Exact URL/research result/permission note per college is in `docs/DATA_COVERAGE.json`, with bounded manifests and reports under `data/pilot/`.

| Metric | Actual |
| --- | ---: |
| Colleges researched for an institution-level official reference | 205 / 205 |
| Readable official institution pages | 130 |
| Access blocked/unreadable | 74 |
| Conflicting source candidate | 1 |
| Institutions with STAGED website links | 130 |
| Additional STAGED official admissions links | 17 |
| Total local real-source STAGED claims | 147 |
| Genuinely VERIFIED real claims / institutions | 0 / 0 |
| Fully enriched institutions | 0 |
| Colleges with no source attempt | 0 |

Breakdown: groups1–4 attempted100, 63 readable,37 access-limited,63 website links staged and3 pilot admissions links; groups5–6 attempted50,34 readable,16 blocked and34 website links staged; groups7–9 attempted55,33 readable,21 blocked,1 source conflict and33 website links staged; 14 further official admissions links were staged from reviewed page navigation. Total claims are130 website links plus17 admissions links across130 institutions. All147 remain STAGED/UNREVIEWED. The original8 claim IDs remain in the old manifest; their former audit rows are unavailable because the earlier disposable database had already been removed. We did not fabricate or reconstruct those audit events.

Field counts for all205: website **130 STAGED / 75 MISSING**; admissions link **17 STAGED / 188 MISSING**. Identity fields, course summary, annual fees, placement rate/packages/recruiters, and NAAC grade remain **205 DEMO each**. Descriptions/about, contact phone/email, degree/duration/eligibility, programme/year/category fees, hostel, scholarships, facilities, rankings/category/year, recognition/accreditation validity, admission requirements/deadlines, and placement cohort/denominator/metric/reporting year remain **205 MISSING each**. There are no verified counts. A homepage or admissions link does not enrich those other fields; the exact machine-readable field ledger is `docs/DATA_COVERAGE.json`.

Source use was limited to public page viewing and exact hyperlink attribution. We did not run an automated crawler, save full official documents/prose, bypass access controls, or assume a licence for snippets, bulk extraction or redistribution. Access failures are method-specific, not proof of permanent unavailability. `bmcri.org` redirected to unrelated gambling content; recorded as a source conflict and excluded. All campus matches and any substantive claim require human review. Collection times are stored per staged record; source publication dates are null where not established. No fees, rankings, placement values, accreditation, eligibility or course claims were inferred.

### Import records and safety

New source links were staged through the existing importer in bounded slices (maximum25 rows per CLI invocation), retaining deterministic claim/source IDs, one import run and audit record per claim, and per-source transactions. The first attempt for batch7–9 correctly rejected25 rows because a future collection timestamp was supplied; that attempt made no writes. Correcting the timestamp allowed the33 checked rows to stage. The rejection report is preserved in `data/pilot/batch-007-009-initial-rejection-report.json`. Replaying the group5–6, group7–9 and extra admissions manifests returned the same IDs (34,33 and14 rows respectively); no duplicate claims were created.

The exact IDs from the current local disposable execution are archived in `data/pilot/local-stage-snapshot.json`: **139 claims,139 source rows,139 import runs and139 audit rows; zero fixture claims and zero reviewer decisions**. The remaining8 older claim IDs exist only in the unchanged earlier result file and are not represented as audit-backed in the new snapshot. No users or reviewer credentials are exported. The execution database was a `phase3`-labeled PostgreSQL16 container bound only to `127.0.0.1:32776`; after verifying the snapshot it was removed by exact container ID. The integration suite ran against the separate disposable database `collegefind_regression_test`. No production, staging or remote database was accessed.

### Verification after the latest data and documentation changes

- `npm run test:all -- --maxWorkers=2` with `DATABASE_URL` and confirmed `TEST_DATABASE_URL` both targeting `collegefind_regression_test`: **PASS, 163 tests / 27 files**, 20.77s. The database was separately checked first; tests were not run on the database holding the real staged batch.
- `npx prisma generate`: **PASS**, Prisma Client 7.10.1.
- `npm run lint`: **PASS**.
- `npm run typecheck`: **PASS**.
- `git diff --check`: **PASS**.
- Bounded staging and replay identity assertions: **PASS**, 34 website refs (group5–6),33 website refs (group7–9),14 admissions refs; repeat IDs identical.
- Batch research/ledger assertions: **PASS**,205 unique catalogue slugs,205 unique plan entries,205 research outcomes;130 staged institutions;147 claim-history entries; no status was changed to VERIFIED.
- Build and browser checks were not rerun because this pass changed only JSON/manifests and documentation; the current application-code tree had earlier PASS evidence: clean Turbopack production build and Playwright **31 passed / 1 intentional skip**. No app code changed after those checks.

### Acceptance state and blockers

- PASS: all205 catalogue slugs have a recorded first-pass official-source attempt; batch milestones50/100/150/205 reached; research logs distinguish accessible, blocked and source-conflict outcomes.
- PASS: observed links staged with publisher, exact URL, collection timestamp, locator, link-only use, unreviewed status and local result IDs; import replays were idempotent; audit/source/run records archived for139 current claims.
- PASS: the original205 demo seed and all slugs/IDs are preserved; demo fee/package/placement/recognition data was not promoted; no numeric admission claims were fabricated.
- PASS: suspicious `bmcri.org` redirect was rejected and documented; blocked sources were not bypassed.
- BLOCKED: no real claim has an authorized human decision. Authorized reviewer access/credentials and campus-by-campus review are required before any public VERIFIED projection.
- BLOCKED: source-specific permission for automated extraction, evidence-snippet/document storage and bulk redistribution remains unverified. Public availability only supported manually viewed factual links.
- NOT COMPLETE: field-specific work remains for every college—official contact/location, programmes/duration/eligibility, current admissions rules, category/year tuition and hostel, scholarships, validity-scoped recognition/accreditation, defined-cohort placement measures, dated category rankings and facilities. Thus0/205 profiles are fully enriched despite all205 homepage-reference attempts.
- BLOCKED: owner-controlled production security checks for historical credential revocation/rotation, production seed route, Redis rate limiting/outage behavior, and database backup/restore remain release blockers as previously recorded.

Next safe work: begin substantive field research in small batches using accessible official publications and source-specific reuse review; prioritize alternatives for74 blocked candidates and resolve the one source conflict; prepare individual campus checklists; keep all staged links pending authorized human review. Do not bulk import or claim public verification based on these references.

## Phase 3 substantive research continuation — latest, 2026-11-18

Preserved branch `phase-3-catalogue-enrichment`, existing application changes, 205 original seed rows/slugs, historical evidence and the earlier disposable-database results. No database, application code, production resource, credential, Git history or remote branch was modified in this continuation. The worktree remains uncommitted as it was at entry; only `data/pilot/substantive-research-batch-008.json`, `docs/DATA_COVERAGE.json`, `docs/DATA_COVERAGE.md` and this status entry were added/updated in this continuation.

### Resumable research results

- Verified the existing batch 007 ledger update: 25 NIRF Engineering 2025 rank candidates are recorded against 25 existing slugs, with exact report table row locators, but **zero were staged** because typed `NirfRanking` ingestion and reviewer-queue visibility are not implemented. A fresh direct report-PDF request returned HTTP 403; no bypass or further extraction was attempted. Prior 25 candidate notes remain as previously collected research, not as new access in this continuation.
- Followed up three colleges on first-party pages and recorded four facts as research-only candidates: IIT Indore (B.Tech programme labels and four-year duration), IIT Bhubaneswar (B.Tech disciplines/duration and exact page wording for admission route), and IIT (BHU) Varanasi (B.Tech/IDD duration and route labels). Collection time is recorded as `2026-11-18T04:01:25Z`. None is staged or verified because source-specific republication permission is unresolved; the IIT (BHU) page additionally needs academic-office corroboration. Candidate details and caveats are in `data/pilot/substantive-research-batch-008.json`.
- Official page evidence: [IIT Indore UG guidelines](https://www.iiti.ac.in/admissions/ug_info/btech/guidelines) lines 162–176 (programme labels and B.Tech duration), [IIT Bhubaneswar B.Tech admissions](https://www.iitbbs.ac.in/index.php/home/academics/admission-b-tech/) lines 520–534 (eight branches, four years/eight semesters, and source wording “JEE”), and [IIT (BHU) TPC academic summary](https://iitbhu.ac.in/cf/tpc/academics) lines 31–66 (programme labels, duration and admission-route labels). No publication date or academic year was asserted where the page did not provide one. No fees, eligibility thresholds, placement results or other unsupported fields were inferred.
- Research coverage remains **46 unique institutions attempted**, of which 14 have 23 substantive claims staged and 32 have no substantive claim staged; 159 colleges remain without substantive field research. Three follow-up research records and four candidate facts do not increase the unique institution count. All 23 staged substantive claims and all 147 reference claims remain unreviewed; genuine verified facts/institutions are 0/0. Batch 007's 25 ranking candidates and batch 008's four programme/admission candidates are not in the database.

### Existing disposable database evidence (reused; no new writes)

The exact CollegeFind disposable PostgreSQL container was confirmed by name/ID and loopback mapping only: `collegefind-phase3-disposable-20261118`, ID `08b37b037a8c`, host `127.0.0.1:35439`. No DevSync container was queried or modified. Previous independent identity/isolation checks, five additive migrations, two repeatable snapshot restores, replay of batches 001–005 and NIT Rourkela batch 006, idempotent retries, and final read-back remain as documented above. The most recent database evidence is 205 colleges/205 unique slugs, 165 sources, 170 claims, 165 import runs, 170 stage-audit events, zero decisions, zero fixture claims, zero orphan sources and zero claims without staging audits. No migration/import/test was run in this continuation because batch 008 was research-only and the NIRF response was unavailable.

### Current verification

- `git diff --check`: **PASS**.
- Coverage JSON + manifests parse and reconciliation assertions: **PASS** (205 unique original slugs; 46 unique substantive research attempts; 159 not attempted; 14 institutions with 23 staged substantive claims; 25 NIRF candidates un-staged; four batch 008 candidate facts across three follow-ups, all un-staged; no verified claims).
- Database/application unit, integration, Playwright, lint, typecheck, Prisma generation and build: **NOT RUN in this continuation**. No application/database code changed; prior successful results remain applicable to the unchanged code, not to new research candidates as imported functionality.
- Disposable database was not changed in this continuation. No human reviewer was impersonated or simulated.

### Remaining blockers and next safe work

1. Build an additive typed `NirfRanking` staging path that emits source/run/audit records and appears in the authorized reviewer queue; add tests for duplicate imports, conflict detection, review decisions, public projection and fixture/staged exclusion. Do not import the batch 007 candidates until source-use policy and reviewer visibility are checked.
2. Obtain a documented project policy decision for publishing concise facts from these public institutional webpages, or written provider authorization where needed. Keep batch 008 unstaged until that decision; confirm IIT (BHU) academic-office details and campus mapping.
3. Continue in 25–50 college batches with substantive official source research, but do not count homepage links as substantive or full enrichment. Research fees only through typed year/programme/category/component data; research placements only with cohort, denominator, year and metric definition.
4. Arrange an authorized human reviewer to decide each real claim. All real claims remain unverified; do not publish them as confirmed.
5. Phase 2 owner-side production release blockers remain unchanged: historic credential revocation/rotation evidence, production seed-route restrictions, Redis-backed rate-limit configuration/outage behavior, and production backup/restore readiness.

## Phase 3 browser fixture, snapshot rehearsal and batch 010

- Fixed the desktop and mobile college-search smoke tests by creating a unique demo college per test, requiring a confirmed test URL shared by the app and fixture client, and cleaning up that fixture. The test checks the search query, matching card, canonical detail URL, exact college name and demo label. CI now supplies the isolated browser URL to both app and fixture.
- Ran `npm run test:e2e -- tests/e2e/smoke.spec.ts -g 'a visitor can search and open a college' --workers=2` on the existing production build against the verified `collegefind_phase3_test` database. Desktop and mobile passed in 3.1 seconds. `npm run test:integration -- tests/integration/official-facts.test.ts` passed all three tests on that database after the browser run.
- Confirmed `collegefind_phase3_snapshot182_test` was empty in the labelled CollegeFind container with loopback port 35439. Applied the five existing migrations to that database. `node --import tsx scripts/rehearse-staging-snapshot.ts` verified the archive digest and references, restored 205 catalogue IDs, 175 sources, 182 claims, 175 import runs and 182 audits, and compared every restored evidence row with its archived counterpart. The immediate retry inserted zero rows. Reviewer decisions and users both numbered zero. The rehearsal read the original ID mapping from the source clone, so the legacy archive alone cannot recover that mapping.
- Recorded batch 009's 12 staged claims and 12 reused claim IDs. Batch 010 researched 25 additional institutions, held 17 for access or scope gaps, and staged eight claims in the disposable restore database. Dry run accepted eight candidates. The immediate retry reused all eight and reported no writes. Read-back found 205 colleges, 183 sources, 190 claims, 183 runs, 190 staging audits and zero decisions or missing staging audits. The versioned exporter preserved the prior archive and generated the batch 010 archive and digest manifest.
- Substantive research now covers 96 institutions. Of these, 32 have 43 staged substantive facts and 64 have no staged substantive fact. Another 109 await research. Human approval is pending for all 190 staged claims. Existing NIRF candidate access and publication questions remain open.

## Phase 3 substantive enrichment — batch 011

Preserved the existing branch, all prior working-tree changes, all 205 catalogue rows/slugs and all existing staged evidence. No production or DevSync resource was accessed. No real reviewer decision was created.

### Work completed

- Researched the next 25 colleges still marked substantively `NOT_STARTED`. The resumable manifest records every institution's research outcome, exact official source URLs, publisher, source date/year where available, retrieval timestamp, evidence locator and source-use note. Eleven institutions had supportable facts; fourteen remain held with identity, currentness, conflict or research-depth reasons. No homepage-only findings were counted as substantive data.
- Dry-run validated 25 candidates. First import staged **25** claims across **11** colleges, **17** sources and **17** import runs. Immediate retry reused all **25** claim IDs, created no sources/runs and reported `databaseChanged=false`. All claims remain `UNREVIEWED`.
- Batch fact mix: three course-list facts, three structured programme facts, one admissions summary, eight structured admission facts, eight structured fee facts, and two scholarship facts. No placement number was staged where the inspected evidence did not establish a trustworthy cohort/denominator/metric. Held cases include ambiguous campus scope, outdated fee/admission material, conflicting entrance requirements, unconfirmed institutional domains and insufficient source detail.
- Added a stable 205-row `{id, slug}` identity map and its SHA-256 to new evidence snapshots. Legacy V1 snapshot restore continues to use the prior source-clone lookup only when the map is absent. The new map is self-contained with respect to catalogue IDs; the restore rehearsal still uses the repository's original seed to reconstruct the non-evidence college fields and requires the seed checksum to match.
- Exported versioned batch 011 snapshot SHA-256 `996b4c127ddf9160efe12c84f464f93008413325e8949d8b54bcae64d9379552`: **205** college identities, **200** sources, **215** claims, **200** import runs and **215** stage audits; **0** decisions, users or fixture claims.
- Created fresh disposable DB `collegefind_phase3_snapshot011_test` within the already verified loopback-only CollegeFind PostgreSQL container, confirmed it was empty and owned by `cf_phase3_test`, and applied all five existing migrations. Snapshot rehearsal restored 205/200/215/200/215 records, exact read-back passed, and retry inserted zero rows. No existing database was reset or deleted.
- Updated `docs/DATA_COVERAGE.json` and `docs/DATA_COVERAGE.md`. Coverage is now 121 colleges attempted, 43 with staged substantive facts, 78 with no stageable fact, 84 not yet substantively researched; 68 substantive claims and 215 total local staged claims. Genuine verified claims/colleges remain 0/0, and no institution is fully enriched.

### Changed and added files

- `scripts/export-staging-snapshot.ts` — include stable college identity mapping and checksum in new exports.
- `scripts/rehearse-staging-snapshot.ts` — support named archives and a safely validated fresh snapshot-test DB; prefer the archived identity map, retaining the legacy source-clone fallback.
- `data/pilot/substantive-research-batch-011.json` and three dry-run/import/idempotency reports.
- `data/pilot/staged-evidence-after-batch-011.json`, manifest and exact restoration report.
- `docs/DATA_COVERAGE.json`, `docs/DATA_COVERAGE.md`, and this status file.

### Exact verification evidence

- `node --import tsx scripts/ingest-official-facts.ts --file data/pilot/substantive-research-batch-011.json --report data/pilot/substantive-batch-011-dry-run-report.json`: **PASS**, 25 candidates, read-only.
- Same importer with `--apply`: **PASS**, 25 staged, 17 sources/runs created; disposable target independently identified as `127.0.0.1:35439/collegefind_phase3_restore`, owner `cf_phase3_test`.
- Same importer repeated with `--apply`: **PASS**, 0 staged / 25 reused / 0 sources / 0 runs / `databaseChanged=false`.
- `node --import tsx scripts/export-staging-snapshot.ts --name staged-evidence-after-batch-011`: **PASS**, digest and counts recorded above. Manifest identity digest is `7de99f1f2a5aa88676dfbfa2161e56a9ce043a4c6f5d1da82b82957a8e297849`.
- `npx prisma migrate deploy` on the newly created empty `collegefind_phase3_snapshot011_test`: **PASS**, all five existing migrations applied.
- `node --import tsx scripts/rehearse-staging-snapshot.ts --snapshot staged-evidence-after-batch-011 --target-db collegefind_phase3_snapshot011_test`: **PASS**, exact read-back and zero-write retry. First rehearsal invocation surfaced a CLI option-parsing error; the option spelling was fixed. A subsequent preflight check also initially used the wrong unquoted PostgreSQL table identifier; no state changed, and the corrected quoted-table check confirmed zero rows before the successful rehearsal.
- `npm run lint`: **PASS**; `npm run typecheck`: **PASS**; `git diff --check`: **PASS**, after the exporter/rehearsal script changes. No product/application modules changed in batch 011. Production build, Playwright and application integration suites were not rerun because only research/manifests, ledger docs and export/rehearsal scripts changed; prior browser/build evidence remains applicable to unchanged app code.
- Source/research validation: 25 selected colleges all reconcile to original catalogue slugs. No claim is marked verified. No full official document or copyrighted prose was stored; no bulk automated crawl, access-control bypass or source-document redistribution was performed.

### Current data gaps and blockers

Research has not yet established reusable, current programme-level eligibility and seats, category/year tuition for most colleges, hostel charges, scholarships, recognition validity, defensible placement cohorts/denominators or dated category rankings for most of the catalogue. Fourteen batch 011 candidates were held and 84 colleges remain without a substantive research attempt. All 215 local claims remain unreviewed; authorized human review is still required. Provider terms remain use-specific; explicit rights for bulk automation or source-document redistribution have not been established and are not assumed. Owner-side Phase 2 production release gates remain unresolved.

Next scoped task: continue with the next 25 remaining `NOT_STARTED` college records in batch 012, add only individually supported official facts, then idempotently stage and export another identity-complete snapshot. Avoid rechecking batch 011 sources unless a claim conflict or reviewer question requires it.

## Phase 3 substantive research — batch 012

Continued field-level enrichment on `phase-3-catalogue-enrichment`; preserved the original 205 seed records, IDs and slugs and all prior evidence. No production/DevSync resource or human reviewer credentials were accessed. No real claim was approved.

### Research and staged facts

- Researched the next 25 `NOT_STARTED` institutions and recorded a disposition for each in `data/pilot/substantive-research-batch-012.json`. Twelve had supported claims; 13 were held with reasons.
- Official first-party materials supported 25 claims across 12 catalogue institutions. Facts include programme/course lists and durations, current/historical admission routes and eligibility, 2026-27 tuition and hostel fee components, and a 2026-27 scholarship reference. No placement or ranking number was included without defensible metric/year/cohort scope.
- Claims are all `STAGED` / `UNREVIEWED`. Import wrote no college summary fields and created no reviewer decisions.
- The OP Jindal source was explicitly held: O.P. Jindal Global University in Sonipat and OP Jindal University in Raigarh are separate institutions. The catalogue row's demo city is only a reconciliation hint, not proof of canonical identity.
- Source reuse notes are per-source: public manual viewing and narrow attributable factual staging only; no full source document or substantial prose was stored. Automated bulk extraction and broad redistribution permissions remain unestablished. Closed admission cycles are labelled historical.

### Actual cumulative coverage

| Measure | After batch 011 | After batch 012 |
| --- | ---: | ---: |
| Catalogue records | 205 | 205 |
| Substantive research attempts | 121 | 146 |
| Institutions with substantive staged claims | 43 | 55 |
| Attempted but no stageable fact | 78 | 91 |
| Not yet substantively researched | 84 | 59 |
| Substantive staged / genuine verified claims | 68 / 0 | 93 / 0 |
| Total link-reference + substantive claims | 215 | 240 |
| Total genuine verified institutions | 0 | 0 |
| Fully enriched profiles | 0 | 0 |

Latest sourced-unreviewed field counts: courses 17 claims / 17 institutions; admissions summaries 10/10; phone 2/2; email 2/2; structured programmes 24/24; structured admissions 22/21; structured fees 13/9; structured scholarships 3/3. Existing raw seed values stay DEMO or MISSING; the evidence overlay does not promote them. Exact per-college statuses, source URLs, values, evidence locators, and history are in `docs/DATA_COVERAGE.json`.

### Import, idempotency and archive evidence

- `node --import tsx scripts/ingest-official-facts.ts --file data/pilot/substantive-research-batch-012.json --report data/pilot/substantive-batch-012-dry-run-report.json`: **PASS**, 25 claims accepted, `DRY_RUN`, no database writes.
- Same importer with `--apply`, after loading `/tmp/collegefind-phase3-restore.env`: **PASS**, 25 staged / 0 reused, 18 sources and 18 import runs created. The CLI's target guard accepted only the existing verified loopback disposable restore target `127.0.0.1:35439/collegefind_phase3_restore` / `cf_phase3_test`; no production or DevSync connection.
- Same importer with `--apply` immediately repeated: **PASS**, 0 staged / 25 reused, 0 sources / 0 runs created, `databaseChanged=false`.
- `node --import tsx scripts/export-staging-snapshot.ts --name staged-evidence-after-batch-012`: **PASS**, exporter verified relationships/audit counts and exported the stable 205-row `{id, slug}` identity map. Snapshot SHA-256 `b248ee7c8a329d9cf713e9b75e46d5ca50d663ce8aa08351cf62178712dadfdf`; identity SHA-256 `7de99f1f2a5aa88676dfbfa2161e56a9ce043a4c6f5d1da82b82957a8e297849`. Counts: 205 colleges, 218 sources, 240 claims, 218 runs, 240 audits; zero decisions, users and fixture claims. A restore rehearsal for this new snapshot has not been run.
- `git diff --check`: **PASS** in final verification after batch 015; research-only changes did not require lint, typecheck, build, migrations or browser-test reruns.

### Changed files in this increment

- `data/pilot/substantive-research-batch-012.json` and dry-run, import, idempotency reports.
- `data/pilot/staged-evidence-after-batch-012.json` and its manifest.
- `docs/DATA_COVERAGE.json`, `docs/DATA_COVERAGE.md`, and this status file.

### Remaining gaps and next scoped work

Fifty-nine catalogue entries have not yet received substantive research. Of the 146 attempted, 91 have no safely stageable claim and retain source/identity/scope or missing-evidence reasons. Every staged real fact awaits genuine authorized review; verified real claims/institutions remain 0/0. Current batch sources do not resolve automated reuse or bulk redistribution rights, so continue manually sourced facts and exact citations without crawling or copying documents. The newest snapshot is exported but requires a future separate verified disposable-database restoration rehearsal if archive-restoration assurance is needed. Phase 2 owner-side production security and backup checks remain release blockers.

Next task: research the next 25 `NOT_STARTED` college identities, beginning from the updated machine-readable ledger, then dry-run, import/retry, update counts, and export a new versioned identity-complete snapshot.

## Phase 3 substantive research — batch 013

Researched the next 25 `NOT_STARTED` colleges without repeating the homepage pass. Six institutions yielded supported facts; 19 were held or had no fact sufficiently inspected. The official IIIT Sri City admission page returned 403 and was not bypassed. Pondicherry University's 2026-27 brochure states that permission is required to use its content; no facts from that brochure were staged. Dibrugarh University's inspected admission view did not render notice details.

Eleven source-backed facts were staged for IIM Bodh Gaya, IIM Sirmaur, IIM Jammu, COEP Technological University, North-Eastern Hill University and Tezpur University. These cover programme lists/summaries and historical 2026-27/2026-28 admission routes. Closed cycles are identified as historical. No unsubstantiated fees, placement outcomes, rankings or accreditation were added. The existing 205 catalogue IDs/slugs and raw demo fields remain unchanged. No real reviewer decision was created; all claims remain `STAGED`/`UNREVIEWED`.

### Verification evidence

- `node --import tsx scripts/ingest-official-facts.ts --file data/pilot/substantive-research-batch-013.json --report data/pilot/substantive-batch-013-dry-run-report.json`: **PASS**, 11 valid candidates, no DB writes.
- Same command with `--apply` and the already verified disposable CollegeFind environment: **PASS**, 11 claims staged, 6 source records and 6 import runs created.
- Immediate repeated `--apply`: **PASS**, 0 new claims, 11 reused, 0 source/run writes, `databaseChanged=false`.
- `node --import tsx scripts/export-staging-snapshot.ts --name staged-evidence-after-batch-013`: **PASS**. Snapshot SHA-256 `d190e7f271ee07198511a34c5e08ad62ddf291446f566e446a9d6d4d6277aaa5`; stable identity SHA-256 `7de99f1f2a5aa88676dfbfa2161e56a9ce043a4c6f5d1da82b82957a8e297849`. Counts: 205 colleges, 224 sources, 251 claims, 224 runs, 251 staging audits; zero users, reviewer decisions and fixture claims. Export integrity checks passed; separate-database restore rehearsal remains unverified for this archive.
- `git diff --check`: **PASS** in final verification after batch 015; research-only changes did not require lint, typecheck, build, migrations or browser-test reruns.

### Updated catalogue coverage

Substantive research now attempted for 171/205; 61 institutions have staged substantive claims; 110 attempted institutions have no stageable fact; 34 remain unresearched. There are 104 staged substantive claims and zero genuinely verified claims. Across link-reference and substantive claims, the snapshot now contains 251. Unreviewed field counts: courses 20 claims/20 colleges, admissions summaries 10/10, structured admissions 30/27; other domains are in `docs/DATA_COVERAGE.json`. No institution is fully enriched. All claim-bearing institutions require authorized human review; source-specific bulk extraction/republication permission remains unresolved.

Changed for this batch: `data/pilot/substantive-research-batch-013.json`, dry-run/import/idempotency reports, the batch 013 snapshot plus manifest, `docs/DATA_COVERAGE.json`, `docs/DATA_COVERAGE.md`, and this status file. Next task: research the next bounded group of remaining `NOT_STARTED` colleges and repeat dry-run, safe staging, idempotency, coverage update and snapshot export.

## Phase 3 substantive research — batch 014

Researched the next 25 `NOT_STARTED` catalogue records. Four produced source-backed facts (IIIT Kottayam, ABV-IIITM Gwalior, IIM Nagpur and NISER Bhubaneswar); 21 have a recorded hold or bounded-pass disposition. Twelve claims were staged and remain `UNREVIEWED`. Research captured programme/course lists, admissions routes, the MBA programme duration, source-scoped 2026-27 tuition and hostel room/mess components, and an official registrar phone. The IIITM figures are not flattened: ₹95,000 tuition, ₹15,000 hostel room and ₹20,000 hostel mess per semester for the notice's General/General-EWS/OBC-NCL category. All 2026 admission cycles in this batch are historical at retrieval; no current application availability is claimed. No placement, scholarship, ranking or accreditation fact was inferred.

### Verification evidence

- `node --import tsx scripts/ingest-official-facts.ts --file data/pilot/substantive-research-batch-014.json --report data/pilot/substantive-batch-014-dry-run-report.json`: **PASS**, 12 valid claims, no DB writes.
- Same command with `--apply` against the verified disposable CollegeFind database: **PASS**, 12 staged, 5 sources and 5 import runs created.
- Immediate `--apply` retry: **PASS**, 0 staged, 12 reused, no new source or import-run records, `databaseChanged=false`.
- `node --import tsx scripts/export-staging-snapshot.ts --name staged-evidence-after-batch-014`: **PASS**, exporter integrity checks. Snapshot SHA-256 `6b34e4edcde44c4d0620bf49f6e308ae33bae000fb3e17d80b5ee12637ce7d0f`; identity checksum `7de99f1f2a5aa88676dfbfa2161e56a9ce043a4c6f5d1da82b82957a8e297849`. Counts: 205 colleges, 229 sources, 263 claims, 229 runs and 263 audits; zero users, reviewer decisions or fixture claims. Separate-target restore rehearsal remains outstanding.
- `git diff --check`: **PASS** in final verification after batch 015; research-only changes did not require lint, typecheck, build, migrations or browser-test reruns.

### Updated coverage and files

Substantive research has been attempted for 196/205 colleges; 65 have unreviewed substantive claims; 131 attempts yielded no stageable fact; 9 remain unresearched. There are 116 staged substantive claims and zero genuine approvals/verified institutions. Current field-level overlay counts are in `docs/DATA_COVERAGE.json`: courses 23/23 institutions, admission summaries 10/10, structured admissions 34/31, structured programmes 25/25, structured fees 16/10 and structured contact 1/1. No college is fully enriched; raw seed demo/missing values remain unchanged.

Changed in batches 013–014: their research manifests, dry-run/import/idempotency reports, versioned snapshots/manifests, `docs/DATA_COVERAGE.json`, `docs/DATA_COVERAGE.md` and this status file. All sources were manually accessed via public official pages/PDFs; bulk extraction or redistribution rights are not inferred. No production or DevSync resource was accessed, no human approval was fabricated, and no reviewer decision was created. Continue the final nine not-yet-attempted colleges in a bounded batch, then report remaining research disposition and unresolved human review/source-use gaps.

## Phase 3 substantive research — batch 015 and catalogue research disposition completion

Completed research dispositions for the final nine previously `NOT_STARTED` colleges. Five generated 14 source-backed claims for IISER Pune, IISER Kolkata, BMSCE, PES University and Ramaiah Institute of Technology. Four remained held for reasons in the batch manifest: Saveetha's canonical publisher/name and fee year remain unclear; Lady Hardinge had no sufficiently reviewed current college-specific source; RVCE material was older; and NLU Delhi's official AILET page was under construction while its accessible prospectus is from 2024. No unsupported claims were added. The PES admissions page's JEE Main/KCET fact remains research-only because the page states no academic year, which is required for structured admission ingestion. Direct access to its 2027-28 fee page timed out.

### Verification evidence

- `node --import tsx scripts/ingest-official-facts.ts --file data/pilot/substantive-research-batch-015.json --report data/pilot/substantive-batch-015-dry-run-report.json`: **PASS**, 14 candidates validated, no writes.
- Same command with `--apply` against the existing independently verified disposable CollegeFind DB: **PASS**, 14 claims staged, 6 sources and 6 import runs. All claims remain STAGED/UNREVIEWED; no reviewer decisions were created.
- Immediate identical `--apply` retry: **PASS**, 0 staged, 14 reused, 0 sources/runs created, `databaseChanged=false`.
- `node --import tsx scripts/export-staging-snapshot.ts --name staged-evidence-after-batch-015`: **PASS**, built-in identity/count/source/claim/run/audit validation. Snapshot SHA-256 `0177d295027a32282796b2bb28ff1f31f267adeb5371cef1854bbc44486e4b06`; stable identity SHA-256 `7de99f1f2a5aa88676dfbfa2161e56a9ce043a4c6f5d1da82b82957a8e297849`. Counts: 205 colleges, 235 sources, 277 claims, 235 import runs, 277 staging audits; zero users, reviewer decisions and fixtures. Separate-database restoration rehearsal remains unverified for this latest archive.
- `git diff --check`: **PASS** in final verification after batch 015; research-only changes did not require lint, typecheck, build, migrations or browser-test reruns.

### Final substantive research counts

All 205/205 institutions now have a substantive research disposition. Seventy colleges have claims staged; 135 researched colleges yielded no stageable claim; zero remain unattempted. There are 130 source-backed substantive claims awaiting human review and 147 link-only reference claims; the disposable snapshot holds 277 total claims. Genuine verified claims/institutions remain 0/0, and no college is fully enriched.

Unreviewed substantive field coverage by unique college: course lists 26 (12.7%); admissions summaries 11 (5.4%); structured programme/duration 27 (13.2%); structured admissions/eligibility 34 (16.6%); fee components 10 (4.9%); scholarships 3 (1.5%); legacy typed phone/email 4 (2.0%); structured contacts 2 (1.0%); typed NIRF ranks 1 (0.5%). These counts are overlapping fields and do not add to college totals. Every category still has zero genuinely verified records. The raw catalogue seed fields remain DEMO/MISSING; the evidence overlay has not promoted or overwritten them. The machine-readable ledger includes exact per-college field claim counts, status, source, URL, date/year, retrieval, evidence locator, and review state.

Changed in batches 013–015: three research manifests, dry-run/import/idempotency reports, three versioned evidence snapshots and manifests, `docs/DATA_COVERAGE.json`, `docs/DATA_COVERAGE.md`, and this file. No production/DevSync resource was accessed. All facts were manually collected from public official sources; no full documents or substantial prose were stored, and bulk automated extraction or redistribution rights are not inferred. The previous 25 NIRF candidates remain unimported due to the source's 403 response; the two MSRIT homepage rank facts are separate claims and remain unreviewed. Next work is field-specific research follow-up and human review/source-use decisions, not more homepage collection.

## Phase 3 review archive, claim audit and targeted follow-up — 2026-11-18

This is the latest Phase 3 status and supersedes prior cumulative counts. Work remains on `phase-3-catalogue-enrichment`; no commit, push, merge, deployment, production operation or DevSync access occurred. Existing changes were preserved. The original seed hash remains `a9321b82b6f390790e09a647dfaf589b90c5736819aed6b9a5908922bfcc1637`; all 205 college IDs/slugs and user relationships in the application remain unchanged.

### Snapshot restoration and data integrity

- Verified the existing container `collegefind-phase3-disposable-20261118`: running with `127.0.0.1:35439->5432/tcp`. Connections used only dedicated role `cf_phase3_test` and named CollegeFind disposable databases. No DevSync or production containers/databases were inspected or touched.
- At task start, the latest archive was batch 015: SHA-256 `0177d295027a32282796b2bb28ff1f31f267adeb5371cef1854bbc44486e4b06`. A fresh `collegefind_phase3_snapshot277_test` database was independently checked as empty, migrated from the five repository migrations, and restored twice. Exact read-back passed: 205 colleges, 235 sources, 277 claims, 235 import runs and 277 audit rows. Retry wrote zero rows. No users, decisions or fixtures were present.
- After batch 016, exported SHA-256 `1a83eef39e0c96bb7cb0c0f8c19c9d2175926b86cf5f4b6fd8bdb2a23c5b2631`, identity SHA-256 `7de99f1f2a5aa88676dfbfa2161e56a9ce043a4c6f5d1da82b82957a8e297849`. A separate fresh `collegefind_phase3_snapshot016_test` was independently verified, migrated, and restored twice. Exact read-back passed: 205 colleges, 236 sources, 279 claims, 236 runs and 279 staging audits; retry inserted zero records. Both archives include the identity map and exclude user records, reviewer decisions and fixture claims.
- The existing disposable `collegefind_phase3_restore` database was only read and extended by the idempotent importer. Before import it had 205 colleges, 235 sources, 277 claims/runs/audits, zero users/decisions. It now has 205 colleges, 236 sources, 279 claims, 236 runs and 279 audits. No old records were deleted or overwritten.

### Substantive coverage and claim audit

Current totals: **205/205** colleges have research dispositions; **71** have substantive facts staged (34.6%); **134** have no substantive staged facts; 132 substantive facts plus 147 link references equal 279 archive claims. Genuine VERIFIED claims/institutions are **0/0** and fully enriched institutions remain **0**. Exact field counts and per-college data are in `docs/DATA_COVERAGE.json` and `docs/DATA_COVERAGE.md`.

All 132 substantive facts pass archive-level completeness checks for HTTPS source URL, publisher, retrieval timestamp and evidence locator; all are non-fixture, and none has a review decision. Thirty-nine have neither an academic year nor source publication date. Three have expired validity windows. The queue's same-college/field/programme/year value-conflict grouping found zero conflicts among staged claims. This is metadata validation, **not** human accuracy/campus verification. The 130 earlier facts have not all been re-opened and matched manually against official campus pages. Stable college IDs and slug mapping were preserved; the importer enforces manifest source/institution slug equality.

Prioritized human review checklist:

1. Recollect or reject expired IISER admission claims; do not approve as current: IISER Pune `cmwlti52o000cq2tv8t32n2hv` (valid through 2026-04-30), IISER Pune `cmwlti531000gq2tvv330tpph` (2026-04-20), IISER Kolkata `cmwlti53g000lq2tvjxlh9l14` (2026-06-07).
2. Resolve IIT Kanpur's DoAA Manual vs undated UG page programme-list discrepancy; both new claims are still unreviewed.
3. Review year-sensitive fees and admissions next, checking campus, programme, category, year, route, source date and exact evidence location; keep tuition and hostel fee components distinct.
4. Examine 39 undated claims. Stable facts can remain held or carry a reviewer explanation that year does not apply; time-sensitive fields need current dated evidence.
5. Review every remaining claim individually for identity/campus, official source, accuracy, source terms, conflict and staleness; record a decision reason. One field approval cannot verify adjacent fields.

The authenticated dashboard was exercised only with synthetic reviewers. The restore database has **zero reviewer accounts** and **zero genuine decisions**. Real approvals require an authorized human account and explicit human decisions; synthetic test approvals do not count.

### Batch 016 official-source follow-up

Three previously no-stage institutions were revisited. IIT Kanpur's official DoAA UG Manual was read at printed pages 5–6, §§2.1.1–2.1.3. Two claims were staged: a concise B.Tech/B.S. programme list/duration and bounded admissions routes. Retrieval time is `2026-11-18T09:18:39Z`; no publication date or academic year was visible, so none is asserted. The official PDF is not copied. No explicit reuse licence for that manual was located in this bounded check; only concise values, source link and locator were stored. The undated IITK UG page omits Intelligent Systems; reviewers must resolve that discrepancy before approval.

Two follow-ups were held, not staged:

- IIT Roorkee's accessible official UG Ordinance programme table conflicts with a previously checked official Academic Information page; controlling recency/list was not resolved.
- NIT Warangal's Biotechnology page provides a four-year B.Tech and JEE Main/JoSAA/CSAB plus PCM facts, while its [website policy](https://nitw.ac.in/cdis/itpolicy) permits direct linking but requires prior email permission and acknowledgement to reproduce site material. Keep those candidates research-only until written permission or reviewed legal determination.

Source details, access and reuse conditions are in `data/pilot/substantive-research-batch-016.json`. No access restriction was bypassed and no document was redistributed.

### Exact verification results

- Batch 016 dry run: `./node_modules/.bin/tsx scripts/ingest-official-facts.ts --file data/pilot/substantive-research-batch-016.json --report data/pilot/substantive-batch-016-dry-run-report.json` — **PASS**, two candidates, no DB write.
- Batch 016 apply in verified `collegefind_phase3_restore` — **PASS**, two staged unreviewed claims, one source and one import run created.
- Same import retry — **PASS**, zero staged, two reused, no extra source/run, `databaseChanged=false`.
- `npm run test:integration -- --reporter=dot` on fresh `collegefind_phase3_review_test` — **PASS**, 9 files / 63 tests. It was separate from both snapshot targets and the restore DB.
- Focused `playwright test tests/e2e/admin.spec.ts tests/e2e/comparison.spec.ts --reporter=line` — final **17 passed, 1 intentional skip** on Chromium/mobile. Search, admin authorization/decisions/conflicts/pagination, fixture exclusion, typed publication, comparison restoration, save/retrieval, and demo isolation were exercised. The test now seeds explicit synthetic DEMO rows with tempting sample metrics; assertions were not weakened. The asynchronous save test waits for the save POST before navigation.
- `playwright test tests/e2e/smoke.spec.ts --reporter=line` — **14 passed** on Chromium/mobile, including college search/detail, predictor invalid input, no official cutoff data for demo records, comparison sharing, keyboard and mobile navigation.
- `npm run lint` — **PASS**; `npm run typecheck` — **PASS**; `git diff --check` — passed before the final appended status text and must be rerun.
- The existing `.next/BUILD_ID` came from the prior successful production build. No application or schema code changed in this increment, so build and Prisma generation were not repeated. The disposable runtime logged per-instance rate-limit fallback because Redis is not configured; that does not establish production Redis behavior.

### Files changed in this increment

- `data/pilot/substantive-research-batch-016.json`, its dry-run/import/idempotency reports, batch-016 snapshot/manifest/rehearsal report, and batch-015 rehearsal report.
- `tests/e2e/comparison.spec.ts` (synthetic demo fixture setup and async save-response synchronization).
- `docs/DATA_COVERAGE.json`, `docs/DATA_COVERAGE.md`, `docs/UPGRADE_STATUS.md`.

### Remaining blockers and next scoped work

- 134 institutions remain without staged substantive facts. Continue targeted official programme/admissions/fees/scholarship/accreditation/placement/facility follow-up; do not repeat homepage research. Twenty-five NIRF ranking candidates remain unimported.
- Manually review source/campus accuracy for 132 claims. Resolve three expired claims and the IIT Kanpur/IIT Roorkee conflicts before approval; obtain written permission or legal disposition for NIT Warangal site facts.
- No authorized reviewer exists in the restore database. Owner must provision an authorized reviewer through approved controls; no synthetic account should be used for genuine review.
- Placement, recognition/accreditation and facility staged coverage remains zero; no college is fully enriched.
- Production security and backup/recovery owner checks remain untouched and block production release. No production or DevSync resource was accessed.

## Phase 3 continuation — verified snapshot and targeted batches 017–018 — 2026-11-18

This section is the latest status and supersedes the batch-016 cumulative counts above. Branch remains `phase-3-catalogue-enrichment`. No Phase 2 owner-side production check was attempted; no production/DevSync access, credential change, push, merge or deployment occurred. The 205 original catalogue rows, IDs, slugs, and audit records were preserved. No reviewer decision was inserted.

### Secure archive: latest snapshot restore

- The verified container remained `collegefind-phase3-disposable-20261118`, loopback-bound as `127.0.0.1:35439->5432`. The restore database target was independently checked before import: `collegefind_phase3_restore`, role `cf_phase3_test`, server `172.17.0.2:5432` inside that dedicated container, 205 colleges, zero users, 279 pre-batch claims and zero decisions. The URL was confirmed to use the host loopback binding and the explicit disposable confirmation flag. No other databases/containers were inspected.
- Batch 017 export: `./node_modules/.bin/tsx scripts/export-staging-snapshot.ts --name staged-evidence-after-batch-017` — **PASS**; SHA-256 `34002e2af3995b3831d07dd922fcf27b7b1cec8b5844bd835d78a7ea3cc13dc3`, identity SHA-256 unchanged at `7de99f1f2a5aa88676dfbba2161e56a9ce043a4c6f5d1da82b82957a8e297849`. Snapshot: 205 colleges, 239 sources, 285 claims, 239 import runs, 285 audit records, zero users/decisions/fixtures.
- A new empty `collegefind_phase3_snapshot017_test` was created in the same isolated CollegeFind container, independently URL-checked, and migrated with all five repository migrations. Restore rehearsal: **PASS**, exact read-back for all counts, then retry inserted zero colleges/sources/claims/runs/audits. The target had no users or decisions.
- Batch 018 export: `./node_modules/.bin/tsx scripts/export-staging-snapshot.ts --name staged-evidence-after-batch-018` — **PASS**; SHA-256 `a04c913d25b15cc5d08042d7635098bf7fc4bebec57ce3936edcf87b4b1bbfb5`; same stable identity checksum. Latest counts: 205 colleges, 240 sources, 287 claims, 240 runs, 287 audits, zero users/decisions/fixtures.
- A separate new `collegefind_phase3_snapshot018_test` was independently created and migrated. Rehearsal: **PASS**, exact read-back of 205/240/287/240/287; retry inserted zero records in each table. Reports: `data/pilot/staged-evidence-after-batch-017-rehearsal-report.json` and `data/pilot/staged-evidence-after-batch-018-rehearsal-report.json`. The restorer checks checksums, all 205 stable ID/slug mappings, source/claim/run/audit references and identity uniqueness. No user content or human approvals are archived.

### Targeted real-source batches 017–018

**Batch 017 — Central University of Tamil Nadu.** Official public primary sources were manually read: the [UG admissions page](https://cutn.ac.in/admissions-integrated-ug-4years-programmes/), the [revised CUET UG 2026 eligibility PDF](https://cutn.ac.in/wp-content/uploads/2026/03/Revised_Eligibility_Criteria_Domain_subjects_for_CUET_UG_2026_27032026.pdf), the [21 August 2026 admission closure notice](https://cutn.ac.in/wp-content/uploads/2026/08/Admission_Closure_AY_2026-2027_27082026.pdf), and the [CUTN IT policy](https://cutn.ac.in/wp-content/uploads/2021/11/CUTN_IT_Policy_2021.pdf). The official page lists 22 four-year UG programmes for the 2026–27 cycle; a Chemistry programme and row-level general/OBC-NCL-EWS/SC-ST-PWD eligibility facts were identified. The closure notice expressly closes all CUTN Campus UG/PG admissions for the cycle on 2026-08-21. Six claims were staged (programme list, programme duration, three category-preserving historical admissions criteria, and dated closure status), all UNREVIEWED. Three eligibility claims carry the expired 2026-08-21 validity boundary. Materials Science B.Sc. was excluded based on the linked withdrawal corrigendum; the distinct B.Tech Materials Science and Technology list entry remains. No fees, placements, scholarships, hostel or accreditation claims were created.

The cutoff on source reuse is explicit: CUTN's policy discusses written authorization for content distribution and copying of text/graphics to personal pages, but does not specifically resolve CollegeFind's narrow use of individual facts. We stored concise factual values, attribution, links and locators only; no PDF/table or source prose. This remains for human/legal review before publication and does not authorize bulk automation. All cycle-specific facts are historical, not current admissions advice.

**Batch 018 — Anna University.** The official [Centre for Academic Courses page](https://cac.annauniv.edu/uddetails/revision_ud_ug_cands_2023.html), lines 186–204, identifies the Anna University, Chennai office and lists `044-2235-7076` and `dac@annauniv.edu`. Two structured office-contact facts were staged, UNREVIEWED. They are not described as admissions contacts. No explicit reuse license was located on the consulted page, so storage is limited to these attributed facts and exact locator; terms for bulk retrieval/republication remain open. University department campus distinctions prevent using this page alone to state programme-specific admissions or fees.

Exact manifests and dry-run/apply/retry reports: `data/pilot/substantive-research-batch-017.json`, `data/pilot/substantive-batch-017-{dry-run,import,idempotency}-report.json`, `data/pilot/substantive-research-batch-018.json`, and `data/pilot/substantive-batch-018-{dry-run,import,idempotency}-report.json`.

### Current catalogue and review state after batch 018

- Research disposition: **205/205** original colleges; 73 have at least one substantive source-backed claim, 132 have no substantive claim staged. This is not fully enriched coverage.
- **140 substantive claims** are STAGED/UNREVIEWED across 73 colleges; 147 link-only references bring latest snapshot total to **287 claims**. Genuine verified claims/institutions: **0/0**. Fully enriched institutions: **0**.
- Field overlay counts: course lists 28 claims/28 colleges; scalar admission/status summaries 13/13; structured programmes 28/28; structured eligibility/admissions 41/35; typed fees 16/10; scholarships 3/3; legacy contact values 4/2; structured contacts 5/3; typed NIRF ranks 2/1; placement/accreditation/recognition/facilities 0. Percentages and per-field raw DEMO/MISSING status are in `docs/DATA_COVERAGE.json`. Raw seed columns were not promoted or overwritten.
- Read-back of the 287-claim database: 240 sources/runs, 287 field evidence audit rows, zero users, zero decisions, zero fixtures, no orphan sources and no claim without a staging audit. Six claims are expired; 41 lack both year and source publication date. No active same-scope value conflict was found by the queue grouping query. These are integrity/metadata checks, not factual/campus confirmation.

### Prioritized authorized review queue

`docs/DATA_COVERAGE.json` now lists 132 claims as ready to **open and inspect**, six expired claims to hold, and two IIT Kanpur claims to hold for source discrepancy. “Ready to open” is not preapproval: no claim is approval-ready until a reviewer verifies identity/campus, source contents, year/category, locator, conflicts, staleness, and source-use terms. Specific expired IDs and source details are in `substantiveResearchSummary.batch018ReviewAudit.expiredClaims`.

1. Hold/reject/replace the six expired 2026-cycle admissions claims (three IISER and three CUTN Chemistry); never show them as current.
2. Hold both IIT Kanpur facts until the DoAA Manual vs undated programme page discrepancy is reconciled.
3. For CUTN, verify university/campus and exact category matching, confirm cycle closure, review the withdrawn B.Sc. Materials Science notice, and make an explicit rights determination before publication.
4. Re-open every remaining claim against its source, with higher priority for admissions, fees, ranking and other time-sensitive facts. Confirm campus and program/category scope, check conflicts/staleness, and record an individual human approval/rejection reason.
5. Resolve 41 records with no year and no publication date; require current source data for cycle-sensitive claims.

No real authorized reviewer account exists in the restore archive; no genuine approval is available. The review dashboard and synthetic approval/rejection/public-projection browser tests passed in the prior unchanged-code gate, but those synthetic decisions are isolated in a separate test database and do not count as real verification. Existing 132 claims were not individually re-opened in this increment; manual source/campus revalidation remains 0/140.

### Exact checks for this continuation

- Batch 017 dry run: `./node_modules/.bin/tsx scripts/ingest-official-facts.ts --file data/pilot/substantive-research-batch-017.json --report data/pilot/substantive-batch-017-dry-run-report.json` — **PASS**, six facts, no write.
- Batch 017 apply against the guarded verified disposable target — **PASS**, six staged, three sources and three runs created; immediate identical retry **PASS**, zero staged/six reused, zero sources/runs created and `databaseChanged=false`.
- Batch 018 dry run: `./node_modules/.bin/tsx scripts/ingest-official-facts.ts --file data/pilot/substantive-research-batch-018.json --report data/pilot/substantive-batch-018-dry-run-report.json` — **PASS**, two facts, no write.
- Batch 018 apply — **PASS**, two staged, one source/run created; identical retry **PASS**, zero staged/two reused, no added rows.
- `npm run test:integration -- --reporter=dot` on the fresh separate review database — **PASS, 63/63**; desktop/mobile reviewer/comparison Playwright — **17 passed, 1 intentional skip**; desktop/mobile smoke Playwright — **14 passed**; lint and typecheck — **PASS** in the previous unchanged-code verification. These were not repeated because this increment changed only research JSON and documentation, not code.
- `git diff --check` — **PASS** after the final documentation/ledger edits. JSON/report reconciliation — **PASS**: 205 unique original slugs match the ledger and snapshot; SHA-256 and identity checksum match; snapshot IDs/references/audits are unique and complete; 240 sources/runs and 287 claims/audits reconcile; no fixtures/users/decisions are in the archive. No production build or Prisma generation was repeated because no code/schema/migration changed; prior passing build and Prisma generation remain applicable to unchanged implementation.

### Changed files in this continuation

- `data/pilot/substantive-research-batch-017.json` and its dry-run/import/idempotency reports, snapshot JSON/manifest and restoration report.
- `data/pilot/substantive-research-batch-018.json` and its dry-run/import/idempotency reports, snapshot JSON/manifest and restoration report.
- `docs/DATA_COVERAGE.json`, `docs/DATA_COVERAGE.md`, `docs/UPGRADE_STATUS.md`.

No application code, schema, migration, seed catalogue, user data or auth/security configuration changed. Next safe action: an authorized human reviewer should inspect the 132 non-expired/non-known-conflict claims through `/admin/enrichment` and explicitly record decisions; meanwhile continue bounded official-source follow-up for the 132 institutions without staged substantive facts, starting with specific programme/fee/admissions publications and resolving known provider/campus blockers without retrying identical failed requests.

## Phase 3 continuation — reviewer handoff and substantive batch 022 — 2026-11-18

This section is the latest continuation and supersedes older cumulative totals above. Branch: `phase-3-catalogue-enrichment`, commit remains `19d8c91`. Pre-existing uncommitted code, migration and test work was preserved. No application/schema/seed change, push, merge, deployment, credential operation, production access or DevSync access occurred.

### Reviewer queue and claim status

- Reviewed the current admin queue implementation: server-side status/search/conflict filtering, total count and database-side pagination; stable ordering; filters for status, free-text search, college, campus/city/state, field, academic year and freshness; source-opening links; reviewer decision history; and explicit approve/reject controls. Claim cards include College name, campus aliases/identity warning, field, proposed value, academic/reporting year, validity, publisher, source URL and evidence location. State labels include DEMO fixture, STAGED, VERIFIED, EXPIRED/STALE and CONFLICTED. Substantive facts sort ahead of link-only references. `ALL` plus pagination can inspect the complete archive rather than a capped first page.
- Approvals require an authorized admin, a reason, and server-side eligibility checks. Fixture, held, expired, future and conflicted claims cannot be approved; rejection remains available. Every real decision is audited. No real reviewer account or decision exists in the archive, so reviewer UI readiness is verified by code inspection and previous synthetic desktop/mobile browser coverage, but authorized real review is **BLOCKED** pending owner-provisioned reviewer access.
- Current counts: 342 total claims = 195 substantive +147 link references. Of 195 substantive claims, 179 are open for inspection and 16 are held. “Open” is not “approval-ready”: human source/campus/value review remains 0/195. Genuine human approvals: 0; genuine VERIFIED claims/institutions: 0/0; fully enriched institutions: 0.
- The 16 held claims comprise six expired 2026 admissions claims, two IIT Kanpur source-list disputes, four MNNIT admissions scope collisions (not established factual contradictions), one IIM Amritsar CAT-2025/MBA-2026-28 historical record, and three IIM Bangalore claims (two 2026-28 admissions facts plus the linked programme fact held for source-use review). Their exact IDs and reviewer questions are in the latest `humanReviewManifest` in `docs/DATA_COVERAGE.json` and the latest Markdown handoff section. No historical event or decision was fabricated.
- Review order: resolve expiry/dispute/scope/source-use holds first; then inspect current/year-sensitive admissions and fees; rankings and placement denominator/cohort; programme facts; contact facts; finally the 147 link references for domain/redirect/campus. Every reviewer decision must be individual and reasoned.

### Batch 022 research and import

- Followed up four colleges from existing no-stage dispositions: Christian Medical College Vellore, IIM Bangalore, BITS Pilani and IIM Lucknow. Directly opened primary evidence supported eight candidates for CMC and IIMB. BITS official fee and eligibility pages timed out on direct access; search output was not used as evidence. IIM Lucknow's accessible 2026-28 CAT-2025 policy covered a completed cycle, so it was not staged as current information.
- CMC Vellore's 2026-27 prospectus directly supports MBBS 4.5-year study plus 12-month internship, 2026-cycle NEET-based MBBS admission/eligibility, ₹3,000 annual MBBS tuition, and gender-scoped ₹10,000 one-time hostel deposits/advances. These are five staged claims. No total fees, annual hostel tariff, admissions deadline or open-status claim was derived.
- IIMB's directly opened 2026-28 PGP policy supports a two-year MBA/PGP and two category-specific minimum application qualifications with CAT validity. These three claims are STAGED but held pending source-use review; the admissions claims are also held as 2026-28 cycle only. Its published copyright policy says IIMB website content is protected and partial/full reproduction requires permission; CollegeFind did not copy documents or prose. This task does not conclude that each individual fact needs a licence, and does not infer permission for bulk extraction or public display. A human source-use determination is required before approval.
- Provider terms: CMC prospectus showed no matching reproduction notice on the consulted publication; its separate intellectual-property page concerns patent/process contacts and does not establish content reuse rights. No bulk permission is inferred. Both provider records and policy URLs are now noted in `docs/DATA_COVERAGE.json`; source facts remain unreviewed.
- Eight facts passed dry run and first import staged 8 claims, created 2 sources and 2 import runs, and wrote 8 staging audits. The immediate identical retry staged 0, reused all 8, created 0 sources/runs and returned `databaseChanged=false`.

### Safe database and archive evidence

- Before import, an independent read-only SQL identity/count query against the already-confirmed disposable target returned database `collegefind_phase3_restore`, role `cf_phase3_test`, container-side server `172.17.0.2:5432`, 205 colleges, 334 prior claims, zero users and zero evidence decisions. The configured host binding remains the dedicated CollegeFind loopback disposable target `127.0.0.1:35439`; no other database/container was queried.
- New versioned export: `data/pilot/staged-evidence-after-batch-022.json` and manifest. SHA-256 `d6611b23e0a9aeb42285ab126ef035ae0f1e6caf1ace3406d988fc2c747fac4b`; counts 205 colleges, 247 sources, 342 claims, 271 import runs and 342 staging audits; zero users, decisions and fixture claims. Stable identity checksum is unchanged at `7de99f1f2a5aa88676dfbfa2161e56a9ce043a4c6f5d1da82b82957a8e297849`.
- Batch 019 converted 25 already-researched NIRF Engineering candidates to typed staged records; batches 020–022 together added 30 claims, 6 new source records and 29 new import runs (including the 25 NIRF run records). Against the stated 287-claim pre-019 snapshot, current total is 342. No existing evidence was deleted/overwritten.

### Catalogue coverage and exact verification

- Substantive research dispositions: 205/205. Colleges with staged substantive claims increased 101→103; researched with no staged substantive claim decreased 104→102. Substantive claims increased 187→195; references remain 147. Field overlays increased: structured programmes 29→31 claims/colleges, structured admissions 50→53 claims and 37→39 colleges, structured fees 19→22 claims and 11→12 colleges. Other overlay counts are in `docs/DATA_COVERAGE.json`. All verified counts remain zero, and seed DEMO/MISSING data remains unpromoted.
- `npx tsx scripts/ingest-official-facts.ts --file data/pilot/substantive-research-batch-022.json --report data/pilot/substantive-batch-022-dry-run-report.json` — **PASS**, 8 candidates, read-only. First sandbox invocation failed at tsx IPC pipe creation (`EPERM`); the same command passed after host permission escalation.
- `TEST_DATABASE_URL` was sourced from `/tmp/collegefind-phase3-restore.env` without printing its value; `COLLEGEFIND_TEST_DATABASE_CONFIRMED=true`. The guarded `--apply` command — **PASS**, 8 staged / 2 sources / 2 runs. Immediate guarded retry — **PASS**, 0 staged / 8 reused / 0 sources / 0 runs / no database change.
- `npx tsx scripts/export-staging-snapshot.ts --name staged-evidence-after-batch-022` — **PASS**, counts and digest above.
- No source-side approval was created. No code changed, so builds, lint, typecheck, Prisma generation and browser tests were not repeated. Previously passing code checks remain the applicable evidence for unchanged application code. The documentation/ledger consistency checks and `git diff --check` are run after the final edits and recorded below.

### Changed files and remaining work

- Changed/added this continuation: `docs/UPGRADE_STATUS.md`, `docs/DATA_COVERAGE.md`, `docs/DATA_COVERAGE.json`; `data/pilot/substantive-research-batch-022.json`; batch-022 dry-run/import/idempotency reports; `data/pilot/staged-evidence-after-batch-022.json` and manifest.
- Still blocked: authorized human reviewer account and real decisions; source-use determination/permission for held IIMB facts; resolution of the 16 held claims; manual source/campus/accuracy check across the 179 inspectable claims; useful substantive fields for 102 colleges; provider terms for bulk ingestion; current placement, accreditation/recognition and facility evidence for most colleges; owner-side Phase 2 production security and backup/restore checks.
- The next safe task is an authorized reviewer-led first pass of the 16 held claims (including written source-use disposition for IIMB), followed by current year-sensitive claims. Research can continue on the 102 no-stage colleges using directly accessible, exact official sources without repeating failed homepage requests.

### Final consistency checks for this continuation

- `git diff --check` — **PASS** after all final documentation edits.
- Read-only JSON/archive reconciliation — **PASS**: parsed `docs/DATA_COVERAGE.json` and batch-022 snapshot/manifest; matched all 205 original seed slugs to 205 ledger slugs; SHA-256 matched the snapshot manifest; 205 identities, 247 sources, 342 claims, 271 runs and 342 audits reconciled; claim/source/run/audit IDs are unique and all references resolve; 179 open substantive claims +16 held +147 link references =342 total; zero users/decisions/fixtures.
- The first pass of the review-manifest check caught four held records still duplicated in the open-review index. The index was corrected without changing any archived claim or audit record, and the final reconciliation passed with 179 open /16 held.
- No unit, integration, Playwright, lint, typecheck, Prisma generation or build command was rerun because this continuation changed only research manifests, snapshot artifacts and documentation, not application/schema/migration code. Previous applicable browser/build evidence remains the latest code verification. No claim is considered verified from these checks.

## Phase 3 continuation — owner review handoff and targeted batches 025–027 — 2026-11-18

Branch remains `phase-3-catalogue-enrichment` at local commit `19d8c91`. Existing uncommitted application/schema/migration/test work was preserved. The original 205 colleges, IDs/slugs, prior claims, provenance, source identity, and audit records remain intact. No production or DevSync access, credential change, push, merge, or deployment occurred.

### Owner access and review readiness

The `/admin/enrichment` dashboard is implemented for ADMIN accounts. It presents college/campus, field/value, year/category, publisher, exact source link and evidence locator; shows conflicts, freshness/expiry and prior decisions; supports search/filter/database pagination; and exposes explicit approve/reject controls. Server authorization and audit logging remain enforced. Registration creates only USER. There are no reviewer accounts in the archive, and no genuine decision has been made. The 25-claim first review packet in `humanReviewManifest.firstHumanReviewBatch.claims` remains unchanged and is ready for inspection. The 16 existing held claims are separate and remain held.

Owner action to use it locally: create a fresh isolated local review DB from the latest snapshot; verify database identity and loopback target before connection/confirmation; set local-only untracked `.env.local` with that `DATABASE_URL`, `NEXTAUTH_URL=http://localhost:3000`, and a locally generated `NEXTAUTH_SECRET`; register the owner at `/register`; re-verify DB identity; then, using only the verified local DB owner, promote the owner-created USER to ADMIN with a parameterized `UPDATE "User" SET role='ADMIN' WHERE lower(email)=lower($1) AND role='USER' RETURNING id,email,role`. Log in again and verify `/admin/enrichment`. Never run that update against production, DevSync or an unverified database. No account was created/promoted here.

### Targeted research, staging, and snapshot

After snapshot `staged-evidence-after-batch-025` (364 claims, 262 sources, 286 runs, 364 staging audits), batch 026 staged two programme claims: Tripura University BBA (no duration inferred) and GTU School of Management Studies four-year BBA Honours, with school scope and historical introduction year. Identical retry reused both claims without creating source/run rows. Snapshot 026: 205 colleges, 264 sources, 366 claims, 288 runs, 366 audits; zero users/decisions/fixtures; SHA-256 `6630fd8fc9b0b8d7a7fceb5402004d788fd815a47bc728bbd747cd51d1af9782`.

Batch 027 researched 20 institutions with documented dispositions and staged 11 facts across five colleges: six Amrita B.Sc. Psychology programme/admission/fee claims (Coimbatore and Nagercoil tuition kept separate; Coimbatore hostel and mess separated), NIT Agartala CSE B.Tech, NIT Srinagar B.Tech branch list/duration, Bennett B.Tech AI 2027 programme/eligibility, and University of Calcutta Chemical Technology B.Tech duration. Claims remain UNREVIEWED. The 2026 Calcutta lateral-entry deadline had passed and was not presented as current. Old Bennett fee/scholarship tables were excluded. Ambiguous or inaccessible material remained research-only. The 11-claim retry reused all claims with `databaseChanged=false`.

Before each apply, the dedicated CollegeFind Docker container was confirmed loopback-bound at `127.0.0.1:35439`; read-only database identity was `collegefind_phase3_restore` / `cf_phase3_test` with counts matching the prior snapshot. No data was overwritten. Latest archive [`staged-evidence-after-batch-027.json`](data/pilot/staged-evidence-after-batch-027.json), SHA-256 `24c039bb7fd13a994e0c0e01ce1059f06dc7c492e118aa3cbfbaefe4b2697fbf`, identity SHA-256 unchanged `7de99f1f2a5aa88676dfbfa2161e56a9ce043a4c6f5d1da82b82957a8e297849`: **205 colleges, 269 sources, 377 claims, 293 import runs, 377 staging audits, zero decisions/users/fixtures**.

### Current coverage after batch 027

- 205/205 first-pass substantive research dispositions remain complete.
- 123 colleges have at least one staged substantive claim; 82 have no staged substantive facts.
- 230 claims are substantive STAGED/UNREVIEWED; 147 are link-only reference claims; total 377.
- 214 substantive claims are open for inspection and 16 remain held. Genuine VERIFIED claims/colleges: **0/0**. Fully enriched colleges: **0**.
- Field counts (claim / institution): courses 28/28; scalar admissions facts 17/14; phone 2/2; email 2/2; structured programmes 49/48; structured admissions 59/45; fees 32/16; scholarships 7/5; contacts 5/3; NIRF 27/26; placement 2/1. Per-field percent and untouched DEMO/MISSING raw seed state are in `docs/DATA_COVERAGE.json`.

### Publication test and checks

- Verified the separate browser DB `collegefind_phase3_test` before running: loopback-only in the dedicated CollegeFind disposable container; database role `cf_phase3_test`; 29 catalogue rows, of which 28 were marked DEMO and the remaining synthetic row was named “Fixture” with UNVERIFIED status; all 18 user accounts used test-only domains. Existing saved/comparison relationships were preserved. The database is distinct from the staged-evidence restore database.
- `./node_modules/.bin/playwright test tests/e2e/admin.spec.ts --reporter=list` — **2 passed** (desktop Chromium and mobile) after adding a focused structured-fee publication assertion. Test-only approval verified the fee is hidden while staged, then visible with year, category, amount and source attribution after approval. Existing synthetic programme publish/reject/audit and fixture-denial checks also passed. No decision was written to the restore database or counted as real verification.
- Prior unchanged-code checks remain applicable: PostgreSQL integration **63/63**, comparison Playwright **15 passed / 1 intentional skip**, smoke Playwright **14 passed**. They were not repeated because application code/schema did not change.
- Batch 026 dry run **PASS 2**, apply **PASS 2 staged**, retry **PASS 2 reused/0 DB changes**. Batch 027 dry run **PASS 11**, apply **PASS 11 staged**, retry **PASS 11 reused/0 DB changes**. Snapshots exported from the verified restore database.
- `npm run lint`, `npm run typecheck`, `git diff --check`, machine JSON validation, snapshot checksum/referential reconciliation were run after changes; exact terminal results are recorded in the final status update below.

### Changed files in this continuation

- `tests/e2e/admin.spec.ts` (synthetic structured-fee publication assertion).
- `data/pilot/substantive-research-batch-025.json` and existing batch-025 reports/snapshot; `data/pilot/substantive-research-batch-026.json` and its dry-run/import/idempotency reports/snapshot; `data/pilot/substantive-research-batch-027.json` and its dry-run/import/idempotency reports/snapshot.
- `docs/DATA_COVERAGE.json`, `docs/DATA_COVERAGE.md`, `docs/UPGRADE_STATUS.md`.

No code changes were made beyond the focused browser test. Current owners still need local account provisioning and 25 individual human review decisions; 16 existing holds remain unresolved; source-use and campus validation remains claim-specific; there are 82 no-stage colleges; there are zero genuine verified colleges. Continue with another targeted 20–30-college batch after the owner handoff.

### Final exact verification after the current edits

- `./node_modules/.bin/playwright test tests/e2e/admin.spec.ts --reporter=list` — **PASS: 2 passed** (desktop Chromium and mobile; 11.4s). It used the verified separate `collegefind_phase3_test` target in the CollegeFind disposable container. The new structured-fee assertion verified that a synthetic STAGED fee was absent from the public profile before approval and appeared afterward with the 2026 year, campus/category, amount and source attribution. Synthetic decisions are confined to this test DB and do not count as genuine reviews.
- `npm run lint` — **PASS**, exit code 0.
- `npm run typecheck` — **PASS**, exit code 0.
- `git diff --check` — **PASS**, exit code 0.
- JSON/snapshot/handoff reconciliation — **PASS**: 205 unique ledger slugs and identities; snapshot SHA matches its manifest; 230 substantive claims across 123 institutions plus 147 references; 214 open human-review claims plus 16 held; the 25 first-review IDs are all present and not held; 377 claims and staging audits reconcile; zero snapshot decisions, users or fixture claims.
- Batch importer checks: batch 026 dry-run 2; apply 2 staged; identical retry 2 reused/0 changed. Batch 027 dry-run 11; apply 11 staged; identical retry 11 reused/0 changed. Latest snapshot has 205/269/377/293/377 college/source/claim/run/audit counts.
- Integration suite (63 passed), comparison browser suite (15 passed, 1 intentional skip), smoke suite (14 passed), production build and Prisma generation were not repeated: no application, schema, migration, projection or importer code changed in this increment; only one E2E assertion and evidence/ledger/docs changed. The prior database-backed checks used their separate disposable environments and remain applicable to unchanged code.

The only remaining human-review blocker is owner-side access: there is no owner account in the evidence archive and registration alone creates a USER. The owner must restore the latest snapshot into a fresh local review database, create their own account, promote only that account to ADMIN after verifying the local DB target, and then inspect/decide the 25-claim packet. Sixteen existing holds remain untouched. Source-specific rights/campus review is required per claim; no genuine verification was achieved here.

## Phase 4 cutoff scale, source and UX verification — 2026-11-19

Branch remains `phase-4-profiles-cutoffs`. This increment preserved all 205 original catalogue entries and stable slugs, the Phase 3 evidence/review history, and the uncommitted Phase 4 work. No production, DevSync, owner-review database, account, credential or source record was changed. The disposable test target was `collegefind_phase4_migration_test` on loopback `127.0.0.1:35440`; the test suite populated it only with synthetic rows and reviewer decisions. It is not official cutoff coverage.

### Implementation and issue fixed

- The explorer now clamps a requested page beyond the filtered result's last page to the last page (page 1 for an empty result), retaining accurate total counts rather than rendering a misleading empty page.
- Added a client filter form that synchronizes inputs from the URL on browser Back/Forward and `pageshow`; server query parameters remain the source of truth. The regression had been exposed by browser checks: URL changed to the previous filters but the restored input retained the newer value. No assertion was weakened.
- Added API regression coverage requiring invalid year ranges to return HTTP 400 before a database query.
- Measurement showed repeated latest-review lookups were costly. Added Prisma index `EvidenceDecision(cutoffId, createdAt DESC, id DESC)` in additive migration `20261119020000_cutoff_review_lookup_index`. The new index is performance-only and preserves rows/relationships. `EXPLAIN ANALYZE` now uses it for the latest decision. The selective cutoff filter uses the existing `CutoffRecord_exam_category_seatPool_year_idx`; the broad fixture query sequentially scans 2,001 cutoff rows, as expected for the complete result set.

### Scale correctness and local performance

`npx vitest run --project integration tests/integration/cutoff-explorer.test.ts --reporter=dot` — **PASS, 6/6** against the verified disposable database. Tests cover 61 records over default pages and 2,001 records over 21 pages; multiple institutions/programmes, years, systems, exams, categories, quotas, seat pools, rounds, metrics and rank types; tied display/sort values with ID tie-breaker; missing dimensions defaulted to `UNSPECIFIED`; rank/source metadata; approved/rejected/latest-review projection; compound filters; page boundaries and out-of-range page clamp. Every page was compared with independent deterministic expected rows/counts. Invalid API range returns 400. `npx prisma migrate status` with the disposable environment reported seven migrations and schema up to date. An earlier invocation omitted that environment, targeted unavailable `localhost:5432`, and exited P1001 without connecting; it was not used for tests or writes.

The 2,001-row benchmark used ten warmups and 100 samples for each production query shape. Latencies (milliseconds, p50/p95/p99) were: nonselective page 1 **14.896/16.545/22.377**; nonselective page 21 **19.178/20.938/22.330**; selective page **2.293/4.987/5.657**; nonselective filtered count **7.081/10.734/12.563**; selective count **2.366/3.858/4.799**. The plans had zero shared-read blocks in these warm-cache measurements. These are local synthetic results only, not production promises. Before the index, this same harness recorded roughly 275 ms p50 for a broad page and 2,001 sequential evidence-decision lookups; the final plan used the new index and reported roughly 15 ms p50.

### Official-source assessment

The official JoSAA OR/CR page exposes the current-year rank listing and links to earlier-year materials; the archive page offers year, round, institute/programme and category dimensions. JoSAA's current public page defines OPEN as CRL, reserved seats as the respective category rank, PwD ranks within category, and `P` as preparatory rank. Its copyright policy says reproduction requires proper permission from NIC/stakeholders and separately requires rights-holder permission for third-party material. This is not an open bulk-reuse licence. We did not bypass dynamic pages/access controls or infer that public viewing permits automated extraction, repository storage or redistribution. No source-specific reproduction approval or permissively licensed official cutoff dataset was established. **No real cutoff was imported or staged; official staged/genuinely verified counts remain 0/0.** JoSAA candidates are still the practical pilot source only after written permission for the intended extraction/storage/display, or discovery of a suitable licensed dataset. NIRF rankings are not cutoffs.

### Browser, build and code checks

After fixing URL-state restoration, `npx playwright test tests/e2e/smoke.spec.ts --grep 'cutoff explorer|college profile links to its own reviewed cutoff history' --reporter=list` — **PASS, 6/6**, desktop Chromium and Pixel 7. It verified filters after submit/reload/Back/Forward, invalid-filter state and clear action, no viewport-level horizontal overflow at mobile width, profile-to-explorer navigation, and source attribution from a synthetic reviewed record. The immediately preceding run had 4 passes and 2 failures on the stale input after browser Back; this regression was fixed and the same assertions then passed.

`npx next build --webpack` with the disposable database and throwaway local auth secret — **PASS** after the UI change; expected `.next` production routes include `/cutoffs` and `/api/cutoffs`. `npm run lint` — **PASS**; `npm run typecheck` — **PASS**; `npm test -- --run tests/unit/cutoff-query.test.ts` — **PASS, 2/2**; `git diff --check` — **PASS**. Prisma generation had passed after the schema/index update. No production setting or secret was read/changed. Local performance and browser checks do not establish deployed health.

### Phase 4 acceptance snapshot

| Area | Status | Evidence / remaining limit |
|---|---|---|
| Complete server-side filtering/counting/pagination and stable order | **PASS (tested to 2,001 synthetic rows)** | Six integration tests, all-page ID reconciliation, API validation and 61-row default-limit regression coverage. No production-scale/SLA claim. |
| Query performance and indexes | **PASS (local measurement)** | EXPLAIN verified index use and latency distribution above; production workload/profile still unmeasured. |
| Desktop/mobile cutoff navigation and accessible filter labels | **PASS (focused browser scope)** | Six desktop/mobile cutoff smoke checks. Full screen-reader/keyboard/manual profile audit remains open. |
| Verified-only projection and fixture isolation | **PASS (automated synthetic tests)** | Approved rows only; latest reject removes a row; demo, unreviewed and insecure-source rows excluded. Synthetic reviewer decisions are not real approvals. |
| Legacy missing dimensions | **PASS** | Existing unknown counselling/rank dimensions remain `UNSPECIFIED`; no inference. |
| Official cutoff coverage | **BLOCKED / 0 records** | JoSAA source use terms require permission for reproduction; no explicit permission or suitable open licensed data found. Obtain written use approval or a compatible official dataset before importing. |
| Cutoff evidence row/page locator and trends | **PARTIAL** | Source URL/dates/publisher preserved; schema does not yet capture precise row/page locator; trend charts remain absent. |
| Genuine official data and reviewer approvals | **BLOCKED / 0** | No actual cutoffs staged or approved; public explorer correctly shows empty state. Human review and source permission remain required. |
| Production readiness | **BLOCKED** | Existing Phase 2/3 owner-controlled security, backups, credentials and deployment verification blockers remain unchanged. No production access occurred. |

Performance migration rollback is documented in `docs/UPGRADE_PLAN.md`; it is an additive, data-preserving index. A production rollback or migration still requires owner authorization and a verified backup. Next scoped work: confirm JoSAA permitted-use terms or select an appropriately licensed source, then implement a reviewed source locator/staging pilot without changing the zero verified count until a genuine reviewer decision.

## Owner-review workflow completion — 2026-11-18

Branch remains `phase-3-catalogue-enrichment` at `19d8c91`; existing work and the 205 original identities are preserved. No production or DevSync resources, credentials, account roles or real decisions were changed.

### Review UI and secure local owner environment

- Reviewed `src/lib/auth.ts`, `src/lib/session.ts`, registration, `/admin/enrichment`, and `/api/admin/evidence`. Credentials auth uses the existing user table and role in the JWT; server authorization reloads the current DB role (`getSessionUser`), and admin writes use `requireAdmin`, origin/rate-limit checks, reason validation and audited review services. Registration creates USER only. Unauthenticated dashboard requests redirect to login; a normal USER is denied. No self-elevation endpoint exists.
- Added an ordered first-review packet panel to the admin dashboard. Its 25 entries expose institution/slug, exact claim ID, field/value, year/scope, publisher/source URL, evidence location and a reviewer question, with links to the official source and exact claim queue filter. Queue free-text search now matches stable claim IDs. All 16 held claims remain excluded from the packet and server-side approval remains blocked for held/expired/future/conflicted/fixture records.
- Added `data/pilot/first-human-review-batch.json`, generated from the canonical coverage ledger by `scripts/export-owner-review-packet.ts`; unit test asserts exact parity, 25 unheld STAGED items, source/evidence/question presence and no synthetic approvals. The dashboard claims themselves continue to load their authoritative current status/source/audit data from PostgreSQL.
- Provisioned a fresh owner-review clone `collegefind_phase3_snapshot_owner_review_20261118_test` in the dedicated CollegeFind-only Docker container. Before create/restore, verified loopback-only `127.0.0.1:35439`, existing archive DB identity/role, and that the new DB name did not exist. Applied five migrations and rehearsed the batch-027 archive. Exact read-back passed: 205 colleges, 269 sources, 377 claims, 293 runs and 377 staging audits. Immediate idempotency retry inserted zero rows; decision/user/fixture counts are 0. Snapshot SHA-256: `24c039bb7fd13a994e0c0e01ce1059f06dc7c492e118aa3cbfbaefe4b2697fbf`. Existing restore and browser databases were not overwritten.
- The local owner setup commands and guarded one-account promotion procedure are in `docs/DATA_COVERAGE.md` under “Owner-local review setup and dashboard handoff”. They use only the fresh clone, require exact identity/count/loopback checks, clear direct/staging DB overrides and Redis variables, generate a local auth secret without displaying it, and update only the owner-entered email if exactly one USER matches. The owner must still register their own account and execute the promotion themselves. No account was created or promoted here.

### Changed files

- `src/server/evidence-queue.ts`: added claim ID matching to the existing parameterized SQL search filter.
- `src/app/admin/enrichment/page.tsx`: added the ordered review packet and exact claim-ID queue links; clarified the search label.
- `tests/integration/evidence-queue.test.ts`: verifies claim-ID search in the conflicted state.
- `tests/e2e/admin.spec.ts`: verifies packet metadata/links and authenticated claim-ID search; updates the accessible search locator.
- `tests/unit/review-packet.test.ts`, `scripts/export-owner-review-packet.ts`, `data/pilot/first-human-review-batch.json`.
- `docs/DATA_COVERAGE.md`, `docs/DATA_COVERAGE.json`, `docs/UPGRADE_STATUS.md`.

### Actual verification

- `npx vitest run --project unit tests/unit/review-packet.test.ts` — **PASS, 1 test**.
- `npx vitest run --project integration tests/integration/evidence-queue.test.ts` — first run exposed an incorrect new assertion using the default STAGED filter against a conflicted record; the test was corrected to request CONFLICTED. Rerun **PASS, 1 integration test** on `collegefind_phase3_test` after safety preflight. No application defect was found in that first test failure.
- `npx playwright test tests/e2e/admin.spec.ts --workers=1 --reporter=list` with `E2E_PORT=3100` — **PASS, 2 tests** (Chromium desktop and mobile). It verifies unauthenticated denial, USER denial, packet contents/official-source link, exact claim-ID search, conflict and pagination flows, fixture approval denial, reasoned approve/reject with audit, and synthetic STAGED→approved public programme/fee projection with year/category/source. The first post-label-change browser run reached the empty-state assertion but timed out because that test still used the old accessible label; the locator was updated, and the complete rerun passed. Synthetic test approvals remain in the separate `collegefind_phase3_test` only and do not count as real decisions.
- `npx eslint src/server/evidence-queue.ts src/app/admin/enrichment/page.tsx tests/e2e/admin.spec.ts tests/unit/review-packet.test.ts scripts/export-owner-review-packet.ts tests/integration/evidence-queue.test.ts --max-warnings=0` — **PASS**.
- `npm run typecheck` — **PASS**. `git diff --check` — **PASS** before the last documentation/ledger update; rerun after final edits.
- Next.js dev server compiled and served the changed review page successfully for both browser projects. Production build was not rerun; prior production build evidence predates this small page/search change. No other full suites were repeated.

### Current evidence and owner actions

- Latest staged snapshot remains unchanged: 205 colleges, 269 sources, 377 claims, 293 runs, 377 audits; 230 substantive claims, 147 reference claims; 214 substantive claims open for inspection, 16 held; genuine approvals/VERIFIED claims/institutions remain **0/0/0**.
- Browser E2E proves authorization and synthetic publication behavior, but does not authenticate the project owner. The restored owner clone intentionally has zero users; follow the documented setup, register your own account, confirm exactly one USER match, then promote only that account locally. After log out/in, verify the dashboard and the first packet before deciding any claim.
- The first 25 claims still require the owner's independent source/campus/scope/year/reuse review. Do not clear the 16 holds automatically. Production access, production security, genuine review and production release are not verified by this local work.

### Final verification after packet-link filter reset — 2026-11-18 16:29 UTC

- Final code clears unrelated active filters from a packet's “Open this claim” link, ensuring the ID selected in the packet remains visible even when the reviewer was previously filtering another college/year/field.
- `npx next build --webpack` — **PASS** on the final code. The first sandbox attempt failed because Next's TypeScript subprocess was blocked with `EPERM` and returned empty `--showConfig` output; the direct compiler invocation emitted valid config. A host-approved rerun compiled and completed all 44 static pages. One intermediate command omitted exporting the derived local database name and therefore logged the sitemap's guarded database-unavailable warning; the corrected final command used the verified owner-review clone and completed with no sitemap fallback warning.
- `npx playwright test tests/e2e/admin.spec.ts --workers=1 --reporter=list` with `E2E_PORT=3100` — **PASS, 2 tests** against the built production server (`next start`), desktop Chromium and mobile. Verified packet panel and exact source/year/value/evidence/reviewer question content; packet link opens claim-ID search independent of other filters; unauthorized denial; reviewer reason and audit; synthetic staged→verified publication and rejection; year/category/source rendering; fixture isolation. Rate-limit memory fallback was explicitly selected for this local test environment with Redis variables empty; this is not evidence about production Redis.
- The owner runbook's actual loopback/DB identity and 205/269/377/293/377/0/0/0 count command, plus its parameterized owner-email match query, were executed read-only against the new clone — **PASS**; the owner account match count is 0 before owner registration.
- Focused integration queue test remains **PASS, 1 test** on the verified disposable test DB; packet parity unit test **PASS, 1 test**. Changed-file ESLint, `npm run typecheck`, and `git diff --check` all **PASS** after final code/docs edits. The snapshot export/rehearsal report at `data/pilot/staged-evidence-after-batch-027-rehearsal-report.json` confirms exact read-back and zero-write retry.
- `AGENTS.md` was briefly touched by Next dev's generated guidance block; that tool-generated hunk was removed, restoring the file to its pre-task state. It is not part of this task's changed files.
- Current real-data result is unchanged: 377 staged claims, 230 substantive, 147 link references, 214 substantive open for inspection, 16 held, zero genuine approvals/VERIFIED claims/verified institutions. The fresh owner-review clone still has zero users and decisions. The test-only browser database contains only synthetic test accounts/claims/decisions; its data is separate and does not enter the snapshot or catalogue counts.

## Phase 3 acceptance decision and Phase 4 gate — 2026-11-18

This is the current acceptance addendum and supersedes earlier cumulative counts. Branch is still `phase-3-catalogue-enrichment`, local HEAD `19d8c91`. Existing dirty Phase 2/3 work was preserved and not staged. No code, schema, migration, credentials, production or DevSync resources were changed in this increment.

### Requirement-by-requirement acceptance

| Phase 3 requirement | Status | Evidence / limitation |
|---|---|---|
| Canonical institution/campus identity, stable IDs/slugs, aliases, deterministic matching and ambiguity handling | **PASS** | `prisma/schema.prisma`, `src/server/ingest/catalogue.ts`; integration evidence in `tests/integration/catalogue.test.ts`; latest archive identity checksum and 205 stable ID/slug rows reconcile. |
| Field-level source provenance and auditable evidence | **PASS (engineering)** | `Source`, `FieldEvidence`, `ImportRun`, `EvidenceDecision`, `AuditLog`; 377 evidence records and staging audits reconcile. Completeness of year/publication metadata remains partial at the data level. |
| Source-use/access policy and compliant research | **PARTIAL** | Per-source access/reuse notes are retained; some provider terms and bulk-use rights are unresolved. No bypass or blanket reuse assumption. |
| Typed import validation, duplicate reconciliation, idempotency, rollback and recoverability | **PASS** | Earlier integration checks and batch 026/027 dry-run/apply/retry evidence; retries created no duplicate source/claims. No importer code changed here. |
| Reproducible snapshot and identity-independent restoration | **PASS** | Latest snapshot manifest/read-back 205/269/377/293/377 and the prior separate-disposable restore/idempotent retry. Archive contains no users, decisions or fixtures. |
| Authenticated reviewer queue, explicit reasoned decisions and audit | **PASS (implementation/tests)** | `/admin/enrichment`; dashboard E2E: 2 passed (desktop/mobile), including auth denial, reviewer approval/rejection and audit using synthetic test records. Synthetic review is not genuine approval. |
| Owner's actual local ADMIN setup/access | **BLOCKED on owner interaction** | Read-only preflight reverified the exact loopback owner clone and row counts. It has 0 users and 0 decisions. Owner must register their own account and promote only that matching account in the local clone; steps/URLs are in `docs/DATA_COVERAGE.md`. No account was created/promoted here. |
| Conflicts, expiry, stale/future evidence and holds | **PARTIAL** | Queue states and holds are implemented/tested; 16 claims remain held pending source/campus/year/rights resolution. No hold was cleared. |
| Verified-only student-facing projection and DEMO/fixture isolation | **PASS (automated workflow)** | Synthetic publication E2E verifies unreviewed/fixture exclusion and staged→verified profile rendering with year/category/source. No genuine claim is currently approved, so real approved-fact profile rendering remains unobserved. |
| Coverage reporting across all 205 original colleges | **PASS (disposition reporting)** | All 205 have dispositions and stable identities. JSON now derives the exact 82 without substantive staged facts from snapshot claims; see `substantiveResearchSummary.substantiveBacklog`. |
| Useful, genuinely reviewed catalogue facts / fully enriched profiles | **PARTIAL** | 230 substantive claims across 123 colleges are staged/unreviewed; 82 have no substantive staged facts. Genuine VERIFIED claims/colleges: **0/0**. Fully enriched colleges: **0**. |
| Production security and recovery readiness | **BLOCKED / owner evidence required** | Historical credential revocation/rotation, production seed-route protection, Redis-backed limit/outage behavior, backup retention and successful restore are not verified. Production was not accessed. |

### Owner review and database evidence

The local owner-review clone was checked read-only with host permission on 2026-11-18: Docker binding `127.0.0.1:35439`; database `collegefind_phase3_snapshot_owner_review_20261118_test`; role `cf_phase3_test`; exact counts `205|269|377|293|377|0|0|0` for College/Source/FieldEvidence/ImportRun/AuditLog/EvidenceDecision/User/fixture evidence. The check passed. The clone remains at 0 users and 0 decisions. The archived baseline is 205 colleges, 269 sources, 377 claims, 293 import runs, 377 staging audits; 230 substantive + 147 reference claims; 214 substantive open for inspection, 16 held. The 25-item packet is available on the dashboard and at `data/pilot/first-human-review-batch.json`; every item is STAGED_UNREVIEWED and none is held.

Owner must personally follow the local setup in `docs/DATA_COVERAGE.md`, register at `http://127.0.0.1:3317/register`, use the guarded parameterized promotion for only the account they just created in the verified local database, log in again, and visit `http://127.0.0.1:3317/admin/enrichment`. Then inspect each claim's source, campus, scope, year/freshness, evidence location and permitted use; submit an explicit approve/reject reason. This audit has not logged in as the owner or made a decision. Synthetic tests do not count as human review. All 16 held records remain held.

### 82-college actionable backlog

Added an 82-entry machine-readable backlog under `substantiveResearchSummary.substantiveBacklog.entries` in `docs/DATA_COVERAGE.json`, and a human-readable per-college table to `docs/DATA_COVERAGE.md`. Rows are derived by joining the archived snapshot claim college IDs to the stable identity map and excluding link-only website/admissions URLs; the result is 123 with substantive claims / 82 without, matching the aggregate ledger. Every row names absent substantive domains, its latest recorded limitation, existing reference/candidate URLs clearly labeled by state, and the next legitimate source type/action. Category counts are mutually exclusive: 25 identity/scope, 25 field-specific source needed, 6 access/rendering, 6 cycle/staleness, 3 source-use review, and 17 with no field-specific disposition detail. These are follow-up priorities, not claims of permanent source unavailability. No new college fact or source URL was generated.

### Checks run in this increment

- Read-only Docker/database preflight under approved host access: **PASS**; exact loopback binding/database identity/counts above. The documented local env-file URL derivation was also exercised without outputting credentials: **PASS**. No writes.
- Snapshot/ledger reconciliation: **PASS**; latest manifest count/checksum reconciles, all 205 IDs/slugs preserved, 377 claims and audits, 0 decisions/users/fixtures; substantive/reference split and 25-item packet state verified from stored artifacts.
- JSON parse and backlog cardinality/category reconciliation: **PASS**, 82 unique slugs, category sum 82, no substantive snapshot claims in the backlog.
- `git diff --check` — **PASS** after this documentation update. No lint/typecheck/build/browser rerun: application code, schema and tests did not change in this increment; latest applicable checks remain those recorded in the owner-review section above.

### Phase 3 / Phase 4 decision

**Phase 3 engineering is complete with explicit data and owner blockers; Phase 3 factual verification and production readiness are not complete.** The remaining 82-college research backlog and 16 held claims are documented, 214 substantive claims await an authorized human, and genuine VERIFIED count remains zero.

**Decision: CONDITIONAL GO for Phase 4 local engineering only.** Phase 4 may proceed on local/disposable data while all public projections remain verified-only, unknown/demo/unreviewed states remain explicit, and no production resources are touched. Any Phase 4 acceptance item that requires genuine verified records is blocked until the owner reviews and approves eligible evidence. Production release remains NO-GO pending owner-side security and restore evidence.

Next owner action: complete the local account setup and review the first packet. Next engineering task if proceeding: Phase 4's bounded cutoff exploration/profile work behind the existing reviewed-data projection, with no assumptions that staged evidence is verified.

## Phase 4 local increment — profiles and cutoff explorer — 2026-11-19

Branch: `phase-4-profiles-cutoffs`. The Phase 3 local checkpoint is `02661ec` (`chore: checkpoint Phase 3 enrichment work`), created before this branch from the reviewed local Phase 3 worktree. The existing untracked `CollegeFind_AGENTS_V3.md` was preserved and not altered. No Phase 4 commit, push, merge or deployment was made.

### Implemented

- Reworked the college detail page into clearer programme/admissions, fee/scholarship, accreditation/ranking, placement/facility/contact, and historical cutoff sections. It consumes the existing reviewed public projection, includes source publication/collection/review dates where facts are available, retains the DEMO label, and gives missing facts explicit unavailable states rather than inferring values.
- Added a mobile-friendly `/cutoffs` explorer and `GET /api/cutoffs`, plus full paginated support in `/api/colleges/[id]/cutoffs`. Filtering, counting and pagination are performed in PostgreSQL. URL query parameters retain filter selections; page size is 1–100; result ordering ends with unique cutoff ID. Rows retain counselling system, exam/metric/rank definition, year, round, quota, category, PwD, seat pool and source/review dates. Only latest-APPROVED decisions, HTTPS sources with publisher attribution, and non-DEMO colleges are included. Historical rows are shown by year without extrapolation.
- Added the profile cutoff preview and a direct link to the filtered explorer even when a college has zero or only a few records.
- Added `CounsellingSystem` and `CutoffRankType`. The additive migration defaults legacy records to `UNSPECIFIED`; it does not infer JoSAA for old rows. Only the JoSAA adapter labels newly ingested rows as `JOSAA` and assigns its explicit category/PwD rank type. Synthetic seed cutoff records use `UNSPECIFIED` and remain excluded from verified public results.
- Fixed an actual PostgreSQL query defect found by integration tests: the raw projection now quotes Prisma's camel-case `"dataStatus"` column and casts the enum correctly.
- Kept the existing 205 college IDs/slugs and catalogue seed unchanged. Seed SHA-256 remains `a9321b82b6f390790e09a647dfaf589b90c5736819aed6b9a5908922bfcc1637`.

### Phase 4 checklist / acceptance state

| Requirement | Status | Evidence / limit |
|---|---|---|
| Preserve Phase 3 and isolate work on a local Phase 4 branch | **PASS** | Checkpoint `02661ec`; branch `phase-4-profiles-cutoffs`; no production access. |
| Verified-only profile projection; unknown/demo states explicit | **PASS (synthetic workflow)** | Existing projection was reused; profile E2E verified source/year and DEMO labeling with a synthetic approved claim. No real claim has been approved. |
| Profile domains and source/freshness attribution | **PARTIAL** | Profile sections and available field attribution implemented. Real verified values are absent; no claim is made that each section is factually populated. |
| Full supported cutoff dimensions and source links | **PASS (tested dimensions)** | Unit/integration/API/E2E checks cover system/exam/year/round/quota/category/PwD/seat pool/metric, rank type and source. Existing rows default to UNSPECIFIED. |
| Database-side filters/counts, bounded pagination, stable ordering, URL restoration | **PASS** | Integration filtering/pagination/boundary/tie-break tests and desktop/mobile filter/reload browser tests passed. No silent 60/1000/2000 cap remains in the changed routes. |
| College profile to cutoff explorer navigation | **PASS** | Synthetic browser flow opened an approved test cutoff from the profile and followed its college-scoped link into `/cutoffs`. |
| DEMO, unreviewed, rejected, insecure-source exclusion | **PASS (automated)** | 47 focused PostgreSQL integration tests and the synthetic publication smoke path. These do not verify real-world cutoff claims. |
| Additive migration on clean DB | **PASS** | All six migrations applied from a clean schema to `collegefind_phase4_migration_test`, verified loopback-only inside the new CollegeFind disposable container; zero college rows in that migration rehearsal DB. |
| Existing populated-schema migration compatibility | **PARTIAL** | The same additive SQL successfully applied to a disposable database at the preceding schema. No production/owner DB was used; a before/after populated-row-count preservation comparison was not captured. |
| 61+ / 2,001+ histories, load/performance and query-plan evidence | **NOT TESTED** | Current integration cases exercise a small synthetic set; no 2,001-row load or latency distribution was measured. No production-scale performance claim. |
| Official source-backed cutoff coverage | **BLOCKED / none evidenced** | The repository coverage ledger contains 0 staged official cutoff claims and 0 genuinely VERIFIED cutoff claims. NIRF candidates are ranking records, not admission cutoffs. Production was not queried. Test fixtures do not count. |
| Genuine reviewer publication | **BLOCKED on owner review** | Genuine VERIFIED claim count remains 0; no reviewer was impersonated and no authentic decision was made. |
| Production release readiness | **BLOCKED** | Phase 2/3 owner checks for historical credential revocation, seed-route configuration, Redis-backed rate-limit behavior, production backups/restore and deployed health remain unresolved. |

### Exact verification evidence

Database: new container `collegefind-phase4-disposable-20261119`, PostgreSQL 16, loopback-only `127.0.0.1:35440`, dedicated role `cf_phase4_test`. Before test confirmation, the exact database and user were independently queried; the migration DB was `collegefind_phase4_migration_test`, with 0 public tables. It was then explicitly confirmed as disposable. No production, staging, DevSync or owner-review database was accessed. After the final integration run, the guarded `resetDb` helper was used and read-back showed College=0, User=0, Source=0, CutoffRecord=0, EvidenceDecision=0 and six applied migrations. Browser fixtures were synthetic and cleaned up. One earlier disposable database in the same new container was used before correcting the migration timestamp; final verification uses the correctly named migration in the separate migration-test database.

Commands and results:

- `npx prisma format` — **PASS**.
- `npx prisma generate` — **PASS**, Prisma Client 7.10.1.
- `npx prisma migrate deploy` on the clean disposable migration-test database — **PASS**, all six migrations including `20261119010000_cutoff_counselling_system` applied.
- `npx vitest run --project unit tests/unit/cutoff-query.test.ts` — **PASS**, 2 focused query-schema tests (earlier focused run).
- `npm test` — **PASS**, 111 tests / 21 files after final application and test changes.
- `npx vitest run --project integration tests/integration/cutoff-explorer.test.ts tests/integration/api-security.test.ts tests/integration/josaa-ingest.test.ts` — **PASS**, 47 tests / 3 files against the verified disposable PostgreSQL database after final migration naming. This includes schema query, JoSAA importer, public API and latest reviewer-decision conflict behavior.
- `npm run lint` — **PASS**, zero warnings.
- `npm run typecheck` — **PASS**.
- `npx next build --webpack` — **PASS** after the final profile change; the generated production build launched successfully through Playwright's `next start` web server.
- `npx playwright test tests/e2e/smoke.spec.ts` — final **PASS**, 18 tests across desktop Chromium and mobile Pixel 7. Covers profile-to-cutoff link/source rendering, filter URL restore on reload, search/detail, predictor unknown cutoff state, auth redirect, keyboard focus and comparison share. An initial run against a database left populated by integration tests had 17 pass / 1 fail because the predictor expected no cutoff rows. The failure was database fixture contamination, not hidden by changing the assertion: tests were rerun after verifying test-only email domains and clearing only the disposable database with guarded `resetDb`; all 18 then passed.
- `npx next build` (default Turbopack) — **BLOCKED by environment**, with the complete error identifying CSS worker process port binding (`Operation not permitted`). A supported webpack build passed; no security config was weakened.
- First sandbox-only integration attempt — **BLOCKED before SQL** by `connect EPERM` to `127.0.0.1`; the identical focused suite ran successfully after approved host access to the disposable database.
- `DATA_COVERAGE.json` validation and 205-entry count — **PASS**; original seed SHA matches the Phase 3 baseline.

### Coverage and next work

Catalogue research remains 205/205 first-pass dispositions; 123 colleges have substantive STAGED evidence, 82 have no substantive STAGED facts, 377 total STAGED claims (230 substantive, 147 reference), and 0 genuine VERIFIED claims/colleges. Those values did not change in this code increment. Cutoff-specific ledger coverage is now explicit: 0 official staged cutoff claims / 0 verified cutoff claims recorded. Synthetic integration/browser records are excluded.

The next scoped Phase 4 milestone is to generate representative 2,001+ cutoff fixtures only on the verified disposable DB, verify all page boundaries and dimension combinations, capture `EXPLAIN (ANALYZE, BUFFERS)` and latency distributions, and add indexes only if measured query plans justify them. Then identify a legitimate official cutoff dataset/provider and stage a small source-backed batch for explicit human review. Do not infer real coverage from fixtures or begin production migration/release. Keep Phase 3 owner/security blockers visible.

## Phase 4 trend and engineering closeout — 2026-11-19

This addendum supersedes the earlier “trend absent / 2,001-row performance not tested” entries above. It records the final implementation/verification state for this local Phase 4 increment. Branch is `phase-4-profiles-cutoffs`; Phase 3 checkpoint remains `02661ec`. No production or DevSync resource was accessed, and no real reviewer decision or official cutoff claim was created.

### Implemented

- Added a rank trend sourced from the same PostgreSQL reviewed-only projection as the table. A series requires one exact college and unambiguous programme plus counselling system, rank definition, exam, category, quota, seat pool, PwD setting and rank metric. This prevents mixing counselling systems, campuses/programmes or seat definitions. Scores/percentiles are intentionally not drawn as ranks.
- Trend rows are not capped or sampled. Year/round slots without a reviewed record are materialized as gaps and split chart paths; null opening ranks stay unknown, empty/single-point/non-rank/ambiguous cases have explicit explanations, and no missing value is interpolated or predicted.
- Added an accessible SVG title/description, visible series key, keyboard-focusable chart and scrollable table alternative. The table includes opening/closing values, admission year/round, official publisher/source URL, source publication/retrieval date, review date and optional evidence row/page locator. Existing filter controls remain labelled; result counts use a polite live region; invalid filters/errors expose an alert; mobile checks show no viewport-level horizontal overflow.
- Added nullable `CutoffRecord.evidenceLocator` and additive migration `20261119030000_cutoff_source_locator`; the JoSAA CSV parser records a source line reference. It does not store copied source text. Existing rows and IDs are preserved. All eight migrations are applied in the verified disposable migration database; the 2,001 existing synthetic records were preserved through the additive locator migration. No rollback was run. The migration is reversible by dropping the nullable column after confirming no deployed code relies on it; do not roll back production without owner authorization and a verified backup.
- Fixed a real not-found SEO defect found in browser verification: global `index, follow` metadata conflicted with Next's not-found `noindex`. Removed the redundant global robots declaration (index/follow is the platform default) and added a regression assertion that not-found responses include `noindex` without the conflicting global directive.
- Missing-college browser navigation returns the not-found UI with HTTP 200 because the route has a `loading.tsx` streaming boundary. This is documented Next.js behavior for streamed `notFound()` responses; the streamed document now carries `noindex` and no contradictory `index, follow`. Browser tests assert the UI/robots behavior, not a false HTTP 404. If an HTTP 404 status is later required for analytics or another contract, resolve the college before starting the response stream (or add a safe pre-stream existence check); this remains a known status-code limitation, not a missing-entity UI defect. See [Next.js streamed not-found status behavior](https://nextjs.org/docs/app/api-reference/file-conventions/loading#status-codes).
- Fixed stale/ambiguous admin-browser assertions to reflect current headings, localized INR formatting and repeated profile fact labels. Assertions remain scoped to the relevant public profile content.

### Exact verification evidence

All database tests used the independently checked loopback disposable environment at `127.0.0.1:35440`, database `collegefind_phase4_migration_test`, role `cf_phase4_test`, with `COLLEGEFIND_TEST_DATABASE_CONFIRMED=true`. No Phase 3 owner-review DB, production DB or DevSync resource was used. One sandbox-only integration attempt failed before SQL with `connect EPERM`; the host-approved rerun passed.

- `npm test` — **PASS, 114/114 unit tests in 22 files**.
- `set -a; . /tmp/collegefind-phase4-migration-disposable.env; set +a; COLLEGEFIND_TEST_DATABASE_CONFIRMED=true npx vitest run --project integration tests/integration/cutoff-explorer.test.ts tests/integration/josaa-ingest.test.ts --reporter=dot` — **PASS, 18/18 tests**. Includes 61-row and 2,001-row histories, compound filters, source/review projection, rank trend gaps/ambiguity, query-plan and importer evidence-locator checks.
- The 2,001-record benchmark used 10 warmups and 100 samples for each query shape. p50/p95/p99 in milliseconds: broad page 1 **15.125/16.088/24.942**; broad page 21 **19.227/20.194/23.257**; selective page **3.392/3.910/4.158**; broad count **7.219/12.584/13.166**; selective count **1.879/2.818/3.061**. Broad scans read all 2,001 synthetic cutoff rows; selective filtering used `CutoffRecord_exam_category_seatPool_year_idx`; latest review lookups used `EvidenceDecision_cutoffId_createdAt_id_idx`. These are local warm-cache synthetic results, not a production SLA.
- `set -a; . /tmp/collegefind-phase4-migration-disposable.env; set +a; COLLEGEFIND_TEST_DATABASE_CONFIRMED=true npx playwright test tests/e2e/smoke.spec.ts tests/e2e/admin.spec.ts --workers=1 --reporter=list` — **PASS, 24/24 desktop Chromium and Pixel 7 checks**. Covers profile/cutoff navigation, trend chart and table, evidence locator, gaps, URL refresh/Back/Forward, invalid/empty states, mobile overflow, keyboard-only cutoff filtering with visible focus and polite result announcement, admin denial/decisions/audit, fixture exclusion and public projection of synthetic approved records. Synthetic approvals are not genuine approvals.
- `npm run lint` — **PASS**; `npm run typecheck` — **PASS**; `npx prisma generate` — **PASS**.
- Sandbox `npx next build --webpack` attempt failed before application compilation because Next's TypeScript `--showConfig` subprocess was blocked (the same environment-level `EPERM` previously observed). Host-approved `npx next build --webpack` then **PASS**; a second host-approved build with the disposable database environment **PASS**, including sitemap generation with no fallback warning. No security setting or test assertion was weakened to obtain the build.
- `npx prisma migrate status` against `collegefind_phase4_migration_test` — **PASS, eight migrations found; schema up to date**. `git diff --check` and machine-readable coverage JSON parse — **PASS** after the final documentation update. The high-confidence secret-pattern scan found no newly added secret or credential; two existing documented loopback disposable-DB examples in earlier status history match the generic URI pattern and are not new changes or production credentials. `CollegeFind_AGENTS_V3.md` remains preserved untracked and is excluded from the Phase 4 checkpoint as unrelated.

### Phase 4 acceptance checklist

| Requirement | Status | Evidence / remaining limit |
|---|---|---|
| Preserve all 205 college identities, stable IDs/slugs, Phase 3 evidence and safeguards | **PASS** | No catalogue seed or identity mapping changed; no real/staging review records modified. |
| Profile and cutoff verified-only projection; fixture/demo/unreviewed/rejected exclusion | **PASS (automated synthetic workflow)** | 22 browser checks and integration cases; zero genuine human approvals, so no genuine fact is verified by this test evidence. |
| Server-side compound filters, totals, deterministic pagination and full result history | **PASS (local synthetic)** | 61-row and 2,001-row tests, exact counts/page reconciliation and stable ordering in 18 integration tests. |
| Historical opening/closing rank trend, system/programme/category isolation, gaps and no estimates | **PASS (local synthetic)** | Unit/integration/browser coverage; only actual stored approved rows are queried, but no real approved cutoff rows exist. |
| Source/academic-year/evidence locator attribution | **PASS (implementation/tests)** | Source dates/URL/publisher/review date plus optional row locator in accessible table; legacy locators remain null. |
| Migration compatibility and preservation | **PASS (disposable only)** | Additive locator migration and eight-migration status verified; 2,001 synthetic rows survived. Production migration is not authorized. |
| Automated desktop/mobile keyboard semantics, labels, live status, table alternative and narrow viewport | **PASS (focused automation)** | Browser verifies semantic controls, focusable regions, labels, live counts and no page overflow. |
| Missing-college HTTP status | **PARTIAL (known streaming behavior)** | The 404 UI and noindex are verified; browser status is 200 because the `loading.tsx` boundary streams before not-found. Next.js documents this behavior. Change only if an HTTP 404 contract is required. |
| Full manual screen-reader and wider assistive-technology audit | **PARTIAL** | Not performed. Automated semantics do not replace human screen-reader review. |
| Official cutoff sources and real-world source use | **BLOCKED / 0 imported** | JoSAA public pages are accessible; current copyright policy requires permission for reproduction and third-party materials retain their rights. No suitable open licence/written permission established; no bypass attempted. |
| Genuine human-reviewed cutoff records | **BLOCKED / 0 staged, 0 VERIFIED** | None imported. Genuine Phase 3 approval count also remains 0. Reviewer decisions stay owner-controlled. |
| Production security, backup/restore, deployed behavior | **BLOCKED** | Owner-controlled Phase 2/3 evidence remains pending; no production check was made. |

**Decision:** Phase 4 cutoff/profile engineering is **ready for local engineering acceptance**, with accessibility breadth, genuine cutoff data/review and all production readiness explicitly partial/blocked. **CONDITIONAL GO for Phase 5 local work** using the current verified-only projection and disposable data; do not claim production readiness or complete factual cutoff coverage. Before production, obtain permitted official-source use, genuine reviewer decisions, manual accessibility review and owner evidence for historical credential revocation, seed protection, Redis rate limits, backups/restores and deployment health.

## Phase 5 — search, comparison and shortlists — local implementation increment (2026-11-19)

**Branch:** `phase-5-search-comparison-shortlists`, based on local Phase 4 HEAD `b415c0d` (which includes `94606c4` and Phase 3 checkpoint `02661ec`). Work remains uncommitted. The unrelated untracked `CollegeFind_AGENTS_V3.md` is untouched and preserved. No production, DevSync, Phase 3 owner-review or other runtime database was used.

### Implemented

- Extended the existing `/api/colleges` query path: name/short-name/city/state search now includes persisted institution/campus aliases; added exact city filtering and reviewed programme text, degree-level and admissions-eligibility filters. Trusted filters use the current public evidence projection. Exam filters now require an approved, current, source-backed cutoff and cannot match on raw staged/demo cutoff rows.
- Identity-only catalogue requests now use PostgreSQL `count`, `skip` and `take` with deterministic order. Source-projected metric/programme filters are applied after projection and pagination over the current 205-college catalogue; this is deliberate for correctness at current scale and must move to indexed server predicates before catalogue growth materially increases. Unknown values do not match; the search UI explains that a missing result is not proof the college lacks an attribute.
- Search filters remain shareable in the URL. Search input restores on browser Back/Forward. The mobile filter sheet now has dialog semantics, focus entry/trapping/return, Escape close, labelled controls and an announced result count.
- Comparison state remains ID/slug based and refetches current records. Slots can be added, removed, replaced and cleared; changes update the shared canonical URL. Structured reviewed facts now appear with programme/category scope, year, publisher, review date and source link, grouped per college so unlike programmes/fee scopes are not ranked against one another. Missing numeric values remain noncompetitive.
- Added an anonymous local shortlist using only canonical slugs. `/saved` resolves current public-projected college records and stays usable without registration. Sign-in merges up to 200 local slugs with a per-user row lock, one transaction, duplicate skipping and an all-or-nothing response. The local list clears only after successful merge; failures preserve it and remain visible. Authenticated saved data remains owner-scoped; deleted slugs are reported as unavailable. Existing single-college save API remains compatible.
- Added focused user-flow/API/persistence behavior documentation in `docs/SEARCH_COMPARISON_SHORTLISTS.md` and updated the roadmap/checklist here and in `docs/UPGRADE_PLAN.md`.

### Exact verification

- `npm test` — **PASS, 116 unit tests / 22 files**.
- `npm run test:integration -- tests/integration/api-security.test.ts` — **PASS, 37 integration tests / 1 file** against the verified disposable Phase 5 database. Added checks for alias/campus search, slug-order restoration and missing/duplicate slug rejection, approved-only exam matching, guest merge by slug/ID, idempotent repeats, mixed missing-key rollback, concurrent merges, ownership and existing saved-comparison restoration.
- Disposable database: created `collegefind_phase5_test` on the CollegeFind-only local PostgreSQL container exposed at `127.0.0.1:35440`, owned by `cf_phase4_test`. Independently queried identity before migrations/tests; server reported internal loopback-container address `172.17.0.2/32`; initial College/User/Evidence/ImportRun counts were all 0. All eight repository migrations applied; post-migration counts remained 0 and `migrate deploy` reported success. Integration tests reset only this database. Browser fixtures and test accounts were synthetic and limited to this disposable DB. No application schema change or migration was made for Phase 5.
- `npm run test:e2e -- tests/e2e/smoke.spec.ts tests/e2e/comparison.spec.ts` — **PASS, 43 tests across desktop Chromium and mobile Pixel 7; 1 expected skip** (the mobile-menu-only test is skipped on desktop). Covered guest shortlist/removal, sign-in merge, shared comparison in a clean browser and after refresh, slot replacement and URL update, current-record restoration, search Back/Forward, mobile navigation, demo isolation, cutoff navigation and error states. Initial runs exposed test locator ambiguity after adding the second per-college fact heading, an existing synthetic peer in a reused DB, and a duplicated live-region selector during streamed navigation. Assertions were scoped to the actual comparison slot/result region and the safety assertion checks no DEMO/reviewed-fee leak; no application behavior assertions were weakened. The final run passed. The later duplicate-slug query validation change was covered by API integration tests and the final production build; it did not change browser UI behavior.
- `npm run test:e2e -- tests/e2e/smoke.spec.ts --grep "mobile college filter sheet"` — **PASS, 1 mobile test; 1 expected desktop skip**. Verified dialog focus entry, Tab/Shift+Tab trap, Escape dismissal and focus return to the trigger.
- `npm run test:e2e -- tests/e2e/comparison.spec.ts --grep "structured reviewed facts"` — **PASS, 2 tests** (desktop and mobile). Synthetic API fixture verified typed tuition scope, semester/category, academic year, publisher and external source link render in the correct college panel. This tests rendering only; it is not a real evidence approval.
- `npm run lint` — **PASS, zero warnings**. `npm run typecheck` — **PASS**. `npx prisma generate` — **PASS** (no schema changes). `git diff --check` — **PASS**.
- `npm run build -- --webpack` — final **PASS** after all application changes, with `DATABASE_URL` pointed at the disposable Phase 5 DB for sitemap generation. The initial sandbox invocation failed with `Could not parse output from TypeScript's --showConfig`; direct `tsc --showConfig` produced valid JSON, but an equivalent child-process invocation was blocked by sandbox `EPERM`. The host-approved webpack build compiled and completed TypeScript/static generation successfully; no security setting was changed. The default Turbopack build was not retried.
- Database safety exception: an earlier configured disposable DB `collegefind_phase4_test` was read as empty but its schema was not migration-clean (an enum already existed). `migrate deploy` failed at migration `20261119010000_cutoff_counselling_system` with PostgreSQL `42710 type already exists`, before applying application changes. The failed metadata entry was then marked rolled back with `prisma migrate resolve --rolled-back` on that exact disposable DB. No college/user/evidence rows were present or modified there. A separate test database with existing rows (`collegefind_phase4_migration_test`: 5 colleges, 8 users, 120 evidence rows) was only read and was not used for tests or migrations.
- Catalogue preservation: `src/server/seed/demo-colleges.json` remains **205 records**, SHA-256 `a9321b82b6f390790e09a647dfaf589b90c5736819aed6b9a5908922bfcc1637`; no production or Phase 3 evidence records changed. Research coverage remains 205 dispositions, 377 staged claims (230 substantive/147 source-reference), 123 colleges with staged substantive facts, 82 without, 0 genuine approvals/verified claims/fully enriched colleges and 0 verified official cutoffs.

### Phase 5 acceptance snapshot

| Requirement | Status | Evidence / remaining limit |
|---|---|---|
| Preserve branch history, the 205-college catalogue, Phase 3 evidence and unrelated untracked work | **PASS** | New local branch from `b415c0d`; seed hash/count unchanged; unrelated `CollegeFind_AGENTS_V3.md` preserved. |
| Search aliases/campus, city, state/type and reviewed programme/admission filters | **PASS (local tests)** | Unit, API integration and browser coverage. Trusted projected filtering still scans the bounded 205-record set. |
| Stable identity-only database pagination/count and URL Back/Forward | **PASS (local tests)** | Database `skip/take/count` plus unique ordering; browser refresh/history test. No large catalogue performance benchmark. |
| Exclude demo/unreviewed cutoff facts from exam search and comparisons | **PASS (synthetic tests)** | API/integration, unit and browser checks; no claim of real official coverage. |
| Shared comparison of 2–3 canonical slugs, fresh-browser restore, replacement/removal and missing values | **PASS (local tests)** | Desktop/mobile Playwright and comparison unit/API tests. Structured values are shown with their own scope, not cross-scored when scopes differ. |
| Anonymous device shortlist and authenticated cross-session merge | **PASS (synthetic tests)** | Guest browser save/remove, login merge, owner isolation, transaction idempotency, concurrent merge and rollback integration cases. No multi-device live account test. |
| App quality gates | **PASS** | 116 unit, 37 API integration, 43 broad desktop/mobile browser checks + 1 expected skip, one focused mobile keyboard test + 1 expected desktop skip, two structured-fact browser checks, lint, typecheck, Prisma generation, webpack build and diff check. |
| Genuine official data verification and production readiness | **BLOCKED / unchanged** | Zero genuine approvals/verified claims/cutoffs; owner-controlled Phase 2/3/4 security, backups, source review and release checks remain open. |
| Performance at materially larger catalogue scale and assistive-technology review | **NOT TESTED / PARTIAL** | No performance SLA or large catalogue benchmark; manual screen-reader review remains required. |

**Decision:** Phase 5 is **IN PROGRESS**, not complete. The implemented search, sharing, compare editing and shortlist workflows are locally verified on a disposable database. Next milestone: measure catalogue query plans against a representative expanded dataset, move trusted projected predicates/counts into database-backed reviewed-fact queries when warranted, and run a 200-item cap/concurrency stress case. Continue keeping all public projections reviewed-only and all Phase 2/3 production blockers visible. No commit, push, merge or deployment was made.

### Phase 5 comparison-dialog focus follow-up — 2026-11-19

- The first focused browser run exposed that the replacement dialog initially focused its first DOM control (Close), not the search field. The dialog now moves focus to the labeled search input, traps Tab/Shift+Tab at both ends, closes on Escape, and restores focus to the opener or comparison heading when the opener is removed.
- Extended the slot-replacement Playwright case to check focus entry, both trap boundaries, selection, focus restoration and shared-URL update. The first run failed on initial focus as expected; after the fix, `npm run test:e2e -- tests/e2e/comparison.spec.ts --grep "comparison slot can be replaced"` **PASS, 2 tests** (desktop Chromium and mobile Pixel 7).
- After the final code change: `npm run lint` **PASS**; `npm run typecheck` **PASS**; `git diff --check` **PASS**; `npm run build -- --webpack` **PASS**; `npm run test:e2e -- tests/e2e/comparison.spec.ts --grep "comparison slot can be replaced"` **PASS, 2/2**. The build/browser commands ran with the approved local environment pointed to the verified disposable `collegefind_phase5_test` database; no production or DevSync resource was accessed. The earlier unit run remains 116/116 passing; this final focus-only correction was covered by the focused browser flow rather than repeating unrelated integration suites.
- The original 205-college catalogue, 377 staged evidence claims and review history were not changed. Genuine verified claims remain 0. This resolves a local accessibility defect but does not close the Phase 5 scale, assistive-technology or owner-controlled release gates.

## Phase 5 local engineering acceptance — 2026-11-19

This entry supersedes the earlier Phase 5 “scale/cap not tested” and browser baseline entries above. Work remains local on `phase-5-search-comparison-shortlists`; no Phase 3/4 data or production resource was accessed. The unrelated untracked `CollegeFind_AGENTS_V3.md` is preserved.

### Search correctness and measured performance

- Added `tests/integration/phase5-reliability.test.ts`. On the verified disposable PostgreSQL 16.13 database, it staged synthetic reviewed programme evidence at approximately 4% density and called the actual `/api/colleges` route handler, including Prisma projection, filtering, JSON serialization and parsing.
- At 205 institutions, 30 warm measured requests (one warm-up excluded) returned all 9 matching colleges. Latest run: p50 **16.67 ms**, p95 **35.09 ms**, p99 **35.33 ms**.
- At 5,205 institutions (25.4x the baseline), 30 warm measured requests returned all 209 matches across five pages, with no duplicate IDs or missing page rows. Latest run: p50 **195.68 ms**, p95 **231.16 ms**, p99 **248.00 ms** (p99 is the maximum of this 30-sample run, so treat tail precision as limited). The local engineering budget is p95 <= **300 ms** at 5,205 rows; the test asserts this. This is a local synthetic budget, not production performance or an SLA.
- Conditions: Node v22.23.2, Linux x64, 8 logical CPUs, 7.4 GiB visible memory; PostgreSQL 16.13 in the loopback-only CollegeFind disposable container. No production traffic or data was included. Five-request Playwright timings printed by an existing smoke case remain diagnostic only and are not used for this benchmark.
- `EXPLAIN (ANALYZE, BUFFERS)` for `WHERE city = 'Benchmark City' ORDER BY name,id LIMIT 50` at 5,205 rows produced `Limit -> Sort -> Seq Scan(College)`, 5,205 scanned rows, 131 shared buffer hits, 0 reads and **2.392 ms** database execution. At this measured size, the sequential scan/sort did not justify an index or migration. The measured route p95 stays under the local budget, so trusted-fact filtering remains on the reviewed public projection over the bounded result set. Reassess before the catalogue grows beyond the tested 5,205 rows.
- Counts/pagination were checked for the composed city + reviewed programme filter, all pages were traversed, unknown programme filters returned zero, and equal-name identity results used a deterministic unique ID tie-breaker. Existing tests continue covering aliases, campus, city/state/type, reviewed facts, DEMO/staged isolation, URL navigation and Back/Forward.

### Shortlist, sharing and recovery

- The authenticated saved API stress case created 201 candidate colleges, filled the account to 199, then issued two concurrent add requests. Exactly one succeeded and one returned 409 at the 200-item cap; final row count was exactly 200. Replaying the current 200 slugs returned 200 already-saved and created no duplicates. Repeated reads had identical ordering; reads as another user were empty and anonymous reads returned 401.
- `GET /api/saved` now orders by `createdAt DESC, id DESC` to break timestamp ties deterministically. The add/merge remains one per-user row-lock transaction with database uniqueness protection. No limit was raised and no schema/migration change was needed.
- Playwright used two separately authenticated browser contexts for the same synthetic disposable account. Both submitted overlapping shortlist additions concurrently; both then read the same three current records in identical order after reload. Shared comparison refresh, canonical URL replacement, login merge, failed-merge retention/retry, and optimistic save rollback after a simulated 503 also passed.
- Identity-only catalogue count/page now use sequential queries inside a repeatable-read transaction, keeping totals and page data on one database snapshot. This also avoids submitting count/page concurrently through a transaction connection.

### Exact final verification

- `npm test` — **PASS, 116 unit tests / 22 files**.
- `npm run test:integration -- tests/integration/api-security.test.ts` — **PASS, 37 tests** against verified disposable PostgreSQL; covers existing authorization, ownership, alias, filter, pagination and API error cases.
- `npm run test:integration -- tests/integration/phase5-reliability.test.ts --silent=false --reporter=verbose` — **PASS, 2 tests**; includes the 205/5,205 dataset, p95 budget, EXPLAIN plan, 201-entry cap/concurrency, idempotency, ordering and owner isolation.
- `npm run test:e2e -- tests/e2e/smoke.spec.ts tests/e2e/comparison.spec.ts` — final **PASS, 52 tests / 2 expected skips** across Chromium and Pixel 7. The skips are desktop executions of mobile-only navigation/filter tests. This run includes the two-context concurrent shortlist scenario, fresh-context persistence, focus behavior, merge retry, optimistic rollback, mobile filters, comparison sharing and missing/demo states.
- `npm run lint` — **PASS**; `npm run typecheck` — **PASS**; `npx prisma generate` — **PASS**; `npm run build -- --webpack` — **PASS**; `git diff --check` — **PASS**.
- A transient pg v8/PrismaPg warning remains during some concurrent relation-query paths: `Calling client.query() when the client is already executing a query` (stack enters `PgTransaction.performIO`). No request/test failed; the adapter queues the calls today. Keep as a dependency compatibility follow-up before any pg 9 upgrade. The local test server also logs the expected per-instance rate-limit fallback because no Redis service credentials are configured; production Redis behavior remains owner-controlled and unverified.
- After browser/integration checks, cleanup was performed only on `collegefind_phase5_test` after rechecking database, role and loopback-container identity. Post-cleanup College/User/FieldEvidence/SavedCollege counts were all **0**. No disposable test rows were retained.

### Phase 5 acceptance decision

| Requirement | Status | Evidence / boundary |
|---|---|---|
| Preserve 205 records, slugs, source history, owner data and unrelated untracked file | **PASS** | No seed/catalogue/schema/review-history edits; `CollegeFind_AGENTS_V3.md` remains untracked and excluded. |
| Search matching, trust filters, result totals, pagination, stable order and URL restore | **PASS (local synthetic)** | Unit/integration/browser coverage plus complete page reconciliation at 205 and 5,205 rows; unknowns do not match. |
| Search performance at measured size | **PASS (local budget)** | 5,205-row p95 231.16 ms against local 300 ms budget; no index justified. Larger catalogue and production-scale latency remain unmeasured. |
| Shared comparisons and current-record restore; null/demo/staged values do not win | **PASS (synthetic browser/API tests)** | Fresh context, refresh, replacement, source scope and desktop/mobile checks; no real verified inputs exist to assess. |
| Shortlist guest use, authenticated persistence, cap, concurrent updates, merge/idempotency, error recovery and ownership | **PASS (disposable tests)** | 201-entry cap stress, concurrent API requests and two browser sessions, duplicate merge, retry after 503, rollback, ordering and cross-user denial. No live user accounts were used. |
| Keyboard semantics, focus trap/restore, labels, announced results and mobile overflow | **PASS (automated coverage)** | Final browser suite; no automated axe package is installed and no human screen-reader/assistive-technology session was performed. |
| Manual assistive-technology review | **PARTIAL** | Owner or accessibility reviewer still needs to check NVDA/VoiceOver/TalkBack and magnification with the search/filter and shortlist flows. |
| PrismaPg/pg queued-query deprecation | **PARTIAL / follow-up** | Non-fatal warning is reproducible in local test/browser activity; no current request failure, but compatibility should be resolved before pg 9. |
| Genuine college verification and production readiness | **BLOCKED** | Catalogue remains 205 identities, 377 staged claims, zero genuine approvals/verified claims/cutoffs. Historical credential revocation, production seed configuration, Redis behavior, backup/restore readiness and deployed health need owner evidence. |

**Decision:** Phase 5 local search/comparison/shortlist engineering is **accepted for local engineering purposes**, with manual assistive-technology and pg compatibility follow-ups recorded. Production/data readiness is **not accepted**. Recommendation: **CONDITIONAL GO** to Phase 6 local development; keep verified-only projection and owner release blockers in force. No commit, push, merge or deployment is recorded here; the current user request authorizes a separate local checkpoint after final diff review.

## Phase 6 — CollegeFit and admission guidance — 2026-11-19

Branch `phase-6-collegefit-admissions` starts at Phase 5 checkpoint `f912aa8`. CollegeFit uses catalogue identity and the existing reviewed public projection. The historical comparison reuses the verified cutoff database query. Search, profiles, comparisons and shortlists link to or work from the new flows. No Prisma schema or migration changes were needed.

### Acceptance evidence

| Requirement | Status | Evidence |
|---|---|---|
| Deterministic preference matching and priority | PASS | CollegeFit unit tests cover match, mismatch, unknown, priority normalization, exact annual tuition scope and reproducibility. |
| Incomplete and untrusted evidence | PASS | Unit tests cover fixture, staged, rejected, expired, conflicting and legacy data. CollegeFit keeps incomplete results available for identity discovery without a fit rank. |
| Eligibility, historical comparisons and future admission shown separately | PASS | Guidance reports eligibility as unconfirmed, cites reviewed requirements and displays one exact historical observation. The former heuristic and its probability, band and future range were retired. |
| Rank dimension and review isolation | PASS | Disposable integration checks compare records across different seat scopes and exclude staged, revoked, preparatory, unspecified, score and future-source rows. |
| Persistence and privacy | PASS for supported scope | CollegeFit preferences restore from a bookmarkable URL. Existing guest and account shortlists remain supported. There is no account preference model. The submitted rank remains in the browser. |
| Genuine evidence coverage and production readiness | BLOCKED | 377 staged claims, zero genuine approvals and zero verified official cutoff records. Source permission and authorized review remain open. Historical credential revocation, seed protections, Redis behaviour, backups and production restore remain owner controlled. |
| Manual assistive technology | PARTIAL | Keyboard, narrow viewport, semantic table and status behaviour have browser coverage. Manual screen-reader and magnification review remains open. |

### Commands and environment

- `npm test` passed 93 tests across 21 files. The former forecast model tests were retired with the forecast.
- `npm run test:integration -- tests/integration/predictor.test.ts tests/integration/cutoff-explorer.test.ts tests/integration/api-security.test.ts` passed 45 tests across three files.
- `npm run lint`, `npm run typecheck`, `npm run build -- --webpack` and `git diff --check` passed. The first webpack build found a missing type annotation for the projected college facts in guidance. The final build passed after the annotation was added.
- Database checks used only `collegefind_phase5_test` on the CollegeFind disposable Docker container bound at `127.0.0.1:35440`. Independent SQL confirmed the exact database and role, PostgreSQL 16.13, eight applied migrations and zero college, user, field evidence and cutoff records before testing. All approvals used in tests were synthetic. The existing pg adapter deprecation appeared and the local server used its expected rate-limit fallback.
- Seed verification counted 205 colleges and confirmed the original SHA-256 `a9321b82b6f390790e09a647dfaf589b90c5736819aed6b9a5908922bfcc1637`. The evidence archive and review history were outside the test target.
- `npm run test:e2e -- tests/e2e/college-fit.spec.ts tests/e2e/smoke.spec.ts tests/e2e/comparison.spec.ts --workers=2` passed **56**, skipped **2** mobile-only tests on desktop, and failed **0** on the final webpack build. Coverage included CollegeFit keyboard submission, preference restoration, unknown demo tuition, guest saving, reviewed admission requirements, exact rank scope, private rank input, the zero-evidence state, and existing comparison, authentication and shortlist regression flows. An initial run found ambiguous locators in the new tests. The tests now target the exact input and the selected history table.
- After the runs, the guarded reset rechecked the disposable database, role and server address. College, User, FieldEvidence and CutoffRecord counts returned to zero.

**Phase 6 local engineering acceptance passed with follow-ups. CONDITIONAL GO for Phase 7 locally.** Build private planning around source-backed requirements and explicitly unavailable deadlines. Admission eligibility still needs authority confirmation, and production release still requires owner evidence and genuine reviews.


## Phase 7 first vertical slice — authenticated private plans

Branch `phase-7-admissions-planning` is based on `be8c22e`. The initial plan-only slice implemented plan listing, idempotent creation by owner/name/cycle, owner-scoped rename and delete, and a signed-in `/planner` dashboard. The dashboard labels information as personal, restores plans by fetching the authenticated API, and supports loading, empty, validation, error and retry states. The current choice-list increment is recorded below; applications and reminders remain unimplemented.

### Database and security evidence

- Added `AdmissionPlan`, `PlanChoice`, `PlanApplication` and `PlanTask` additively with owner foreign key cascade, plan uniqueness and list indexes. The generated migration was reviewed to remove unrelated `InstitutionAlias` foreign-key drop/recreate churn. No existing college/user/evidence relation is rewritten.
- `bash /tmp/collegefind-phase6-checks.sh npx prisma migrate deploy` reported nine migrations found and no pending migrations on `collegefind_phase5_test` at loopback `127.0.0.1:35440`. Prisma client generation passed. The database was independently confirmed earlier as PostgreSQL 16.13, role `cf_phase4_test`, and empty before Phase 7 testing. No production or owner-review database was used.
- Plan listing scopes by current session user. Updates and deletes use `id` plus `userId`, returning 404 for another owner's record. Creation is idempotent per owner/name/cycle. The plan API sends no-cache responses.

### Checks

- `bash /tmp/collegefind-phase6-checks.sh npm run test:integration -- tests/integration/plans.test.ts` passed **2 tests** for unauthenticated denial, invalid input, create/list/rename/delete, and cross-user read/update/delete isolation. The initial integration run exposed an incorrect compound key containing `authority`; the route was fixed to use only `userId`, `name`, and `cycle`, then the focused integration suite passed.
- `bash /tmp/collegefind-phase6-checks.sh npm run test:e2e -- tests/e2e/comparison.spec.ts --grep 'signed-in student creates' --workers=2` passed **2 tests** on Chromium and Pixel 7 for real login, empty state, creation, refresh restoration, rename and deletion.
- `npm run lint`, `npm run typecheck`, `git diff --check`, and `bash /tmp/collegefind-phase6-checks.sh npm run build -- --webpack` passed after the final route type correction. The server used local memory rate-limit fallback because test Redis settings are blank.

**Status:** Private plan CRUD vertical slice **PASS locally**. At that point, full Phase 7 remained **PARTIAL**. No completion commit was created. The worktree remains uncommitted and `CollegeFind_AGENTS_V3.md` is preserved. The choice-management slice follows; the current application-tracking slice is recorded separately below. Personal tasks, manual accessibility review and inherited production/data blockers remain open.

## Phase 7 second vertical slice — private counselling choice lists

**Implemented:** Existing `PlanChoice` model and already-applied additive Phase 7 migration are reused; this slice makes no schema changes. The authenticated plan list returns current college/programme references and persisted choice order. Students can add either an existing catalogue college or a clearly personal programme/label, attach a private note, edit the label/note, remove a choice, reorder with accessible Move Up/Move Down controls, and print one selected plan as a personal planning copy. UI copy explicitly states the order is a preference, not an official counselling submission or eligibility decision. Catalogue options are fetched in valid 50-row pages; failure to load them no longer hides saved plans and personal entries remain available.

**Integrity/security:** Every choice route checks the current session and plan ownership. Creation and reorder lock the parent plan in a transaction; append position allocation is serialized, order updates validate an exact duplicate-free set and use temporary positions to avoid unique-index collisions. Updates lock the same plan, validate college/programme scope, reject case-insensitive duplicate labels and constrain updates/deletes to the owned plan. No applications or deadline behavior is implied.

**Checks after this increment:**

- `bash /tmp/collegefind-phase6-checks.sh npm run test:integration -- tests/integration/plan-choices.test.ts` — **PASS, 2 tests** against the existing guarded disposable `collegefind_phase5_test` PostgreSQL database on loopback port 35440. Covers invalid programme/college, create, case-insensitive duplicate prevention, exact reorder, invalid duplicate order, duplicate-on-edit, edit/delete ownership, cross-user denial, and concurrent append positions. The first sandboxed attempt failed at the guarded DB connection with `connect EPERM`; rerun with host authorization passed. No production, DevSync, or owner-review database was used.
- `bash /tmp/collegefind-phase6-checks.sh npm run test:e2e -- tests/e2e/comparison.spec.ts --grep 'signed-in student creates' --workers=2` — **PASS, 2 tests** (Chromium and Pixel 7). Covers authenticated plan creation, adding/editing choices, accessible reorder, refresh and fresh-browser-context restoration after signing in to the same account, removal, plan rename/delete, and print-media isolation for the selected plan. An initial run found the planner requested an invalid `limit=205`, and an edit response caused a missing `choices` property crash after plan rename. Both application defects were fixed before this passing run. Intermediate selector/dialog failures were test-harness issues corrected without weakening assertions.
- `npm run lint` — **PASS**; `npm run typecheck` — **PASS**; `npx prisma generate` — **PASS**; `git diff --check` — **PASS**.
- `npx next build --webpack` — **PASS** after the final application change. The build's sitemap prerender logged its existing safe `sitemap_db_unavailable` warning for the unavailable default development database at `127.0.0.1:5432`; compilation and static generation completed. Plain `npm run build` remains blocked by the known sandbox/Turbopack CSS worker port-binding restriction (`Operation not permitted`), while the independent webpack build passed.
- No new migration was required. The existing Phase 7 migration had previously been applied to the verified disposable database; no production/default-development migration was run in this increment. E2E logs used the configured per-process in-memory rate limiter because Redis test settings are absent; this is a known local test limitation, not production rate-limit verification.

**Slice status:** Private counselling choice lists **PASS locally** for these tested requirements. Original college identities and catalogue records, evidence, review history and safeguards were not changed. The user authorized files remain local and uncommitted; unrelated untracked `CollegeFind_AGENTS_V3.md` was preserved. Full Phase 7 remained **PARTIAL**, not complete; application tracking was then outstanding and is now implemented in the next slice. Personal deadlines/checklists, reminders, manual screen-reader review and inherited production/data verification remain follow-up work.

## Phase 7 third vertical slice — private application tracking

**Implemented:** Students can add an application to a private plan for a catalogue college or a personal institution name. Records support a programme label, admission cycle, counselling details, all eight requested user-maintained statuses, date-only submission date, next action, optional reference and private notes. The dashboard lists status summaries and next actions, provides inline edit forms and delete confirmation, and restores application data via the signed-in plan API after refresh or login in a fresh browser context. UI copy states CollegeFind does not receive live institution updates or submit applications. Application data is not used as verified admissions evidence.

**API/privacy:** Authenticated GET, POST, PATCH and DELETE routes live under the owned plan. All query and mutation paths scope application IDs to a plan owned by the current user; catalogue colleges are validated. Personal institution and catalogue college are mutually exclusive. Zod validates each status, ISO date-only input and length limits. Updates use an integer version compare-and-set under a transaction lock on the parent plan; stale edits and stale deletes return 409 rather than overwriting newer data. Cross-user requests return not found. No credentials, documents or external submission integration are stored.

**Database:** The existing `PlanApplication` model and Phase 7 migration were extended additively. Migration `20261119110000_phase7_application_tracking_details` adds a defaulted version counter, nullable college/personal institution/programme/counselling fields, a nullable `College` foreign key with `ON DELETE SET NULL`, and a plan/college/status index. Existing application rows remain valid. The migration was applied only to `collegefind_phase5_test` on loopback `127.0.0.1:35440` through the guarded disposable environment; `npx prisma migrate status` reported the schema up to date. No production/default development/owner-review database was migrated. Rollback guidance: revert application code while retaining these backward-compatible columns; do not drop columns without an approved backup and explicit data-retention decision because doing so would erase student-entered context.

**Verification:**

- `bash /tmp/collegefind-phase6-checks.sh npm run test:integration -- tests/integration/plans.test.ts tests/integration/plan-choices.test.ts tests/integration/plan-applications.test.ts` — **PASS, 3 files / 7 tests** on the guarded disposable PostgreSQL database. Application cases cover unauthenticated denial, create/list/edit/delete, catalogue and personal identity, all eight supported statuses, invalid status/date/required identity, ownership isolation, version increments, parallel edits (one 200 and one 409), and stale-delete rejection without removing the row. Existing plan and choice suites passed alongside the new tests.
- `bash /tmp/collegefind-phase6-checks.sh npm run test:e2e -- tests/e2e/comparison.spec.ts --grep 'signed-in student creates|student privately tracks an application' --workers=1` — **PASS, 4 tests** across Chromium and Pixel 7. Existing plan/choice flow and application flow both pass on desktop/mobile. Application E2E verifies personal-entry creation, status and date entry, refresh restoration, status/note edits, another refresh and deletion.
- `npm run lint`, `npm run typecheck`, `npx prisma format --check`, `npx prisma generate`, `git diff --check` — **PASS**. `npx next build --webpack` — **PASS**. Sitemap prerender logged its existing unavailable-default-DB warning for `127.0.0.1:5432`; build completed, and no production database was contacted. Local test server used the existing memory rate-limit fallback because test Redis settings are absent.
- Initial browser runs found and fixed the created-plan local-state omission for `applications`, and plan rename had to preserve both choice and application arrays when the rename endpoint returns only plan metadata. No assertions were weakened.

**Slice status:** Private application tracking **PASS locally** for the implemented requirements. No genuine college facts or official admission information changed, and the existing 205 college identities and prior evidence remain intact. Full Phase 7 is **PARTIAL**, not complete: personal deadlines/document checklists, reminders, manual assistive-technology review, and inherited owner-controlled production/security/data gates remain outstanding. No Phase 7 completion commit was created; unrelated `CollegeFind_AGENTS_V3.md` remains untouched.

## Phase 7 fourth vertical slice — personal deadlines, checklists and in-app reminders

**Implemented:** Authenticated students can create, edit, complete/reopen and delete private `DEADLINE` and `CHECKLIST` tasks within an owned admission plan. Tasks have a title, optional description, personal note, optional date/time, IANA timezone, and optional links to a catalogue college or an application in that same plan. Tasks are shown in separate overdue, upcoming, unscheduled/checklist and completed groups. The planner summary counts upcoming, overdue and open checklist work; these are in-app indicators only, with no email, SMS, push delivery or scheduled worker. The UI explicitly labels the entries as personal reminders and checklist items, not official admission dates or requirements. No documents are uploaded or stored.

**Date and concurrency behavior:** Local date/time entry is converted to a UTC instant using the selected IANA timezone, independent of the server timezone. Date-only reminders resolve to the end of that local calendar day. Invalid calendar dates and timezone names are rejected; nonexistent DST wall times are rejected, and ambiguous fall-back times use the first occurrence. Editing restores the original date/time. Mutations lock the owner-scoped parent plan, check linked record ownership, and use a version counter; concurrent stale edits/deletes return 409 instead of silently overwriting. Completion is an idempotent state-setting action. Unauthenticated requests return 401; another user's plan/task is concealed as 404.

**Database change:** Two additive migrations extend the already drafted Phase 7 task model: `20261119120000_phase7_personal_plan_tasks` adds nullable College/PlanApplication links, a defaulted version and indexes; `20261119130000_phase7_task_descriptions` adds nullable task descriptions. Existing task records receive `version=0`; no college, account, evidence or audit row is rewritten. Rollback should first revert app code; retain the additive columns and foreign keys unless a reviewed, backed-up data-retention decision authorizes dropping student-entered task information. No production, DevSync, default-development or Phase 3 reviewer database was contacted.

**Disposable database evidence:** The guarded environment was independently inspected without printing its connection string: database `collegefind_phase5_test`, owner/role `cf_phase4_test`, PostgreSQL 16.13. The Postgres server's container-side address was `172.17.0.2:5432`; the project's guarded wrapper connects via loopback `127.0.0.1:35440`. The first identity assertion used an outdated expected port and failed before any mutation; the corrected identity report established the mapped disposable target. Prisma reported 12 migrations and no pending migration after the two additive changes.

**Checks against the final code/build:**

- `bash /tmp/collegefind-phase6-checks.sh npm run test:integration -- tests/integration/plans.test.ts tests/integration/plan-choices.test.ts tests/integration/plan-applications.test.ts tests/integration/plan-tasks.test.ts` — **PASS, 4 files / 11 tests** on the verified disposable PostgreSQL database. Includes private CRUD, authentication/ownership, stale/concurrent updates, completion idempotency/reopen, link/date/timezone validation and prior plan/choice/application regressions.
- `npm test -- tests/unit/planner-dates.test.ts` — **PASS, 1 file / 4 tests** for local-to-UTC conversion, invalid dates/zones, DST gaps/folds and end-of-day semantics.
- `bash /tmp/collegefind-phase6-checks.sh npm run test:e2e -- tests/e2e/comparison.spec.ts --grep 'signed-in student creates|student privately tracks an application|manages personal deadlines' --workers=1` — **PASS, 6 tests** across Chromium and Pixel 7 on the final webpack build. Verifies existing plan/choice and application journeys plus deadline/checklist creation, overdue and upcoming indicators, completion, refresh restoration, edit/description/note, reopen and delete. Initial browser runs exposed hidden-form selector and asynchronous assertion timing issues in the test harness; the test now targets the visible add form and waits for the persisted upcoming count and typed API response. Assertions were retained, and the final desktop/mobile run passed.
- `npm run lint`, `npm run typecheck`, `npx prisma format`, `npx prisma generate`, `bash /tmp/collegefind-phase6-checks.sh npx prisma migrate deploy`, `bash /tmp/collegefind-phase6-checks.sh npx prisma migrate status`, `bash /tmp/collegefind-phase6-checks.sh npx next build --webpack`, and `git diff --check` — **PASS**. Final migration status was up to date and the webpack build emitted `/planner` and both task API routes. Local build has its known sitemap warning for the unavailable default development DB; the supported webpack build completed. E2E used the existing in-memory test rate-limit fallback because Redis test credentials were intentionally absent.

**Focused Phase 7 engineering acceptance:** Private plans, ordered counselling choices, application tracker, personal deadline/checklist CRUD and in-app indicators are **PASS locally** for the exercised requirements, including ownership boundaries and the complete planner E2E journey. The migration is applied only to the isolated disposable test database. Phase 7 as a whole remains **PARTIAL**: no genuine source claims have been reviewed/approved; zero genuinely verified college facts/cutoffs remain the project baseline; manual screen-reader/assistive-technology review is outstanding; production credential revocation, seed-route protection, Redis-backed rate-limit/outage behavior, backups/restore and release settings remain owner-controlled. This does not certify production readiness or official admission requirements. This local acceptance record is included in the scoped Phase 7 checkpoint; no remote action is authorized or performed.

## Phase 8 — accounts, community, trust and admin improvements (local implementation)

**Scope and preservation:** Work is on `phase-8-accounts-community-admin`, based on checkpoint `a56caf5`. The existing authentication provider, session model, college-specific Q&A, evidence queue, report/rate-limit patterns, and planner are reused. `CollegeFind_AGENTS_V3.md` remains untracked and is excluded from the intended checkpoint. The 205 catalogue identities/slugs, existing source/evidence/audit history and genuine review state were not changed. Baseline remains 377 STAGED evidence claims, zero genuine reviewer decisions, and zero verified official cutoffs.

### Acceptance checklist

| Requirement | Status | Evidence / limit |
|---|---|---|
| Student account page, safe profile/timezone editing, own-data export | PASS locally | `/account`, session-scoped GET/PATCH, private no-store JSON export; email remains read-only without a verified change flow. Unit, integration and browser checks listed below. |
| Safe account deletion/deactivation and private-data cleanup | PASS locally for implemented behavior | Explicit `DELETE` confirmation; owner data cleanup and community-content removal; user row is anonymized/disabled to preserve evidence-review/audit foreign keys; last active ADMIN cannot deactivate. Focused PostgreSQL test asserts disabled account, password hash removal, cleanup and retained audit-compatible user row. This is not a production retention/legal approval. |
| Community posting, author edit/removal, reports and visibility | PASS locally | Existing college Q&A retained and improved; plain-text rendering, author checks, duplicate/rate controls and reporter-target idempotency. Reported content and public visibility are enforced by server queries. |
| Moderation queue and action authorization/audit | PASS locally | ADMIN-only paginated/searchable queue; hide/restore/dismiss require reason and expected state; stale action returns conflict; report resolution and action audit are transactional. Reporter identities are omitted from queue response. |
| Evidence decision concurrency and provenance safeguards | PASS locally for tested boundary | Existing evidence workflow reused; reviewer authorization and existing fixture/freshness/conflict/source holds remain; decision carries observed prior decision ID and stale action is rejected. No genuine claim was approved. |
| Cross-user privacy and privilege boundaries | PASS locally for tested routes | Disposable PostgreSQL integration covers ownership and ordinary-member denial for account, community, moderation and existing evidence routes. |
| Database compatibility and additive migration | PASS locally | Migration `20261120100000_phase8_accounts_community`, 13/13 deployed and status up-to-date on the independently checked disposable database. No existing college/user/evidence relation was rewritten by migration. |
| Manual accessibility and full assistive-technology review | PARTIAL | Desktop/mobile keyboard, labels, focus, status and workflows have browser coverage; manual screen-reader/magnification review remains outstanding. |
| Email verification, password recovery and verified email change | BLOCKED | No approved mail provider/token lifecycle exists in current auth architecture. Keep email read-only; owner must select/configure a provider and approve token/security design before implementation. |
| Production privacy/security, rate limiting, backups and release readiness | BLOCKED / owner-controlled | No production resources were accessed. Historical credential revocation, production seed restrictions, Redis-backed rate limiting/outage behavior, backup retention/restore rehearsal and deployed configuration remain unverified. |
| Genuine college evidence/publication | BLOCKED / human review | 377 claims remain STAGED; zero genuine approvals and zero official cutoff records are VERIFIED. Automated test decisions are synthetic and excluded from these counts. |

### Implementation details

- Account APIs never return password hashes, tokens or session secrets. `DELETE /api/account` requires the exact confirmation value, locks/serializes active ADMIN deactivation, refuses removal of the final active ADMIN, removes the user's saved colleges/comparisons/plans/reviews/reports, hides and replaces their public Q&A content with a removal notice, anonymizes/disables their account, clears its credential hash and prevents future authentication/session authorization. The database row remains so historical reviewer/audit foreign keys are not fabricated or orphaned.
- Community questions and answers remain personal user content, never official college facts. Authenticated authors can edit/remove their own visible content; signed-in users may report a question or answer once per target. Concurrent duplicate content/report submissions are handled by database uniqueness and safe recovery. Public responses include visible records only.
- `/admin/community` provides a stable paginated moderation queue. Actions validate role, reason and expected content state, then update content, resolve the report and write audit history in a transaction. Stale concurrent actions return `409`.
- `/admin/enrichment` remains the existing reviewer experience. Reviewer decisions include the last observed decision ID; stale decisions conflict rather than overwrite. Typed evidence decisions remain serialized/audited and all previous source, identity, fixture, expiry and conflict holds continue to apply.
- The migration adds `User.deactivatedAt` and `User.timeZone`, Q&A content hashes/uniqueness guards and indexes, and `CommunityReport` with exactly-one-target validation, reporter-target uniqueness and foreign keys. Rollback for an unreleased version is app-code revert while retaining the additive schema. Do not drop reports or account/content-hash fields without an approved backup and retention decision.
- `docs/PHASE8_ACCOUNT_COMMUNITY.md` contains owner navigation, account deletion/export behavior, security boundaries and rollback notes.

### Exact verification evidence

All database-backed commands below used the repository's guarded disposable environment `/tmp/collegefind-phase6-checks.sh`. The target was independently checked as `collegefind_phase5_test`, role `cf_phase4_test`, loopback-mapped `127.0.0.1:35440` (PostgreSQL 16.13; server container address `172.17.0.2`). A pre-test read observed 20 colleges, 26 users and 0 community reports. The integration harness resets its disposable tables; this was not the development database on port 5432, production, DevSync or the Phase 3 owner-review clone. No credentials were printed. No production operation occurred.

- `npm test` — **PASS, 22 unit files / 98 tests** after the final account deactivation credential-clearing change.
- `bash /tmp/collegefind-phase6-checks.sh npx vitest run --project integration` — **PASS, 16 files / 84 tests** on the disposable PostgreSQL database. The full suite ran before the final one-line credential-hash clearing addition.
- `bash /tmp/collegefind-phase6-checks.sh npx vitest run --project integration tests/integration/phase8-accounts-community.test.ts` — **PASS, 1 file / 5 tests** after that final addition; includes account CRUD/export/deactivation and cross-user behavior, community/reporting/moderation, stale evidence decision, and admin/member boundaries.
- `bash /tmp/collegefind-phase6-checks.sh npm run test:e2e -- --grep 'account and community flows|regular member is denied'` — **PASS, 4 Playwright tests** (Chromium and Pixel 7). Covers unauthenticated denial, account settings save and refresh, export, question posting/editing, cross-user reporting, admin hide/audit, member denial and mobile viewport/focus checks. These checks ran against the final account/community/moderation UI; they do not replace manual assistive-technology review.
- `npm run lint && npm run typecheck && git diff --check` — **PASS** after the last application change.
- `npx prisma validate && npx prisma generate` — **PASS**; `bash /tmp/collegefind-phase6-checks.sh npx prisma migrate deploy` — **PASS**, 13 migrations found/applied with no pending work; guarded `npx prisma migrate status` — **PASS**, schema up to date.
- `bash /tmp/collegefind-phase6-checks.sh npx next build --webpack` — **PASS** after the final application change. The required build child process was blocked by sandbox `EPERM` on an earlier unprivileged attempt; the supported webpack build completed with the guarded disposable environment. The earlier unrelated default-development `localhost:5432` connection warning was from an unguarded diagnostic build and failed before connecting; the final build did not use that target. No security setting was weakened.
- Existing pg adapter deprecation and local in-memory rate-limit fallback warnings were observed. Redis-backed production behavior is not verified. No dependency or lockfile changes were needed.

During implementation, integration checks caught and fixed an invalid PostgreSQL advisory-lock result handling in last-admin deactivation and a concurrent duplicate-report race. Browser checks caught and fixed a stale locator assertion; assertions were not weakened. Final focused checks above pass.

### Changed-file scope and decision

The intended change comprises account UI/API/export, community author/report APIs and college UI, admin moderation UI/API, stale-safe evidence review, auth/session/planner timezone adjustments, additive Prisma schema/migration, focused unit/integration/E2E tests, and `docs/PHASE8_ACCOUNT_COMMUNITY.md`, `docs/UPGRADE_PLAN.md`, `docs/UPGRADE_STATUS.md`. The unrelated untracked `CollegeFind_AGENTS_V3.md` is intentionally excluded.

**Phase 8 engineering status: PARTIAL.** The implemented local account, community, moderation and evidence-review slices pass their focused engineering checks, but the phase is not declared complete: verified email change/recovery lacks an approved provider, manual assistive-technology review and owner-controlled production/security/recovery verification remain open. This local work does not establish genuine evidence review or production readiness. **Phase 9 recommendation: CONDITIONAL GO for local development only**, provided Phase 9 preserves existing account/auth boundaries and does not assume Phase 8 production release acceptance. Owner actions before production: approve and configure a mail provider/token lifecycle; verify historical credential revocation without exposing secrets; demonstrate seed-route/authz and Redis behavior; provide backup retention and restore-drill evidence; complete manual assistive-technology review; and conduct genuine human review of staged facts.

## Phase 9 — production hardening and release acceptance

Base `47e65ec`, branch `phase-9-production-hardening`. The untracked `CollegeFind_AGENTS_V3.md` is outside the release diff.

| Release criterion | Status | Evidence and limits |
|---|---|---|
| Authentication, owner isolation and admin/evidence decisions | PASS locally | Server-side active-role and owner checks retained. Origin validation uses the configured scheme and origin and ignores caller-supplied forwarded host. Unexpected credential lookup errors return a generic retry message. Integration covers ownership, stale decisions and deactivation. Deactivated content cannot be restored by moderation. |
| Input bounds, headers, error handling and seed protection | PASS locally | Stream bytes are bounded before JSON parsing. Unsupported JSON lookalike media types are rejected. Errors avoid raw driver/provider text. Local production build returns expected headers and 404 for HTTP seed. CLI production demo and synthetic seeds exit before DB work. Deployed HTTPS cookie attributes and ingress behavior still need owner verification. |
| Redis policy and readiness | PASS locally for the modeled paths | Mocked shared provider tests cover exhaustion, provider error, fail-open timeout response and recovery. A separate local production-mode server without Redis returned liveness 200, readiness 503 and registration 503 with Retry-After. Real distributed enforcement, provider outage and recovery are BLOCKED pending owner-approved infrastructure evidence. |
| Fresh, forward and restored PostgreSQL schema | PASS locally | All 13 migrations deploy. Prisma drift reports no differences after aligning schema declarations with existing indexes and the legacy alias foreign key. No new migration or rewrite. Restore verified fixture values, IDs and relationships. |
| Pool lifecycle and operations | PARTIAL | The Prisma adapter owns the bounded runtime pool and closes it on disconnect. Build and browser exercise normal connections. Live saturation, traffic drain and shutdown behavior need environment evidence. |
| CI and build | PARTIAL | Local jobs, webpack and workflow YAML parsing verified. CI now gates high/critical advisories including dev dependencies, reports secret patterns without values, runs the complete recovery rehearsal and uses separate Playwright servers per project. GitHub has not run this candidate. |
| Automated accessibility and responsive journeys | PASS for browser checks | Login and signup inputs now have accessible names and autocomplete. Sign-in errors announce failures. Browser checks cover visible focus, keyboard submit, landmarks, mobile navigation, private workflows and reviewer boundaries. Manual screen-reader and magnification remain PARTIAL. |
| Catalogue and verified-only behavior | PASS locally | Demo seed SHA-256 `a9321b82b6f390790e09a647dfaf589b90c5736819aed6b9a5908922bfcc1637`, 205 original entries. Automated tests exercise reviewed-only evidence, demo isolation and unknown cutoffs. |
| Genuine data and source-use permission | BLOCKED | 377 staged claims, zero genuine approvals and zero verified official cutoffs. Keep staged and synthetic records out of confirmed public data. Obtain permitted source use and human review. |
| Historical credential remediation, backups and deployment | BLOCKED | Owner must supply non-secret revocation and rotation evidence, inspect provider logs and independently verify production configuration, retention, restore drill, RPO/RTO and rollout. |
| Email verification and recovery | BLOCKED | Phase 8 remains partial until owner approves a provider and token lifecycle. |

### Reproducible local evidence

A new PostgreSQL 16 Docker container exposed only loopback `127.0.0.1:32768`. Before mutation, SQL confirmed the mapped server, expected role and database names, and zero public tables in the dedicated verify, upgrade, restore, browser and shadow databases. Each applicable command used the temporary wrapper `/tmp/collegefind-phase9-run.sh <database-kind> ...` which rechecks the dedicated Docker port and SQL identity before setting the disposable confirmation. No application operational database supplied data.

- `npx prisma migrate deploy`, `npx prisma migrate status` and `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code` — PASS. Initial diff reported two existing community indexes and an alias foreign-key update mismatch. Schema declarations now match the actual tracked SQL and Prisma format passes.
- `bash scripts/rehearse-release-recovery.sh` — PASS on fresh upgrade and restore databases. The rehearsal preserves seven legacy tables, applies all remaining migrations and restores one row each in College, User, SavedCollege, SavedComparison, Source, Program, CutoffRecord, AdmissionPlan, PlanTask, FieldEvidence, EvidenceDecision, AuditLog, Question and CommunityReport, plus 13 migration rows. Counts and canonical row digests matched. Custom archive SHA-256 `d4a604112c8657e9fe96722217573c206bea5b68115299c0c4773dd145a6d416` was checked before transactional restore. Commands and rehearsal scope are in `docs/PRODUCTION_RELEASE.md`. The archive contained only synthetic fixtures and was removed after verification.
- `npm run lint`, `npm run typecheck`, `npm test`, `npx prisma validate`, `git diff --check` — **PASS**, including **104 unit tests in 23 files**.
- `npm run test:integration` — **PASS**, **84 tests in 16 files** when run without parallel builds/browser activity. An overlapping diagnostic run had 83 passes and one existing Phase 5 performance assertion at 427.06 ms p95 against a 300 ms budget. The full isolated rerun passed the original assertion.
- `npm run vercel-build` — **PASS** on the final application code. Runs Prisma generation and a webpack production build. Schema deployment is a separate operation.
- `npm run test:e2e -- --workers=2 --project=chromium` and `npm run test:e2e -- --workers=2 --project=mobile` — **PASS**, **70 passed, two intentional mobile-only skips on desktop, zero failures** (34 Chromium passes and 36 Pixel 7 passes). An initial combined run hit the unchanged login quota across both projects and exposed missing login labels and ambiguous CollegeFit selectors. The projects now use separate server lifecycles, labels are present, and CollegeFit assertions target accessible controls and links. Known pg adapter deprecation warning remains.
- `npm audit --audit-level=high --fetch-retries=0 --json` — PASS, zero advisories at all severities. `python3 scripts/check-release-secrets.py`, shell syntax check and workflow YAML parsing passed locally. A synthetic assignment in a scratch repository was detected with the location only. Scanning the current tree does not establish revocation of credentials from history.
- `NODE_ENV=production node --import tsx prisma/seed.ts` exited 1 with the expected refusal both with and without synthetic seeding configured. The normal disposable seed inserted the 205 demo records and synthetic cutoff fixtures for test use. The updated CLI rerun reported 0 created and 205 already present.
- A second loopback production server with the disposable limiter exemption turned off verified missing-Redis 503 readiness and registration, while liveness and the DB probe remained healthy.

**Local engineering:** PASS for the exercised release engineering scope, with infrastructure and manual follow-ups listed above. **Genuine data:** BLOCKED for unapproved claims and cutoffs. **Production deployment:** NO-GO pending remote CI, owner evidence, manual assistive technology and genuine-data acceptance. Owner procedures are in `docs/PRODUCTION_RELEASE.md` and `docs/SECURITY.md`.

## Verified-content release readiness — batch 028

**Branch/base:** `verified-content-release-readiness`, based on local Phase 9 checkpoint `44a2a2a`. Worktree was clean before this increment except for the pre-existing unrelated untracked `CollegeFind_AGENTS_V3.md`, which remains untouched and excluded. The 205-college seed was not modified; SHA-256 remains `a9321b82b6f390790e09a647dfaf589b90c5736819aed6b9a5908922bfcc1637`.

### Actual research and data results

- Researched **10 colleges** with no substantive STAGED facts before this pass: IIT Tirupati, NIT Manipur, Madras University, Jamia Millia Islamia, LNMIIT Jaipur, PSG College of Technology, University of Mumbai, King George's Medical University, St John's Medical College, and Banasthali Vidyapith. Types/regions span seven government and three private colleges in North, West, South, Rajasthan and the Northeast.
- Found **7 precise official-source candidate facts across 3 colleges**: two programme facts for NIT Manipur (four-year B.Tech CSE; five-year integrated B.Tech–M.Tech CSE start year 2026); two B.Tech programme facts for Jamia Millia Islamia (Civil Engineering and Computer Engineering, eight semesters); one JMI B.Tech admission route (JEE Main 2026 plus JMI application and final JEE rank); and University of Madras M.A. International Relations programme/eligibility facts.
- **Imported/staged: 0.** All seven remain research candidates only. **Exported for owner/reviewer follow-up: 7** in `data/pilot/substantive-research-batch-028.json` and the readable packet `data/pilot/substantive-batch-028-review-packet.md`. The candidates have no database `FieldEvidence` IDs and are not visible in `/admin/enrichment` yet. The packet's references are manifest array indices, not claim IDs.
- The current counts remain **123/205 colleges with substantive STAGED facts; 230 substantive STAGED claims; 147 source-reference claims; 377 total STAGED claims; 0 genuine approvals; 0 genuinely VERIFIED claims/institutions; 0 verified official cutoff records; 0 fully enriched colleges**. No candidate has been counted as verified or staged.
- The other seven colleges yielded no stageable facts: IIT Tirupati direct content did not render; LNMIIT pages timed out; PSG's enquiry form returned template placeholders; University of Mumbai portal scope/campus attribution is unresolved; KGMU's official page path timed out; St John's source was for a completed 2026 MBBS start; Banasthali's official PhD notice was for closed 2025–26 and direct page returned 502. No failed source was retried through a bypass and no snippets were used as evidence.

### Source-use and review holds

- **Jamia Millia Islamia:** its official copyright policy states website content may not be reproduced without due permission and requires source acknowledgement. Its three candidates remain held until written permission or an owner-approved documented legal determination permits the intended factual storage/public use.
- **NIT Manipur:** the department page was directly readable and the two programme statements have line locators. The same page shows a 2017 copyright footer while describing a programme starting in 2026. No source-specific factual-use permission was found. Human confirmation of current offering and owner source-use review are required.
- **University of Madras:** its official AY 2026–27 admissions portal marks PG registration closed on 1 June 2026. The PDF states one programme and eligibility, but no source-specific factual reuse licence was identified; the two facts remain historical and held for campus/scope and source-use review.
- All documents remain externally linked only; no source PDF, full table or prose was copied. No automated source collection was performed.

### Persistence and verification evidence

- No authorized persistent non-production evidence destination was available for genuine research. No database was connected or modified; in particular, no disposable test DB was used as a persistent evidence destination. This is why candidates were exported as a durable artifact rather than claimed as database-staged facts.
- `npm run ingest:official-facts -- --file data/pilot/substantive-research-batch-028.json --report /tmp/collegefind-batch-028-dry-run.json` — **PASS**, 7 candidates validated, `reviewState: UNREVIEWED`, `databaseChanged: false`. This dry-run validates shape/source metadata only; it does not prove database idempotency or source rights.
- `npx vitest run --project unit tests/unit/data-foundation.test.ts tests/unit/public-evidence.test.ts tests/unit/evidence.test.ts tests/unit/field-evidence.test.ts` — **PASS**, 4 files / 22 tests. The initial focused `data-foundation` run also passed 1 file / 3 tests. These are unit checks, not DB-backed importer idempotency.
- `git diff --check` — **PASS** after final documentation/artifact edits.
- Candidate deduplication against the current per-college coverage ledger and earlier substantive research manifests — **PASS**, no identical candidate fact found. This is an artifact-level comparison, not a database uniqueness test.
- Seed/coverage reconciliation — **PASS**, exactly 205 records; baseline checksum unchanged. Coverage ledger records the ten follow-up dispositions and preserves all previous import, review and audit counts.
- No application code, schema or migration changed; integration, browser, production build and DB migration suites were not rerun because this increment changes research artifacts and documentation only.

### Files changed and remaining owner actions

Changed: `data/pilot/substantive-research-batch-028.json`, `data/pilot/substantive-batch-028-review-packet.md`, `docs/DATA_COVERAGE.json`, `docs/DATA_COVERAGE.md`, and this status file. No app code, database, environment file or credentials changed.

Owner actions before import/review: (1) decide and document the intended rights basis for concise factual extraction/retention from each provider, especially obtain permission or legal approval for JMI; (2) confirm NIT Manipur page freshness and University of Madras campus/scope and closed-cycle labeling; (3) provide an explicitly authorized non-production evidence destination and approved preservation/export procedure; then stage via the existing guarded importer and inspect the resulting records through the existing authenticated `/admin/enrichment` workflow. An authorized reviewer must make a separate explicit decision for every fact. No approvals were fabricated.

This batch improves **research documentation**, not public catalogue coverage: the user-facing profile, search, comparison and CollegeFit data counts did not change. Security controls were not weakened. Production readiness remains **NO-GO** under inherited owner-controlled Phase 9 and genuine-data gates. Next scoped task: after owner source-use and persistence decisions, stage only the approved subset through the existing importer and verify read-back/audit via the approved preservation path.

## Verified content release readiness — persistent owner review handoff — 2026-11-19

Branch: `verified-content-release-readiness`; starting checkpoint remains `60ddc07`. The untracked `CollegeFind_AGENTS_V3.md` is preserved and not included in this work. Original 205 college IDs/slugs and existing staged evidence/audit history are unchanged. No live database, production or DevSync resource was accessed; no account or reviewer decision was created.

### Database and owner access disposition

- The only owner-review database evidenced in prior notes is `collegefind_phase3_snapshot_owner_review_20261118_test` inside the disposable `collegefind-phase3-disposable-20261118` container/port 35439. It was last read-only checked as 205 colleges, 269 sources, 377 claims, 293 runs, 377 staging audits, zero users and zero decisions. Its `_test` name and disposable service make it **ineligible** as persistent reviewer storage. That historical check was not repeated and is not a current liveness assertion.
- No separately approved persistent non-production evidence database is documented. Selecting/provisioning one is an owner-controlled blocker. The old DATA_COVERAGE.md commands that signed into the disposable clone and promoted an ADMIN were withdrawn; the new [`OWNER_EVIDENCE_REVIEW.md`](OWNER_EVIDENCE_REVIEW.md) distinguishes review storage from test infrastructure.
- Added a separate owner-only target validator and snapshot bootstrap utility. It requires `OWNER_REVIEW_DATABASE_URL`, explicit `COLLEGEFIND_OWNER_REVIEW_DATABASE_CONFIRMED=true`, loopback `127.0.0.1:35441`, role `cf_owner_review`, and a `collegefind_owner_review_<name>` database. It rejects test/production-like names and has no runtime/test URL fallback. `--apply` is separate from the read-only dry run. The import is one transaction, checks the current migration count and snapshot/seed/identity/provenance/audit references, requires an empty target for bootstrap, then verifies exact read-back. A repeat verifies archived rows without overwriting user decisions or later owner data. The old test restore/export guards were not weakened.
- The new bootstrap tool has pure archive/target unit coverage, but has not been connected to a database. Database restore/idempotency are therefore **BLOCKED pending owner provisioning/authorization**.

### Reviewer packet and interface

- Existing dashboard/API remain the review surface: `/admin/enrichment`, ADMIN-gated, explicit per-claim approve/reject with required reason, stale-state concurrency checks and audit logging. Registration remains USER by default. No authorization bypass or automatic approval was added.
- The existing 25-item packet reconciles claim ID, catalogue ID/slug, field, exact JSON value, academic year, locator, publisher and URL against the SHA-256-verified batch-027 archive. Added city/state identity context, source publication/retrieval dates, license and source notes, a publication-date freshness warning, a campus/scope prompt and conflict-peer IDs/warnings. The UI exposes source-use notes in a disclosure and retains direct source and exact-claim queue links. All 25 remain STAGED_UNREVIEWED and outside the 16 held claims.
- Packet distribution: 8 programme/admission claims (CMI and IIM Calcutta), 1 SPJIMR programme, 2 Nirma BBA admission/tuition, 3 DAU/DA-IICT admission/fees, 6 IIT Roorkee tuition/hostel/waiver, 2 MNNIT denominator-defined placed counts, and 3 CMC Vellore MBBS programme/fee claims. Source publication dates are absent on 24 records; SPJIMR has a dated 2026-09-16 release. Source records say explicit bulk-reuse permission is not established; some state source-specific public-use review is still required. The packet is inspection priority, not a recommendation to approve. Reviewers must decide rights and exact fact validity individually.
- The 16 holds remain unchanged: six expired cycle claims, two IIT Kanpur disputes, four MNNIT programme-scope collisions, one IIM Amritsar historical cycle claim, and three IIM Bangalore source-use/historical claims.

### Focused checks in this increment

- `npx tsx scripts/export-owner-review-packet.ts` — **PASS** after host authorization for tsx's local IPC socket; archive checksum and all 25 claims reconciled. No DB connection/write/decision.
- `npm test -- tests/unit/review-packet.test.ts tests/unit/owner-review-target.test.ts tests/unit/owner-review-archive.test.ts` — **PASS, 3 files / 13 tests**. Covers missing/unconfirmed/malformed target, wrong host/port/role, test/production-like database rejection, archive hash/205 identities/counts/references/audits/fixture and reviewer-decision exclusion, the 25 claim IDs/status/holds, and source/provenance details.
- `npm run typecheck` — **PASS**.
- `npm run lint` — **PASS**, whole repository, zero warnings.
- `npx prisma validate` — **PASS**; no schema or migration changed.
- `bash /tmp/collegefind-phase9-run.sh browser ./node_modules/.bin/next build --webpack` — **PASS**. Wrapper used the separately verified disposable browser-test database, not the restore/owner-review database.
- `bash /tmp/collegefind-phase9-run.sh browser ./node_modules/.bin/playwright test tests/e2e/admin.spec.ts --workers=1 --reporter=list` — **PASS, 2/2** (Chromium desktop and Pixel 7). Covers current packet location/source-use/freshness content, direct source and claim links, unauthorized access, queue search/conflict/pagination, reasoned synthetic approval/rejection and audit, fixture denial, and synthetic staged→public publication. This is a disposable test-only approval, not genuine review. The wrapper's read-only identity query returned `collegefind_phase9_browser_test|kevin|5432`; prior wrapper preflight enforces its CollegeFind-only loopback container. No owner-review or production database was used.
- The latest explicit database restore, reviewer CRUD/approval cycle and restore-then-retry remain **BLOCKED**: the only database recorded for review is a disposable `_test` clone, and owner-authorized persistent local storage is not yet selected. No migration or restore was attempted.
- `git diff --check` — **PASS** after final changes. No source was re-fetched and Batch 028 was not imported.

### Counts and gate result

Existing staged evidence remains **377** (230 substantive across 123 colleges; 147 references). New claims staged here: **0**. Existing substantive claims open for inspection: **214**, held: **16**. Genuine approvals: **0**; synthetic approvals in this increment: **0**; verified official cutoff records: **0**. The 7 Batch 028 research candidates remain artifact-only and were not changed or imported.

**Local review-code readiness: PASS for the tested dashboard/packet flows; PARTIAL for the new owner restore utility pending DB-backed rehearsal.** **Operational owner-review readiness: BLOCKED** until the owner chooses/provisions and independently verifies a persistent local non-production database, executes guarded snapshot restore and creates/promotes their own account. **Real verified-data publication and production readiness remain BLOCKED**; no claim is approved and historical production/security/backup owner checks are unchanged. See [`OWNER_EVIDENCE_REVIEW.md`](OWNER_EVIDENCE_REVIEW.md) for setup, review, encrypted backup and restore instructions.

### Owner-review restore rehearsal follow-up — 2026-11-19

- Added a distinct `--rehearsal` restore mode with a separate environment variable and target contract. It requires independent confirmation of loopback `127.0.0.1:35442`, role `cf_owner_rehearsal`, and a unique `collegefind_owner_rehearsal_<name>` database. It cannot fall back to the persistent owner target, `TEST_DATABASE_URL`, or runtime `DATABASE_URL`. The persistent target remains on port 35441 / role `cf_owner_review` and is still owner-controlled.
- Archive revalidation: **PASS**. SHA-256 `24c039bb7fd13a994e0c0e01ce1059f06dc7c492e118aa3cbfbaefe4b2697fbf` matches manifest; seed checksum and all 205 unique IDs/slugs match; 269 unique sources, 377 unique claims, 293 unique import runs and 377 unique staging audits; zero orphaned claims/runs/audits, users, decisions or fixtures. The first 25 packet claims reconcile to the snapshot; all 25 remain STAGED and unheld.
- Fresh PostgreSQL rehearsal: **PASS** on newly created and independently TCP-verified disposable container/database `collegefind_owner_rehearsal_20261119_r4m8`, role `cf_owner_rehearsal`, server port 5432, host bound only to `127.0.0.1:35442`. `npx prisma migrate deploy` applied all **13/13** migrations to the empty temporary database. Restore dry-run, initial `--apply`, transactional exact read-back and idempotent retry passed with **205 colleges, 269 sources, 377 claims, 293 runs, 377 staging audits, 0 users and 0 decisions**.
- Retry preservation: after the first restore, one clearly synthetic user and one synthetic APPROVED decision were inserted in that disposable database only. A second restore returned `REHEARSAL_IDEMPOTENT_VERIFIED`; read-back confirmed **1 user, 1 decision, 205 colleges, 269 sources, 377 claims, 293 runs, 377 audits** unchanged. These synthetic rows were destroyed with the container and do not count as genuine approvals.
- Failure/guard behavior: target unit tests reject missing, malformed, persistent-via-rehearsal, test-suffixed, wrong-host and wrong-port URLs before connection. Archive unit tests reject checksum tampering, fixture rows, reviewer decisions, orphaned sources, and invalid import-run/audit relationships. An initial live disposable restore exposed a PostgreSQL-vs-JavaScript slug collation ordering mismatch; the check was corrected to sort read-back identity pairs in application code. The failed apply was inside a transaction and did not touch persistent data; the succeeding fresh-container restore passed.
- Checks after the fix: focused unit tests **14 passed / 3 files**; typecheck, lint, Prisma validation and `git diff --check` **PASS**. Existing admin browser evidence (2/2 desktop/mobile from the prior checkpoint) was unaffected; not rerun. No application UI behavior changed.
- The temporary rehearsal container was stopped and removed. No persistent owner-review target was provisioned or modified, no genuine claim was staged or decided, and no production/DevSync resource was accessed. Current genuine counts remain **377 staged, 0 genuine approvals, 0 verified colleges, 0 verified cutoff records**.

**At that checkpoint, operational owner-review readiness was BLOCKED** pending durable local storage. The following 2026-11-19 section supersedes that storage/restore blocker; account creation and genuine reviewer actions remain owner-controlled.

### Persistent local owner-review environment — 2026-11-19

- Created only after verifying the proposed container name, volume name, database port, `.env.local`, and private storage paths were unused. Persistent PostgreSQL 16 service: container `collegefind-owner-review-postgres`, named volume `collegefind-owner-review-pgdata`, database `collegefind_owner_review_main`, non-superuser role `cf_owner_review`, host binding `127.0.0.1:35441`. Private files are under `${HOME}/.local/share/collegefind-owner-review/`; backup directory is `backups/`; repository `.env.local` is ignored and mode `600`. Runtime, bootstrap, pgpass and `NEXTAUTH_SECRET` files are mode `600`, generated locally, and were not printed or committed.
- Independently verified over TCP: `collegefind_owner_review_main|cf_owner_review|5432`; role is not superuser and cannot create databases. Existing containers/databases/volumes were not inspected or altered, and the setup aborted on any named collision.
- `npx prisma migrate deploy`: **PASS, 13/13 migrations** applied to the new empty owner database. Guarded archive dry-run and `--apply`: **PASS**. Exact read-back: **205 colleges, 269 sources, 377 claims, 293 import runs, 377 staging audit rows, 0 evidence decisions, 0 users**. All 25 packet claims were read back from the persistent DB and matched college/slug, value, year, evidence locator, publisher and URL.
- Persistence: `docker restart collegefind-owner-review-postgres` followed by a fresh TCP identity/count query **PASS**, exact same `205|269|377|293|377|0|0` counts. The Docker volume is not disposable-test storage.
- Initial encrypted backup: GPG AES-256 custom-format dump at `${HOME}/.local/share/collegefind-owner-review/backups/collegefind-owner-review-initial-20261119.dump.gpg`; SHA-256 `de54e6acc3434b894d037cfe2ffce12ce45b6e4f9d91e13f78a52d2df1d3a2cb`. Full decryption to a mode-600 temporary archive and `pg_restore --list` validation **PASS**. The backup contains no users or decisions. `age` is unavailable; the runbook now uses installed GPG. Keep a protected copy of the backup passphrase separately from this host for actual disaster recovery.
- Disposable-test exclusion: with `TEST_DATABASE_URL` deliberately pointed at the persistent owner target and test confirmation true, `assertDisposableTestTarget()` refused it before any DB client/connection. A regression test covers owner-review URL/role/port rejection. The persistent target was never used by a destructive test.
- Local app: `npm run dev -- --hostname 127.0.0.1 --port 3317` is running using `.env.local`. Read-only HTTP checks: `/register` **200**, unauthenticated `/admin/enrichment` **307** to login, unauthenticated `/api/admin/evidence` **401**. No account was created. Persistent `User=0`, `EvidenceDecision=0`; no human review or synthetic decision entered persistent storage. The admin queue cannot be opened until the owner registers and promotes only their account.
- Verification after test-guard change: focused unit tests **18 passed / 4 files**; typecheck, lint, Prisma validation and `git diff --check` **PASS**. No full browser suite was run against the owner DB because doing so requires an account and would violate the owner-only boundary. Earlier disposable browser tests verified the review workflow; synthetic approval does not count toward genuine data.
- Current content counts remain **377 staged, 0 genuine approvals, 0 verified colleges, 0 verified official cutoffs**. All 16 held claims remain unchanged. The review packet stays at 25.

**Next owner action:** open `http://127.0.0.1:3317/register`, register your own account, then use the identity-checked local SQL procedure in [`OWNER_EVIDENCE_REVIEW.md`](OWNER_EVIDENCE_REVIEW.md) to promote exactly that account. Sign out and back in, open `/admin/enrichment`, inspect each source/value/scope individually, and approve/reject with a reason. Make a fresh encrypted backup after the review session. The initial backup checksum above predates any user or review decision.

### Owner review readiness recheck — 2026-11-19

- Reused the existing service; no restart, restore or write was needed. Container `collegefind-owner-review-postgres` is running, mounted on `collegefind-owner-review-pgdata`, bound to `127.0.0.1:35441`. Read-only TCP identity is `collegefind_owner_review_main|cf_owner_review|5432`.
- Current counts: **205 colleges, 269 sources, 377 staged claims, 293 import runs, 377 staging audits, 0 users, 0 evidence decisions**. Aggregate user-role and decision-status queries returned empty. No personal identifiers were read. Real approvals/rejections: **0/0**; genuine verified cutoffs: **0**.
- Local app checks: `/register` **200**; unauthenticated `/admin/enrichment` **307**; unauthenticated `/api/admin/evidence` **401**. App is already available at `http://127.0.0.1:3317`; no second server was started.
- Rechecked with host access because the sandbox cannot reach the host-bound service: the existing container was still running (`Up`, loopback-only `127.0.0.1:35441`) and the existing app returned `/register` **200** and anonymous `/admin/enrichment` **307**. Aggregate-only database verification still returned 205/269/377/293/377/0/0; no user identifiers or evidence values were read. Read-only public projection checks for CMI Chennai and IIM Calcutta returned `UNVERIFIED`, zero structured facts and zero legacy official metrics; a two-college list response returned total 2 with the same empty verified-fact projection. This confirms staged claims were not exposed in these sampled public responses. It does not prove publication of genuinely approved claims, because there are none.
- Review queue preparation: the existing 25-claim packet still matches the archived records and persistent DB read-back from setup. All 25 are pending individual human inspection, not approvals. The packet reports missing publication dates for 24 claims; only the SPJIMR source has a publication date recorded. Source-use and campus/programme scope must be reviewed claim by claim. The 16 separately held items remain held; 214 substantive items remain open for inspection; the other 147 claims are source references.
- No browser login was attempted, no account was created/promoted and no claim was approved/rejected. Publication against genuine approved data is therefore **PENDING**. Existing synthetic disposable-browser tests do not count as genuine publication evidence.
- The initial encrypted backup remains available and unchanged. No new post-review backup was made because there are no genuine review decisions yet. Create a fresh timestamped encrypted backup after the owner completes a real review session; never overwrite the initial archive.

| Release criterion | Current state | Evidence / remaining action |
|---|---|---|
| Local persistent review DB and archive restore | **PASS locally** | Named persistent volume, 13 migrations, 205/269/377/293/377 restore and restart persistence already verified. |
| Owner identity and genuine claim decisions | **BLOCKED — owner action** | `User=0`, `EvidenceDecision=0`. Owner must register, promote only their account and inspect each claim. |
| Verified-only publication from genuine approvals | **PENDING** | No genuine approved claim exists. Test after owner decisions; synthetic test approvals do not qualify. |
| Historical credential revocation/rotation | **BLOCKED — owner evidence** | Requires non-secret owner confirmation and provider/history evidence; repository edits cannot establish revocation. |
| Remote GitHub Actions acceptance | **BLOCKED — remote evidence** | No remote workflow was triggered or inspected in this task. |
| Production Redis, HTTPS and cookie behavior | **BLOCKED — production owner checks** | Local app check does not establish production service behavior. |
| Production backup retention and restore target | **BLOCKED — production owner evidence** | Local encrypted backup is not production retention or a production restore rehearsal. |
| Email verification and account recovery | **BLOCKED — provider setup** | No provider configured or delivery flow verified. |
| Manual screen-reader and magnification review | **BLOCKED — human check** | Must be completed by a person using assistive technology. |
| Official cutoff source-use and genuine cutoff coverage | **BLOCKED — source/human review** | 0 verified cutoff records; permission and reviewer decisions remain outstanding. |
| Genuine approved college data | **BLOCKED — human review** | 377 staged, 0 genuine approvals. Production remains **NO-GO**. |

**Next action is the owner's registration at `http://127.0.0.1:3317/register`.** Then run the guarded, identity-specific local ADMIN promotion command in `docs/OWNER_EVIDENCE_REVIEW.md`, log out/in, and review the 25 claims individually. No further automated action is safe before that owner step.

### College profile content and Batch 029 — 2026-11-19

- All 205 seed rows carry catalogue name/short name, city, state, type and slug. They lack description, about, website, phone, email and admissions fields. All 205 include demo course lists, accreditation grades, fees, placement/recruiter figures and legacy establishment/student counts. The publisher rules withhold these legacy values unless separately supported and reviewed. The local owner database reported 205 colleges, 377 claims, zero users and zero review decisions. Zero genuine approvals and zero verified official cutoffs remain the baseline.
- The profile now gives catalogue identity its own overview and renders an approved description if About is unavailable. The section navigation leads to programmes/admissions, fees and aid, recognition, placements/facilities, cutoffs and sources. Empty metric cards and misleading row-update freshness text were removed. Individual structured facts retain their source and dates, and the profile shows exact units without replacing missing values. Nine profiles now offer editorial links to institutional pages. The public data projection still withholds staged claim values.
- Fixed attribution that could attach expired or superseded evidence to a visible field. Sources now come from the same active reviewed set as the displayed value. Reviewed website/admissions values with embedded URL credentials are refused.
- [Batch 029](../data/pilot/substantive-research-batch-029.json) covers 20 colleges, nine proposed substantive facts across nine colleges, and 13 research holds. Ten held entries have a scoped factual observation and three describe unresolved leads. The existing importer accepted the nine proposed facts in dry run. It only allows writes to a verified disposable database. The candidates remain in the manifest for later authorized staging. No persistent data, claims, audit history or reviews changed.
- [Profile completeness](PROFILE_COMPLETENESS.json) reconciles all 205 stable slugs and 377 archived claim/source relationships, including the 16 existing holds. The first 25 claims remain in the existing human review packet and the authorized admin queue. Start with the IIT Roorkee and CMC fee/prospectus records for 2026–27 if you want to check publication after the first review. Confirm campus, cycle, category and payment period, then record an individual decision with a reason. Next-year structured claims still use the existing future-year publication gate. Publication after genuine approval is pending.
- Checks passed: focused Vitest run, 25 tests in five files; ESLint; TypeScript; importer dry run via `node --import tsx scripts/ingest-official-facts.ts --file data/pilot/substantive-research-batch-029.json`; and five live HTTP assertions on the local DIT profile. The live response showed the source link and unverified state, without staged programme duration or the empty key numbers grid.
- Final webpack production build (`npm run build -- --webpack`) passed in an isolated source copy. A build without environment variables stopped at sitemap configuration. Supplying a generated throwaway auth secret and an unreachable loopback database let the build complete with the expected static sitemap fallback. The live HTTP smoke used the existing owner application and made no changes. Browser and database-backed approval tests were outside this check. The ledger reconciles each original ID/slug and every archived claim ID, and the original seed hash matches the checkpoint.

### Owner staging and first publication rehearsal — 2026-11-20

- Added `scripts/stage-owner-review-facts.ts` and the separate owner staging gate. Preview validates the full batch, exact loopback target, database role and all 205 archived ID/slug pairs. Apply requires the exact approved manifest hash. Under the same lock used for field review, the command replans and creates and verifies a fresh encrypted whole-database backup before any insert. It writes unreviewed evidence and associated provenance/audit records. Existing decisions are not a write target. Existing test guards and the ordinary importer remain disposable-only.
- Persistent read-only preview for Batch 029 returned 9 additions and 0 writes. The destination is `collegefind_owner_review_main` on `127.0.0.1:35441`. Read-back was 205 colleges, 377 evidence claims, 0 users and 0 decisions. The local review application was restarted on port 3317. Registration returned 200, anonymous dashboard access 307, anonymous evidence API 401, and the public DIT API 200. No account was created or promoted.
- The disposable archive clone started at 205 colleges, 377 claims, 269 sources, 293 runs, 377 audits and 0 decisions. A missing backup passphrase aborted before inserts and the preview was byte-for-byte unchanged. With a valid backup, 9 claims, 9 sources and 9 runs were appended. A retry reused all 9, with no writes. All new claims began with zero decisions. The archive checksum and all 205 ID/slug pairs matched.
- The existing dashboard now records individual holds, shows the latest disposition for each packet item, and links directly to the next undecided claim. A configured owner-review origin remains authoritative for mutation checks when the local Next server normalizes its internal request URL. The profile source summary now surfaces available and flagged reviewed fields with dates and avoids listing empty provenance for each unreviewed field.
- Coverage triage includes 214 substantive claims open for inspection, 16 held and 147 references. 360 lack a publication date or academic year. Batch 028's seven candidates remain blocked, Batch 029's nine await separate approval, and its 13 research holds remain outside the candidate set. No additional research claims were opened in this increment. The focus was moving existing evidence through the staging and review path.
- Verified with `npm test -- tests/unit/owner-review-stage.test.ts tests/unit/public-evidence.test.ts tests/unit/evidence.test.ts tests/unit/owner-review-target.test.ts tests/unit/release-security.test.ts` (34 passed), and `npm run test:integration -- tests/integration/official-facts.test.ts tests/integration/public-projection.test.ts tests/integration/evidence-queue.test.ts` (7 passed in a separate disposable test database). Prisma generation, lint, typecheck, webpack production build, release secret scan and `git diff --check` passed.
- Playwright `test owner-stage.spec.ts --workers=1 --timeout=90000` passed both Chromium desktop and Pixel 7 emulation on an isolated webpack development server. Production login refused the initial rehearsal because Redis was absent, as intended. The passing rehearsal verified the staged → held → approved → rejected sequence, including refresh, source and duration on the profile, no horizontal overflow, programme search, comparison and CollegeFit. A separate clone read-back matched IISER Mohali's admission year, scope, locator and source. A post-review exact replay preserved all 8 synthetic decision tuples and audit counts, both successful runs and holds from earlier troubleshooting included. No synthetic approval counts as genuine publication.

### Student-visible profile navigation and Batch 030 — 2026-11-20

- Root cause: legacy enriched values are demo data or staged and correctly withheld. Identity appeared alongside a whole-profile status badge, source navigation drew only the nine Batch 029 links, and an optional cutoff or similar-college query error could prevent the profile from rendering. Profiles now distinguish catalogue identity from reviewed details, prioritize the dated source guide on mobile, split placements from housing and facilities, and preserve primary content when an optional query fails. A failed cutoff fetch shows a retry route rather than an empty result.
- The attributed source guide grew from 9 links on 9 profiles to 162 links on 131 profiles. All 205 original identities have a profile layout and the remaining 74 use the official AISHE institution directory fallback. The link registry uses archived observed pages and selected fresh direct observations. It excludes ambiguous and blocked destinations and keeps dated cycle references labeled. External destination availability can change.
- Replaced misattributed O.P. Jindal Raigarh navigation with first-party Sonipat destinations. Two archived reference IDs are blocked from approval with an explicit reason. No archived claim row, profile identity, data migration or persistent reviewer decision changed.
- Batch 030: seven colleges researched, four substantive programme candidates on three college profiles, four held research findings, and zero new persistent staging or approvals. Database-free importer dry run succeeded. Persistent read-only check reported 205 colleges, 377 claims, 0 approvals and 0 users. Local registration returned 200. Genuine verified facts and official cutoffs remain at zero.
- Comparable reviewed annual tuition now retains publisher, source URL, publication and review dates. Conflicting rates remain hidden and are flagged without source attribution to a nonexistent published value. A reviewed institution site or admissions link also suppresses the missing-source fallback when the editorial registry has no entry.
- Validation: 13 focused unit tests, 9 PostgreSQL integration tests (public projection and cutoff explorer), 4 Playwright tests (Chromium desktop and Pixel 7 emulation), lint, typecheck, Batch 030 importer dry run, and webpack production build passed. The archive and integration databases were independently verified on an isolated PostgreSQL container. The final built-app HTTP sweep returned 200 for all 205 profiles and all 205 public detail APIs. It verified 162 registered links, 74 directory fallbacks, all profile sections, stable IDs and no visible demo fee, placement value or unreviewed structured claim. Browser tests exercised guest shortlist persistence, comparison selection, section and cutoff navigation, the historical source label, and the staged/reviewed/rejected lifecycle with disposable approvals only.
- Rechecked the Central University of Punjab link after the archived endpoint returned 503. Its working 2026–27 notices page replaced the archived destination in public navigation. The old source record remains preserved.

### Profile quality standard and Batch 031 — 2026-11-20

- Published profile baseline and after-state: 205 basic, 0 partially informative, 0 meaningfully informative. The classification counts only visible, genuinely reviewed facts. Type-specific decision needs are documented in the coverage rubric. Archived evidence, candidates and editorial links are measured separately.
- The profile now places reviewed annual tuition and attribution in Fees, gives structured payment periods and degree levels plain labels, and links programme, fees and aid, placements, recognition and facilities sections to relevant entries in the official source guide when available. Unsupported values remain unknown. The admin reviewer workflow already exposes evidence, scope, source notes, next item and durable individual decisions, so no reviewer UI replacement was needed.
- Batch 031 visited sources for 12 directory-only profiles. Eight gained 13 direct destinations, including the official CLAT authority reference for WBNUJS Kolkata. Total coverage moved from 131 profiles / 162 links to 139 profiles / 175 links. There are 66 directory-only profiles. The batch produced 10 distinct candidate facts across seven colleges, six held findings, and zero staged or approved in the persistent database. The number of profiles with staged or prepared substantive facts rose from 137 to 138. This includes research awaiting clearance. The number with substantive staging remains 123.
- Registry and ledger reconciliation preserved all 205 ID/slug pairs and 377 archived claim IDs. The seed hash was unchanged. Existing Ashoka admissions, NISER entrance route and Nagpur MBA programme facts were excluded as already covered. Batch 028's seven candidates remain held, Batch 029's nine need separate exact authorization, Batch 030's four need scope, freshness and rights checks, and Batch 031's ten passed the importer dry run with its persistent staging gate disabled.
- Persistent aggregate read-back on `collegefind_owner_review_main` returned 205 colleges, 377 claims, zero approvals and zero users. The separate disposable integration target passed 13 focused tests across public projection, official import and cutoff exploration. Prisma validation and client generation passed. No production or persistent owner writes were performed.
- Final checks passed: 13 unit tests, 13 PostgreSQL integration tests, 4 Playwright cases (2 Chromium desktop, 2 Pixel 7), lint, typecheck, Prisma validation and generation, webpack production build and the release secret scan. Playwright covered linked engineering, medical, law, management, general university and arts/science profiles, source navigation, guest shortlist and comparison, and reviewed programme and fee rendering with synthetic decisions confined to the disposable archive. A final production HTTP sweep returned 200 for all 205 profile pages and 205 public detail APIs, confirmed all 175 links and 66 directory fallbacks rendered, and confirmed no demo fee, placement metric or staged structured fact surfaced. The app was restarted separately on local owner port 3317 for the first genuine review session.

### Source-reported programme release — 2026-11-20

- The previous renderer consumed only reviewed field evidence. The 377 archived rows, including 230 substantive claims across 123 colleges, therefore supplied no verified public details while genuine approvals remained zero. This milestone adds a profile-only projection alongside that existing verified projection.
- The local source-reported policy covers 22 programme records on 20 of 205 college profiles. It draws 13 records from the archive eight from the Batch 029–031 manifests and one new factual candidate from the live IIT Patna collector in Batch 032. All cards identify the institution, campus, programme, level, duration where available, direct source, locator, collection and check dates. Intake is left unknown. The other 185 profiles still have basic identity and navigation. No profiles are content-complete. The [coverage table](DATA_COVERAGE.md#programme-details-visible-on-local-profiles) lists the underlying exact sources.
- The existing importer, evidence decisions, search/fit filters, comparisons and admission guidance retain the reviewed-only policy. Source-reported facts are rendered on the server profile without being added to college API JSON, search payloads or comparison/admission inputs. The policy rejects first-party matches with unclear intake, numeric decision-critical claims, invalid or changed provenance, review holds, conflicts, expired attestations and wrong campus IDs. Source-reported cards disappear when held, rejected, superseded or replaced by an applicable approved claim.
- The [release register](../data/pilot/source-reported-release.json) records a reason and source-use assessment for each release. Withdraw a card by changing its entry to `WITHDRAWN`, recording the reason and versioning the change. A corrected fact needs a separately checked source, new fingerprint and provenance in the existing candidate workflow. This preserves the earlier policy and evidence history. The programme checks expire on 2027-01-19 UTC unless individually rechecked.
- AFMC requires permission for incoming hyperlinks. The existing direct editorial link was removed and the directory fallback retained. Direct navigation now covers 138 colleges with 174 links. The profile release keeps GNLU, Loyola, MICA, JIPMER, NISER, historical intakes and sensitive fee/aid values outside the pilot for the specific reasons listed in the coverage ledger.
- The collector runs one registered IIT Patna department request after checking the exact host robots file. It respects the matching crawl delay, declines redirects or access denial, uses explicit origin/path and response limits, and writes an importer-format unreviewed candidate under a fresh output name. It stores no HTML and performs no imports, approvals or public changes. Run `node --import tsx scripts/collect-official-programme.ts --source iit-patna-cse --output /tmp/iit-patna-programme.json` to collect; run `node --import tsx scripts/ingest-official-facts.ts --file /tmp/iit-patna-programme.json` for the database-free validation preview.
- A new disposable PostgreSQL database applied all 13 migrations and restored the exact checked archive (205 identities, 269 sources, 377 claims, 293 runs, 377 audits and zero decisions). Batch 029 created 9 staged claims on the clone. A repeat reused all 9 with zero new rows. The dedicated owner-review database and source archive were untouched. For genuine approval, open [the owner guide](OWNER_EVIDENCE_REVIEW.md) and use the 25-claim packet in `/admin/enrichment`. Persistent import remains subject to separate approval of the exact batch and destination.
- The first pilot passed six disposable Chromium checks across desktop and mobile. Tests confirmed 20 college profiles show their attributed programme cards, staging stays outside verified search, administrator decisions are audited, holds and rejection suppress cards, and synthetic approval switches the profile to the reviewed presentation and supplies the approved fact to search, comparisons and CollegeFit. The production-server sweep loaded all 205 original profile routes and checked policy presence or absence in 203. The two lifecycle profiles were inspected in Playwright, which exercises their changing states.
- The final live collector ran after the IIT Patna robots file allowed the department path with a one-second delay. It recorded one 48-month B.Tech programme in Artificial Intelligence and Data Science. The [Batch 032 artifact](../data/pilot/substantive-research-batch-032.json) validated with no database connection. No owner staging took place.
- Final checks: 17 focused unit tests, seven PostgreSQL integration tests, six desktop/mobile lifecycle and profile-navigation tests, and two production-build desktop/mobile programme tests passed. Prisma validation/generation, lint, TypeScript and webpack production build passed. Browser comparisons capture the same IIT Kharagpur section before and after. The final browser assertions scope to the student-visible main landmark because Next.js streams a temporary hidden copy of the content.
- The owner database was checked in a read-only transaction. It still has 205 colleges, 377 claims and zero decisions or cutoff approvals. Read-only Chromium checks against the existing localhost app at port 3317 found all 22 exact programme values and matching sources across the 20 profiles. The application therefore already displays the new cards locally. Production release remains gated.

### Scoped programme publication and Batch 033

Programme and facilities cards now carry the archived academic year, publisher period, publication date and validity bounds when available. A historical listing is labeled on its card. The release expiry remains independent of the period described by the fact. Compatible staged values and partially populated programme records can coexist with an eligible attributed card. An applicable hold, rejection, withdrawal, supersession or substantive conflict suppresses it. Reviewed facts take precedence. Legacy course lists with an explicit blocking decision also suppress their matching programme cards.

The local release adds 45 source-reported facts and 42 colleges, reaching 67 cards on 62 of 205 profiles. Desktop Chrome and Pixel 7 Chromium checked actual section content, exact values and durations, provenance links, periods, labels and overflow on port 3317. [Coverage and source restrictions](DATA_COVERAGE.md#publication-of-programme-periods-and-facilities-batch-033)

Verification passed on the scoped release: 15 focused unit tests, seven integration tests against a separate disposable PostgreSQL database, two production profile Playwright projects, lint, typecheck and the webpack production build. The read-only owner check returned 205 colleges, 377 staged claims, zero reviewer decisions and 377 audit entries. On the owner app, programme search excluded the source-reported match, comparison showed no reviewed structured fact for it and CollegeFit did not display the source-reported card. Batch 033 passed the importer dry run with 21 candidates and zero database changes.

The authenticated reviewer lifecycle passed in both desktop and mobile Chromium using a fresh disposable archive restore and a local development rate limiter. The tests exercised hold, approval, rejection, audit counts, verified fee display and verified-only search, comparison and CollegeFit. The production browser run passed the profile tests. Its local reviewer login lacked a production rate-limit backend, so the authenticated flow was verified separately.

### Content depth increment — batches 034–036

The source-reported layer now exposes 126 low-risk facts on 103 of 205 college profiles, up from 67 facts on 62 profiles at the previous checkpoint. The increment adds 59 student-visible facts across 41 profiles: 51 new manually researched candidates (20 programme, 15 programme, five facility, nine facility and two admissions records across batches 034–036) plus eight previously archived/importer-validated facts that became eligible after the profile projection began supporting their section types. A further 18 profiles now have two or more distinct categories (21 total, up from three). The 51 new candidates were added to the source-reported publication manifest only; they were not imported to the persistent owner-review database and are not human-VERIFIED.

The resulting category counts are **99 programme, 17 facility, seven admissions-route and three contact facts**. Source-reported amounts for fees, scholarships, rankings, accreditation, placements and cutoffs remain zero. Those decision-critical or validity-sensitive facts stay in the individual human-review workflow. The 205-row ledger continues to show missing categories per institution type; 102 colleges still have identity/navigation-only or no source-reported facts. No profile is described as complete.

The profile renders programmes and routes within “Programmes and admissions”, facilities in “Facilities”, and contacts in “Official resources”. Each card links to its source and shows institution/campus scope, evidence location, the source-reported warning and collection/check dates; time-scoped routes show publisher period and historical status. The admission schema expressly excludes eligibility rules, application URLs, thresholds and seat/cutoff numbers from this low-risk publication path. VIT’s listing is scoped to its Vellore campus and 2027 listing; Anna University’s 2023 curriculum is explicitly historical; the 2026 NIT Goa counselling/entry item is explicitly historical. Source pages expose institutional facts, not blanket reproduction or bulk-use permission. See the per-source assessments in the three batch manifests and [coverage increment](DATA_COVERAGE.md#content-depth-increment-batches-034036).

Two recognition leads remain held for individual review rather than published: the Tezpur University NBA register returned HTTP 403 and the institution’s accessible scan did not provide readable corroboration (newly recorded in this increment); St John’s Medical College’s NMC course register is historical and requires reconciliation with the current recognition record (existing hold retained). Other research attempts were blocked by HTTP 403/502, timeouts or unavailable/non-readable official PDFs; no access restrictions were bypassed. These include an IIM Bangalore programme page, IIT Dharwad/IIT Bhilai programme pages, IIIT Delhi programme/facility pages, NLU Delhi regulations, NUJS admissions, an RVCE PDF, a JIPMER course PDF, a Woxsen programme PDF and notices at NIT Andhra Pradesh, KEM Mumbai and IIM Lucknow. Unsupported facts were not filled from search snippets.

No write was made to the persistent owner-review database: it remains 205 colleges, 377 staged claims, zero genuine decisions/approvals and 377 staging audits. New batch candidates remain unreviewed source-reported publication inputs, not database-staged evidence. The existing 16 held claims were not cleared. The review guide now groups 14 additional existing eligible evidence items by source/institution for manual inspection; this does not change their STAGED status. Two recognition leads remain held, and the exact approval/rejection/hold action remains the owner’s.

Focused source-reported/public-evidence unit tests passed **16/16**; source-reported, evidence and official-fact PostgreSQL integration tests passed **7/7** against a new ephemeral PostgreSQL 16 container bound only to `127.0.0.1:35442`, with all 13 migrations applied and automatic container/credential cleanup. No owner database was used by integration tests. Lint, typecheck, `npx prisma validate`, and `npx prisma generate` passed. The webpack production build passed with host process permission; two earlier sandbox attempts failed because Next's spawned TypeScript `--showConfig` process returned empty captured output although direct TypeScript output was valid. The focused Playwright suite passed **2/2** (Chromium desktop and Pixel 7 mobile). It checked all 205 profile HTTP responses/name identities and source-reported values/provenance across 103 pages, with six profile-section screenshots under `/tmp/cf-profile-depth-20261121`. It made GET-only requests to the existing local app configured for the owner-review database; no persistent data or review decisions were written. The source cards remained absent from the college public API and verified-only search/compare/CollegeFit inputs. `git diff --check`, JSON parsing, and `python3 scripts/check-release-secrets.py` passed. Final diff review found only this content milestone and its verification/documentation; unrelated untracked `CollegeFind_AGENTS_V3.md` remains unstaged. Previous milestone results above are carried-forward evidence and are not represented as checks for these changes.

### Content depth continuation — Batch 037

- Added a fresh, directly source-checked batch of **42** source-reported facts: DTU B.Tech names/duration (14), VJTI first-year B.Tech names and a 2026–27 Maharashtra DTE route (10), PEC batch-scoped B.Tech listings (4), BJMC MBBS programme/duration text (1), NIT Patna listed degree levels (3), and IIT Gandhinagar B.Tech programmes and two research facilities (10). The 42 comprise 39 programme facts, one admission-route fact and two facility facts.
- Checked the facts against these opened first-party pages: DTU academics (`bacheloroftechnology.php`, last updated 2026-09-01); VJTI Undergraduate Admission (2026–27 and page timestamp 2026-10-22); PEC Undergraduate Programmes (page updated 2026-11-19, batch periods retained); BJMC Courses Offered (no publication year shown); NIT Patna Institute/About (no publication year shown); IIT Gandhinagar BTech Programmes and Research Facilities (no publication dates shown).
- `src/server/source-reported.ts` now loads Batch 037 through the same fingerprinted, scoped, expiring source-reported rules. All new facts stay `OFFICIAL_SOURCE_REPORTED`, never `VERIFIED`; high-impact claims (eligibility, money, seat counts, placements and cutoffs) were excluded. No database migrations, persistent owner-database writes, staged-claim imports or reviewer decisions occurred.
- Accurate checked-in projection after recomputation: 168 source-reported facts on 109/205 profiles, 23 with at least two fact categories, 96 basic profiles. Categories: programmes 138, facilities 19, admissions 8, contacts 3; fee, scholarship, recognition, placement and cutoff claims remain 0. Existing archive remains 377 claims (230 substantive), 0 genuine decisions and 0 verified cutoff records.
- Focused unit tests: `tests/unit/source-reported.test.ts` **9/9 passed** after adding period/provenance assertions for DTU, VJTI, PEC and IITGN. Desktop Chromium and Pixel 7 mobile Playwright passed **2/2**; each checked all 205 profile routes and all 168 policy cards across 109 profiles, including exact source URLs, claim headings/values, campus, evidence location, source-reported labels, and periods, and verified that public college API responses do not expose these cards as human-verified structured facts. The new run also verified the transparent source-reported empty-state explanation. Screenshots: `/tmp/cf-profile-depth-20261121-b037/dtu-programmes-desktop.png`, `/tmp/cf-profile-depth-20261121-b037/vjti-programmes-mobile.png`, and IITGN programme/facility desktop/mobile files in the same directory. The DTU screenshot distinguishes the page update date from publication; VJTI shows the article publication date and separate update timestamp. Lint, typecheck, Prisma validation/generation, `git diff --check`, and webpack production build passed. The persistent owner-review database was used only by GET-only browser requests; no owner/test decisions were written. PostgreSQL integration tests were not rerun: no schema, query, or database mutation code changed.
- Additional research holds recorded in Batch 037: Presidency University programme-to-campus scope is unresolved across its two campuses; AIIMS New Delhi’s source overview is dated 2023 and direct fetch timed out; IIIT Delhi’s official page timed out. Search snippets were not used. Date presentation distinguishes VJTI's 2025 article publication from its 2026 page update and leaves DTU's page-update marker out of the publication-date field.

### Content-depth continuation — Batches 038–039

- **Batch 038** added 22 source-reported facts on four previously basic college profiles: 14 programmes, two historical admission-route facts and six contacts. **Batch 039** added 16 on four more previously basic profiles: 11 programmes, four facilities and one historical admission-route fact. Total: **38 additional facts across eight new profiles**.
- The source-reported projection increased from **168 facts/109 profiles/23 multi-category/96 basic** after Batch 037 to **206 facts/117 profiles/29 multi-category/88 basic**. Category totals are 163 programmes, 23 facilities, 11 admission routes and 9 contacts. Fees, scholarships, recognition, placements, rankings and cutoffs remain at zero source-reported facts because the applicable stronger review requirements are not met.
- The four SRM School of Law programme cards link a second official faculty/contact page for the Kattankulathur location; the programme page itself does not state the campus. LPU card evidence locations now also include the brochure's Phagwara address scope.
- Each fact carries its official source, institution and scope, evidence locator, retrieval/check date and period where given. Historical course/admission information is visibly labeled; missing academic years and unspecified teaching campuses are stated. The LPU brochure lacked a stated academic year, so its entries are labeled historical. JIPMER’s 2025–26 route is historical and distinguishes the two campuses. No admissions eligibility thresholds, fee/outcome figures, source tables or copied prose were added.
- Batch 038 retains five direct-source access holds and the IIT Kanpur programme conflict. Batch 039 records Jadavpur’s official page HTTP 502 after direct opening; the search snippet was not used. Source-use assessments do not infer blanket redistribution permission.
- No owner-review database writes or staging occurred. Archive remains **377 staged claims** (230 substantive); genuine human approvals **0**; verified official cutoff records **0**. All new publication rows are `OFFICIAL_SOURCE_REPORTED`, not `VERIFIED`, and remain outside trusted search, comparison and CollegeFit inputs.
- Final Batch 039 acceptance: focused source-reported unit tests passed **11/11**; desktop Chromium and Pixel 7 mobile Playwright passed **2/2**. The browser suite checked all 205 canonical profile routes in both projects, rendered the eight new profiles' facts with exact names, values, years/periods, campus scope and official source links, and verified SRM campus cross-check links plus listed programme durations. It confirmed held IIT Kanpur facts remain absent, fees remain unavailable, and source-reported cards stay out of the verified public API projection. Lint, TypeScript typecheck, webpack production build, release secret scan, JSON/provenance checks and `git diff --check` passed. The E2E run used a local `next start` on port 3318 and GET-only requests; no database schema or data changed, so destructive PostgreSQL integration tests were not run. The persistent owner-review database was not written.
- Screenshots: `/tmp/cf-profile-depth-20261121-b038/` contains desktop/mobile profile-section captures for the Batch 038 and Batch 039 colleges plus the focused suite’s source-profile checks.

## Content breadth follow-up — Batch 040 (2026-11-21)

Implemented a new official-source research batch and added its 36 eligible observations to the existing source-reported profile projection; two previously researched Loyola programme candidates from Batch 031 were also released. No new evidence-system/database architecture was added. The 205-college profile ledger now reconciles 244 source-reported facts across 124 profiles, 37 profiles with multiple categories and 81 basic-only profiles (before: 206/117/29/88). Category totals: programmes 184, facilities 29, admission routes 16, contacts 15; high-impact fee, scholarship, recognition-validity, placement, ranking and cutoff facts remain withheld. Six previously basic profiles gained Batch 040 content; Loyola gained two prior candidates; NLU Delhi and SRCC gained additional category depth.

Validation: `npx vitest run tests/unit/source-reported.test.ts` — 12 passed after adding Batch 040 source fingerprint, scope, category, historical-cycle and college-scoped archive-suppression checks. No persistent staging writes, schema changes, synthetic approvals or owner-review decisions were made. Eight documented source/freshness/scope holds remain. Live profile/browser verification is blocked in this environment: no `DATABASE_URL` or `TEST_DATABASE_URL` is configured, PostgreSQL at localhost:5432 does not respond, Docker daemon access is denied, and port 3317 is not serving the app. Unit eligibility is not a substitute for live profile verification. Broader milestone checks (lint, typecheck, Prisma validation/generation, production build and secret scan) are pending.

## Content breadth follow-up — Batch 041 (2026-11-21)

Batch 041 adds 10 source-reported factual records across NIT Kurukshetra (five), Madras Medical College (two) and Stanley Medical College (three). Six are programme listings and four are scoped public institutional contacts. The ledger changes from 244 to 254 records, 124 to 127 covered profiles, 37 to 39 profiles with multiple categories and 81 to 78 basic-only profiles. The release register preserves source fingerprints, official URLs, evidence locators, scope, retrieval date and historical/freshness context. Four explicit research holds and one ambiguous candidate exclusion remain. The first Batch 041 focused unit run passed 13/13. No database writes or approvals were made; total archive remains 377 STAGED claims, genuine approvals 0, verified cutoffs 0.

Verification after the combined Batch 040–041 diff: `npx vitest run --project unit` — 143 passed across 29 files; `npm run lint` — passed; `npm run typecheck` — passed; `npx prisma validate` and `npx prisma generate` — passed; `python3 scripts/check-release-secrets.py` — passed; JSON parsing and 205 unique ledger slugs — passed; `git diff --check` — passed. `npx next build --webpack` was attempted repeatedly and failed in Next's type-configuration step with `Could not parse output from TypeScript's --showConfig`; a direct `npx tsc --showConfig --project tsconfig.json --pretty false` emits valid parseable JSON, so the framework invocation failure remains unresolved. It was not bypassed. Live-page/screenshot tests are BLOCKED because no isolated PostgreSQL service/test URL is available and Docker socket access is denied; the persistent owner-review DB was not used. No schema changes, database writes or synthetic approvals occurred.

## Build recovery and Batch 042

- Build diagnosis — `npx next build --webpack` reproduced Next.js's `Could not parse output from TypeScript's --showConfig` failure in the sandbox. The same Node spawn of `typescript/bin/tsc --showConfig --project tsconfig.json --pretty false` with piped stdout exited 0 and returned zero bytes inside the sandbox. On the host it exited 0 and returned 14,746 bytes of valid JSON. Toggling detached execution did not change either result. A permitted host `env -u NODE_OPTIONS node node_modules/next/dist/bin/next build --webpack` completed TypeScript checking, generated 49 static pages and listed the dynamic college, evidence and admissions routes. The application build configuration remains intact.
- Archive rehearsal — a new PostgreSQL 16 container bound only to 127.0.0.1:35439. Verified its label, scoped role/database and empty public schema before applying all 13 migrations. The guarded archive restore read back 205 colleges, 269 sources, 377 claims, 293 runs and 377 audit rows exactly. A repeat inserted zero rows. There were zero users, decisions or fixture claims. The browser run used this clone and the focused PostgreSQL integration suite used a separate disposable database.
- Batch 040–041 browser baseline — desktop Chromium and Pixel 7 emulation passed all four Playwright cases. The source-reported case in each project checked all 205 route identities and all 254 visible facts, including exact values, sections, campus, dates, labels and provenance. It checked the verified-only API, held IIT Kanpur claim and unavailable fee state. The assertion now distinguishes multiple contacts issued by the same office and includes DIT and Galgotias when the separate mutating reviewer scenario is disabled. The navigation case checked links, sparse profiles, save and comparison controls. Screenshots are in `/tmp/cf-b041-screens`.
- Batch 042 — 15 new facts across eight previously basic profiles. Totals are 269 facts across 135 profiles, 45 with multiple categories and 70 basic. Twelve direct access, evidence or freshness exclusions are documented in the manifest. The coverage report lists six priority staged claims for owner inspection. No human approval is counted and no persistent review data was written.
- Batch 042 static and database checks — 143 unit tests and seven PostgreSQL integration tests passed. The first integration run had one origin mismatch because it inherited the browser test URL. All seven passed on retry with the integration suite's expected origin. Lint, standalone TypeScript checking, Prisma validation and generation, release secret scan and diff checks passed. The source-reported projection, archive and ledger reconcile across all 205 original identities. The original seed SHA-256 is `a9321b82b6f390790e09a647dfaf589b90c5736819aed6b9a5908922bfcc1637`.
- Batch 042 production and browser acceptance — the host webpack build completed with TypeScript validation, 49 static pages and the expected dynamic routes against the migrated archive clone. All four profile/navigation cases passed in desktop Chromium and Pixel 7 emulation. Each profile case checked 205 routes and 269 rendered facts. The new IIT Ropar programme remained absent from verified search. Two further browser cases passed for comparison and CollegeFit isolation, including the UNKNOWN fit outcome. Screenshots are in `/tmp/cf-b042-screens` (104 images). The targets remain open by 15 substantive profiles and five profiles with multiple categories.

## Verified-content workstream — Batch 043

Batch 043 extends the existing source-reported path without changing the database schema, owner-review database, staged archive or verified-only feature projections. It adds 27 attributed facts to seven previously basic college profiles: 23 programme facts, one historical admission route, one historical library schedule and two contact facts. Profile coverage is now 142/205 substantive, 47 multi-category and 63 identity/link-only, compared with 135/205, 45 and 70 before this increment. All values retain exact source URLs, evidence locations, institution/campus scope, collection date and any publisher period. GNLU, LHMC and NIT Arunachal facts are historical; academic years were not inferred where the publisher did not state them. One LHMC admission-route candidate is held for missing applicable cycle.

All 296 public source-reported facts remain labeled `OFFICIAL_SOURCE_REPORTED`; they are not human-verified. Genuine approvals remain 0, official verified cutoffs remain 0, and the persistent review database was not written. Existing source-use notes permit only concise, attributed factual values and do not establish blanket reuse rights. Fees, eligibility thresholds, scholarship amounts, placements, ranking/accreditation validity and cutoffs remain outside this release. Focused publication-policy unit tests pass (14 tests); full browser/database acceptance is still pending until the isolated PostgreSQL browser rehearsal is available.

## Content breadth continuation — Batch 044 (2026-11-21)

Batch 044 implements 31 new source-reported facts across 19 previously basic colleges. It adds 14 programme/degree facts, eight facilities/accommodation facts, two historical admissions-route facts and seven institutional contacts. From the baseline of 142 informative profiles, 296 facts, 47 multi-category profiles and 63 basic-only profiles, the checked-in release now contains 161 informative profiles, 327 facts, 56 multi-category profiles and 44 basic-only profiles. The per-college ledger reconciles these values for all 205 stable slugs; the original seed hash remains unchanged.

`npx vitest run tests/unit/source-reported.test.ts` passed 15/15 after adding Batch 044 provenance, collision/hold, temporal-scope and source-label checks. New sourced facts remain `OFFICIAL_SOURCE_REPORTED`, never `VERIFIED`. Three candidate facts were withheld (IIT Kanpur archive conflict; IIIT Gwalior duplicate staged route; IIT Jodhpur direct-page timeout). Eight further institutions are documented as source-access/retrieval holds. No admin review decisions, owner database writes, staged-archive changes or cutoff data were created.

Final verification for Batch 044: the focused unit suite passed **15/15**; Playwright passed **4/4** (desktop Chromium and Pixel 7, two tests each). The profile test requested all 205 profile routes in each project, verified the eligible fact cards and exact source attribution, checked verified-only search/comparison/CollegeFit boundaries and captured desktop/mobile screenshots. `npm run lint`, `npm run typecheck`, `npx prisma validate`, `npx prisma generate`, `python3 scripts/check-release-secrets.py`, JSON parsing and `git diff --check` passed. The host-side `npx next build --webpack` passed TypeScript validation, generated 49 static pages and emitted the dynamic profile/API routes. Build and browser used the existing local review database read-only; no persistent owner-review writes or test approvals occurred. Screenshots are in `/tmp/cf-b044-screens`. The seed SHA-256 remains `a9321b82b6f390790e09a647dfaf589b90c5736819aed6b9a5908922bfcc1637`.

The browser run used runtime eligibility so future-dated and expired release records are not expected to render as current. No profile data dates were rewritten to force test visibility. All 31 Batch 044 release entries were eligible and visible on the correct local profiles at verification time. The release remains source-reported rather than human-verified; 44 profiles still have only basic identity/navigation, 377 staged claims remain unreviewed, genuine approvals remain 0, and verified official cutoffs remain 0.

### Content coverage continuation — Batches 045–047 (2026-11-21)

Reused the existing source-reported collector, publication register, profile sections, and eligibility/suppression rules. Added 46 source-reported release records: 16 programmes, 15 facilities, four admission-route facts, and 11 institutional contacts. Batch 045 adds 15 facts and five newly informative profiles; Batch 046 adds 22 facts to nine profiles already informative in the runtime projection (depth only); Batch 047 adds nine facts and four newly informative profiles. No schema/migration changes, evidence archive writes, owner-review decisions, or approvals were made.

A deterministic as-of runtime projection at `2026-11-21T17:01:57Z` yielded 155 informative profiles / 331 facts / 59 multi-category / 50 basic-only, compared with 146 / 285 / 48 / 59 immediately before Batch 045. New category totals were 220 programmes, 52 facilities, 22 admission routes, and 37 contacts. This is a time-dependent source-reported projection; future-dated, expired, held, conflicted, withdrawn, and reviewer-superseded facts remain excluded. The checkpoint's earlier static figure (142 profiles / 296 facts) and the previous Batch 046 static report are not interchangeable with this runtime calculation; Batch 046's nine new-profile count was wrong and has been corrected in `PROFILE_COMPLETENESS.json` and `DATA_COVERAGE.json`.

Focused verification:

- `npx vitest run tests/unit/source-reported.test.ts --reporter=dot` — **PASS, 18/18**.
- `npm run lint` — **PASS**.
- `npm run typecheck` — **PASS**.
- `npx prisma validate` and `npx prisma generate` — **PASS**. No schema changes were made.
- `python3 scripts/check-release-secrets.py` — **PASS**; six JSON research/coverage artifacts parsed; `git diff --check` — **PASS**.
- Sandboxed `npm run build` — **BLOCKED** before compilation because Turbopack worker creation attempted a port bind denied by sandbox policy (`Operation not permitted`). Host-side `npx next build --webpack`, with both database URLs pinned to unreachable loopback port 1, **PASS**: compiled successfully, type-checked, generated all 49 static pages and emitted the dynamic college/API routes. Sitemap collection logged `sitemap_db_unavailable` as expected because no database was reachable during this build.
- `E2E_PORT=3318 COLLEGEFIND_REPORTED_BROWSER=true CF_PROFILE_SCREENSHOTS=/tmp/cf-b047-screens npx playwright test tests/e2e/source-reported.spec.ts --workers=1 --reporter=list` — **PASS, 4/4** (desktop Chromium 2/2, Pixel 7 mobile 2/2). Each project checked all 205 college route identities; all eligible facts' values, source links, campus/scope, year/period and source-reported labels; unavailable fees and held IIT Kanpur claims; no VERIFIED cards; and verified-only search, comparison and CollegeFit behavior. The service used the identity-checked local `collegefind_owner_review_main` database. The test paths made only public GET requests; no review mutation was exercised. Screenshots: `/tmp/cf-b047-screens` (162 images, including GITAM and BHU programme sections and facilities/contact screenshots).
- The database identity check used `default_transaction_read_only=on` and confirmed `collegefind_owner_review_main`, loopback Docker address, port 5432 inside the container, and **205 colleges**. A later review-decision-count query did not complete because the automatic permission review timed out; no mutation command was issued. The last recorded genuine approval count remains 0, and this work made no approval writes.

The `377` staged archive claims and zero verified cutoff records remain unchanged by this work. Source access/reuse holds are detailed in Batch 045–047 manifests. The target of 20 new profiles from the current starting point was not met: runtime projection adds nine, and source access/freshness/scope restrictions prevented safe publication from several attempted leads. Do not treat source-reported content as human-VERIFIED or as input to verified-only search, comparison, CollegeFit, admission guidance, or ranking.

### Content depth continuation — Batch 048 final verification (2026-11-21)

Batch 048 adds **seven** source-reported facts to three profiles: two programme facts, two historical admissions facts, and three institutional contacts. The direct official sources were the [CURAJ 2025–26 admissions newsletter](https://www.curaj.ac.in/sites/default/files/Admission%20Newsletter%202025-26.pdf), [CURAJ admissions page](https://curaj.ac.in/admissions), [University of Mysore 2026–27 academic schedule](https://uni-mysore.ac.in/english-version/sites/default/files/content/Fee%20Structure%20for%20UG%20and%20PG%20Admission-Affiliation-Examination-Certificates-Research%20Centres-Specialized%20Programs%20for%20the%20year%202026-27.pdf), and [JAIN admissions page](https://www.jainuniversity.ac.in/admission). Exact values, source locations, institution scope and publisher periods are in `data/pilot/substantive-research-batch-048.json`. A displayed email was withheld because the official page rendered an obfuscated address; no address was inferred. NIT Jamshedpur's page was only a JavaScript shell, Mizoram University's page returned HTTP 502, and CUSAT's official pages returned HTTP 502/timeouts; these were held rather than replaced with snippets or guesses. Fee values in the Mysore schedule were not released.

The policy-time projection as of `2026-11-21T17:54:26.858Z` is **173/205 profiles with substantive source-reported facts, 380 facts, 70 multi-category profiles, and 32 basic-only profiles**. At the supplied Batch 043 baseline the corresponding figures were 142, 296, 47 and 63; the intervening Batch 044–048 changes add 84 facts and 31 informative profiles. Batches 045–048 alone add 53 facts across 12 newly informative profiles: 18 programmes, 15 facilities, six admissions-route facts and 14 contacts. Runtime eligibility is date-sensitive; future, expired, held, conflicted, withdrawn and reviewer-superseded records remain excluded. These are source-reported facts, never human-VERIFIED. Genuine human approvals remain zero; the 377 archived claims remain staged and no verified official cutoff records exist. No persistent review database writes, imports, migrations or reviewer decisions occurred.

Batch 048 focused unit tests: `npx vitest run tests/unit/source-reported.test.ts --reporter=dot` — **PASS, 19/19**. Playwright: `E2E_PORT=3318 COLLEGEFIND_REPORTED_BROWSER=true CF_PROFILE_SCREENSHOTS=/tmp/cf-b048-screens npx playwright test tests/e2e/source-reported.spec.ts --workers=1 --reporter=list` — **PASS, 4/4** (two Chromium desktop and two Pixel 7 mobile cases). Both projects checked all 205 college identities and validated displayed source-reported facts, source links, evidence locators, periods, status labels, withheld data and verified-only search/comparison/CollegeFit boundaries. The owner-review database was identity-checked as `collegefind_owner_review_main` and confirmed to contain 205 colleges; browser traffic was public GET-only. A new exact reviewer-decision count query did not complete under the permission review, so zero genuine approvals is the last recorded count; no writes were performed. Representative captured screenshots: `/tmp/cf-b048-screens/central-university-of-rajasthan-programmes-desktop.png`, `/tmp/cf-b048-screens/mysore-university-contacts-mobile.png`, and matching JAIN desktop/mobile files in the same directory.

Also passed: `npm run lint`, `npm run typecheck`, `npx prisma validate`, `npx prisma generate`, `python3 scripts/check-release-secrets.py`, JSON parsing, identity reconciliation and `git diff --check`. No schema changes were made. The host-side `npx next build --webpack` completed successfully with database URLs pinned to unreachable loopback port 1; the expected sitemap database-unavailable warning confirms the build did not query a database. Sandboxed build remains blocked by the previously documented worker-port restriction. No PostgreSQL integration suite was rerun because this increment changes source policy/data and its focused unit/browser checks exercise the affected behavior without schema or query changes. Batches 045–048 did not reach the conditional target of 20 newly informative profiles (12); the remaining 32 basic profiles require further accessible, correctly scoped, permitted source evidence. The source-reported display remains distinct from verified-only features.

### Content breadth continuation — Batch 049 (2026-11-22)

Reconciled the previously reported growth using the same runtime definition: Batch 044 contributed 31 facts and 19 newly informative profiles (142/296 → 161/327); Batches 045–048 contributed 53 facts and 12 newly informative profiles (161/327 → 173/380). Batch 046 was depth-only for nine already informative profiles; batches 045, 047 and 048 covered five, four and three new profiles respectively.

Added Batch 049 to the existing source-reported release register; no database schema changes or owner-review database writes were made. The exact fingerprinted register contains 20 facts across eight previously basic profiles: 9 programmes, 1 2027 cohort-specific admissions route, 3 facilities and 7 contacts. The affected identities are IIM Bangalore, Jadavpur University, IIT Dharwad, IKGPTU (Amritsar constituent campus), Nagaland University (Kohima Campus), Saveetha University/SSM, NMIMS Mumbai/SBM and Kalasalingam University. The facts are source-reported, not human verified. The 2024–25 Jadavpur/IIT Dharwad facts are labeled historical; IIMB and IKGPTU retain their 2027–31/2026–27 contexts; other undated listings explicitly state the source does not give a current admission cycle.

Runtime projection at `2026-11-22T03:52:00Z`: **181/205 profiles with substantive source-reported facts, 400 facts, 75 multi-category profiles, and 24 basic-only profiles**. Batch 049 delta: +8 informative profiles, +20 facts, +5 multi-category profiles. Category totals: 262 programmes, 59 facilities, 28 admissions, 51 contacts. No fees, scholarships, recognition validity, placements, rankings or cutoffs were added. All 205 identities remain represented. Detailed per-college projection and remaining basic-profile list are in `docs/PROFILE_COMPLETENESS.json` and `docs/DATA_COVERAGE.md`.

Excluded/held findings: IIM Lucknow and Osmania official pages timed out/502; IIT Jodhpur direct pages timed out/cache-missed/502; IIT Kanpur remains blocked by held/contradictory archived programme sources; IIT/IIIT/NIT/CUSAT pages returning 403/502/JavaScript shells were not replaced with search snippets. ICT Mumbai returned 403; IKGPTU programme scope was published only for the source-named Amritsar constituent campus; Kalasalingam programme listings were held for campus ambiguity and only its explicitly generic admissions contact is included. OP Jindal Raigarh did not match the Sonipat catalogue identity; St John’s Medical College Bengaluru did not match the Agra St Johns College row. Banasthali's directly opened curriculum material is dated 2019 and was not presented as current.

The existing 25-claim owner review packet remains unchanged. Its six top priorities remain programme/year-scoped tuition, eligibility, fee waiver and denominator-defined placement evidence; no claims were staged into the persistent review database, and no approval/rejection/hold decisions were made. Genuine approvals remain **0**; official verified cutoffs remain **0**. The owner must register their own account at `http://127.0.0.1:3317/register`, then follow the guarded local USER→ADMIN procedure in `docs/OWNER_EVIDENCE_REVIEW.md` for that exact account before making individual review decisions.

Focused source-policy tests and static projection succeeded. The 190-profile target was not met; the eight-profile batch is the largest this research pass could support without relaxing identity, campus, freshness or source-use checks.

#### Batch 049 final verification

- `npx vitest run tests/unit/source-reported.test.ts --reporter=dot` — **PASS**, 20/20 tests.
- `npm run lint` — **PASS**.
- `npm run typecheck` — **PASS**.
- `npx prisma validate && npx prisma generate` — **PASS**; no schema or migration change was made.
- `python3 scripts/check-release-secrets.py` — **PASS**.
- `git diff --check` — **PASS**.
- Runtime projection at `2026-11-22T03:52:00Z` — **PASS**, 205 catalogue identities preserved; 181 profiles, 400 eligible source-reported facts, 75 multi-category profiles and 24 basic-only profiles. Genuine human approvals remain zero.
- `tests/e2e/source-reported.spec.ts` — **PASS**, 4/4 Playwright cases across desktop Chromium and mobile Pixel 7 emulation. The E2E suite requested all 205 profile routes and checked the batch 049 rendered facts, attribution/status, hold suppression and verified-only boundaries. Screenshots: `/tmp/cf-b049-screens` (204 files; desktop and mobile captures for the source-reported content cases). A representative desktop capture was visually inspected.
- Default sandbox `npm run build` — **BLOCKED by sandbox process restrictions**, with the CSS worker unable to create/bind its worker process (`Operation not permitted`). The supported host-side production Webpack build `npx next build --webpack` — **PASS**, compiled, completed TypeScript, generated 49 static pages and route output. Build-time database variables were set to deliberately unreachable loopback port 1 (literal values omitted); the sitemap emitted its expected unavailable-database warning.
- Existing owner-review PostgreSQL service — read-only connectivity **PASS** (loopback binding `127.0.0.1:35441`, existing database accepting connections). No query or write was made against persistent owner-review records; staged count and decisions were not modified.

### Content breadth and category-depth continuation — Batch 050 (2026-11-22)

This increment reuses the existing release model and profile sections; no schema change, owner database import or review decision was made. Six official-source facts were added to the fingerprinted release register across four previously basic profiles: IIT Kanpur gets the P. K. Kelkar Library listing; ISB gets a 12-month PGP listing and a Class of 2027 admissions-process item; St John's College Agra gets a B.A. listing and the 2026–27 university-registration/application sequence; NIT Srinagar gets a historical 2026 MBA/PG notice-index fact. The policy as-of timestamp is `2026-11-22T04:40:00Z`: **185 informative profiles / 406 source-reported facts / 77 multi-category / 20 basic-only** (from 181 / 400 / 75 / 24). New category counts are +2 programmes, +1 facilities listing, +3 admissions descriptions and +0 contacts. The 20 remaining basic profiles are named in `docs/PROFILE_COMPLETENESS.json` and detailed source holds in Batch 050.

All six facts are source-reported, not human-verified. ISB's cycle record expires after its 6 Dec 2026 deadline; NIT Srinagar's 2026 notice fact is historical. The St John's page has a title/body period discrepancy, preserved in the displayed source period; its B.A. listing has no assigned academic year. IIT Kanpur programme/admission claims remain held: only an independently scoped facilities-directory item is published. Decision-critical fees, thresholds, awards, accreditation validity, placement data, rankings and cutoffs remain unpublished pending appropriate evidence and genuine individual review. The existing six review-priority claims and 25-claim packet were not altered; the review database and 377 staged archive claims are unchanged.

Directly opened sources: [IIT Kanpur programmes](https://www.iitk.ac.in/doaa/academic-programmes), [IIT Kanpur facilities](https://www.iitk.ac.in/doaa/centres-and-facilities), [ISB PGP](https://admission.isb.edu/admissions/pgplp/), [St John's College Agra application instructions](https://sjcagra.ac.in/instructions-to-fill-application-form-online/), [NIT Srinagar Admissions 2026 index](https://erp.nitsri.ac.in/Pages/DisplayPages.aspx?page=caece). Remaining-page direct opens failed or presented a JavaScript shell for IIM Lucknow, Osmania, PSG, IIT Jodhpur, NIT Jamshedpur, NIT Raipur, NIT Puducherry, CUSAT, RTU, and other listed colleges; those pages were held. The OP Jindal source remained a Sonipat/Raigarh identity mismatch, Centurion programme mapping remained multi-campus ambiguous, ICT/IIIT Sri City were access-restricted, and St John's identity was confirmed as Agra (not the previously misidentified Bengaluru medical college). No search-result snippet was used as factual proof.

The six Batch 050 release items pass the existing deterministic eligibility path. Focused archive-row simulation confirmed all six survive suppression against archived staged claims; the held IIT Kanpur programme/admission entries remain absent. The local profile application displayed these records with the source-reported label, exact source links, scope and period text.

#### Batch 050 final verification

- `npx vitest run tests/unit/source-reported.test.ts --reporter=dot` — **PASS**, 21/21.
- `npm run lint` — **PASS**.
- `npm run typecheck` — **PASS**.
- `npx prisma validate && npx prisma generate` — **PASS**; no schema or migration change.
- `python3 scripts/check-release-secrets.py` — **PASS** after removing a historical dummy database URL literal from the Batch 049 build note.
- `git diff --check` and JSON parsing — **PASS**. The original 205 catalogue identities remain present, and the seed file SHA-256 remains `a9321b82b6f390790e09a647dfaf589b90c5736819aed6b9a5908922bfcc1637`.
- Host-side `npx next build --webpack` — **PASS**; Next.js production compilation and TypeScript checks completed and 49 static pages were generated. The command used the documented host-side build workflow because the sandbox's spawned TypeScript `--showConfig` stdout capture can be empty. Database environment values pointed to an intentionally unreachable loopback endpoint; the dynamic sitemap emitted its expected database-unavailable warning. No production or owner-review data was queried or modified by the build.
- `npx playwright test tests/e2e/source-reported.spec.ts --workers=1 --reporter=list` — **PASS**, 4/4 across desktop Chromium and Pixel 7 mobile (2 tests per project). The read-only browser suite checked all 205 profile routes on each viewport, rendered source facts/attribution, new Batch 050 values, held/verified-only boundaries and profile sections. No persistent review writes or synthetic decisions occurred.
- Screenshots: 222 PNG files in `/tmp/cf-b050-screens`, including `iit-kanpur-library-{desktop,mobile}.png`, `isb-pgp-admissions-{desktop,mobile}.png`, `st-johns-agra-ug-{desktop,mobile}.png`, and `nit-srinagar-mba-2026-{desktop,mobile}.png`. The ISB desktop capture visibly shows the 12-month programme, Class of 2027 application-cycle facts, source links and “Source-reported; not independently verified” labels.

No PostgreSQL integration suite was run for this batch: release projection is deterministic application data and this increment changed neither database behavior nor schema. Existing six high-impact owner-review claims remain staged for individual inspection; no persistent import, reviewer decision, migration or synthetic approval occurred. Staged archive count remains 377, genuine approvals remain 0 and verified official cutoffs remain 0. `CollegeFind_AGENTS_V3.md` remains unrelated and unstaged.

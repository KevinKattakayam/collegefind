# CollegeFind V3 upgrade status and evidence

Audit date: 2026-11-17. Audited local/remote main: `3ddf88d7f0dec224cde1984100e9208ce6285328`.
Phase 1 documentation delivered. Phase 2 is IN PROGRESS on branch `phase-2-safety-integrity`; Phase 3–9 NOT STARTED. No application feature is marked DONE by this document. Phase 2 remains incomplete.

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

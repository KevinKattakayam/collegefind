# Substantive research batch 028 — owner review packet

**State: RESEARCH ARTIFACT ONLY — not imported, not staged, not verified.** The artifact contains seven candidate facts from three of ten researched colleges. Candidate references below are array positions in `substantive-research-batch-028.json`, not database claim IDs. No reviewer activity or approvals were created.

## First review queue

| Order / candidate | College and scope | Proposed fact | Source and evidence | Year / status | Reviewer action |
|---|---|---|---|---|---|
| 1 / `candidateClaims[0]` | NIT Manipur, CSE department | B.Tech Computer Science and Engineering; four years (48 months) | [Official CSE department page](https://nitmanipur.ac.in/Deptindex.aspx?ItemID=ca&nDeptID=k&page=a), lines 43–48 | No academic year stated. Candidate is not imported. | Confirm that the programme remains active; page footer shows 2017 copyright while page contains newer text. Resolve source-use terms before persistence. If cleared/imported, it must enter STAGED/UNREVIEWED and remain unpublished until a reviewer approves. |
| 2 / `candidateClaims[1]` | NIT Manipur, CSE department | Integrated B.Tech–M.Tech Computer Science and Engineering; five years (60 months), start year 2026 | [Official CSE department page](https://nitmanipur.ac.in/Deptindex.aspx?ItemID=ca&nDeptID=k&page=a), lines 45–50 | Programme start year 2026; not an open-admission claim. | Confirm current programme availability, campus, and whether programme start year should be represented as its academic year. Resolve source-use terms. |
| 3 / `candidateClaims[5]` | University of Madras, University Departments / Politics and Public Administration | M.A. International Relations is listed in the programme table | [Official 2026–27 eligibility PDF](https://www.unom.ac.in/webportal/uploads/admissions/eligibility_condition_2026-27.pdf), item 15, lines 94–97 | AY 2026–27; historical cycle. Campus is not specified in the PDF. | Confirm department and campus scope. Do not generalize this University Departments programme to affiliated colleges. Resolve source-use terms. |
| 4 / `candidateClaims[6]` | University of Madras, University Departments / Politics and Public Administration | Eligibility: pass in B.A. Political Science or History, or another degree recognized by the University | Same official PDF, item 15, lines 94–97; [official CBCS admission page](https://egovernance.unom.ac.in/CBCS2627/), lines 6–11 and 24–28 | AY 2026–27; PG registration closed 1 June 2026. Historical only; do not label admissions open. | Verify exact wording/scope and source-use basis. Ensure closed-cycle status remains visible. |
| 5 / `candidateClaims[2]` | Jamia Millia Islamia, Faculty of Engineering and Technology | B.Tech Civil Engineering; eight semesters (48 months) | [Official University Prospectus 2026–27](https://admission.jmi.ac.in/application/assets/pdfFile/prospectus/UniversityProspectus/University_Prospectus_2026_2027.pdf), printed p. 20 / web lines 2177–2202 | AY 2026–27; cycle-specific. | **Hold:** JMI's [copyright policy](https://jmi.ac.in/Legal-document/Copyright-Policy), lines 348–351, requires due permission before reproducing content. Obtain owner/legal decision before staging. |
| 6 / `candidateClaims[3]` | Jamia Millia Islamia, Faculty of Engineering and Technology | B.Tech Computer Engineering; eight semesters (48 months) | Same official prospectus, printed p. 20 / web lines 2177–2202 | AY 2026–27; cycle-specific. | **Hold:** written permission or documented legal determination required before staging/public use. |
| 7 / `candidateClaims[4]` | Jamia Millia Islamia, B.Tech admissions | JEE (Main) 2026, JMI application form, selection based on final JEE Main rank under JMI merit/reservation policy | Same official prospectus, printed p. 22 / web lines 746–754 | AY 2026–27; historical cycle, not current application guidance. | **Hold:** written permission/legal decision; verify that any approved view labels the 2026 cycle historical. |

## Ten-college research selection and dispositions

Every selected record had **no substantive STAGED facts** at baseline. Its seed courses/fees/placement/accreditation entries remain `DEMO` and are not evidence. All ten still lack source-backed programme, admissions, eligibility, fees, hostel, scholarships, accreditation, and placement facts unless a candidate above is explicitly listed; no field completeness is claimed.

| College | Type / region | Research result |
|---|---|---|
| IIT Tirupati | Government / Andhra Pradesh | Official pages surfaced through search, but direct page extraction returned a shell. Search snippets were not used as facts. |
| NIT Manipur | Government / Northeast | Two programme candidates above; freshness and reuse review needed. |
| Madras University | Government / Tamil Nadu | Two programme/admission candidates above; AY 2026–27 registration is closed and campus is unspecified. |
| Jamia Millia Islamia | Government / Delhi | Three candidates above; explicit source copyright permission hold. |
| LNMIIT Jaipur | Private / Rajasthan | Official admission pages timed out; no search snippet used as claim evidence. |
| PSG College of Technology | Private / Tamil Nadu | Official enquiry page rendered template placeholders; no claim. |
| University of Mumbai | Government / Maharashtra | Official portal scope/campus relationship is ambiguous; no university-wide programme generalized. |
| King George's Medical University | Government / Uttar Pradesh | Official-domain result timed out through a nested URL; no retry/bypass and no fact. |
| St John's Medical College | Private / Karnataka | Official MBBS 2026 session notice confirms a completed cycle only; no current eligibility/admissions claim. |
| Banasthali Vidyapith | Private / Rajasthan | Official PhD notice was AY 2025–26 and direct page returned 502; no current-cycle claim. |

## Source-use and next actions

- **NIT Manipur:** official HTML was read manually. No explicit source-specific extraction/republication licence was found in this check; keep exact source links and concise facts only. A reviewer/owner must resolve whether retaining and publishing this factual record is permitted. The page's 2017 copyright footer requires freshness review.
- **Jamia Millia Islamia:** its official policy says site content may not be reproduced without due permission and requires source acknowledgement when referenced. Obtain written permission or documented legal approval before staging these candidates; no PDF/table is redistributed here.
- **University of Madras:** official PDF and portal are accessible, but no specific factual reuse licence was identified. The PDF/table is not reproduced; get a source-use decision before staging and keep 2026–27 admission information historical/closed.
- The existing `/admin/enrichment` UI remains the review surface, but these records are not visible there because no approved persistent non-production evidence destination was available. After source-use clearance and an approved persistent store are provided, dry-run/apply with `npm run ingest:official-facts -- --file data/pilot/substantive-research-batch-028.json`; apply remains subject to the repository's disposable-target guard. Then use an authorized human reviewer for each database claim.

## Evidence integrity

- 10 institutions researched; 7 source-backed candidates from 3 institutions.
- Database imports: 0. Database `FieldEvidence` IDs: 0. STAGED/VERIFIED decisions: 0/0.
- Importer dry-run accepted 7 candidates as `UNREVIEWED` and reported `databaseChanged: false`.
- Duplicate check against current per-college staged facts and prior batch manifests found no identical candidates. Persistent database uniqueness/idempotency was not exercised.
- Original catalogue remains 205 records with the baseline seed SHA-256 `a9321b82b6f390790e09a647dfaf589b90c5736819aed6b9a5908922bfcc1637`.

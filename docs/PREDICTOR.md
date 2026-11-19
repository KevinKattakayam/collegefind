# CollegeFit and admission guidance

## CollegeFit at `/collegefit`

City, state and institution type use catalogue identity. Programme and degree must match the same reviewed programme fact. Programme coverage is incomplete, so the absence of a match stays **Unknown**. An explicit difference in catalogue location or institution type is a **Mismatch**.

The tuition budget compares one reviewed annual tuition amount for the exact programme, published fee category and academic year. Multiple amounts, missing scope and other payment periods leave the result unknown. The budget excludes hostel and other charges. Published year and source appear beside each matching fact or price.

Each active criterion has weight one. Choosing a priority doubles the weight of its active criteria. Complete results are ordered by the share of active weight that matches, with name and canonical ID breaking ties. The interface shows reasons and source links without publishing numeric scores. Identity-only discovery and incomplete evidence have no fit ranking. Incomplete results remain available in a discovery list ordered by catalogue identity preferences and name.

For example, if a student's city matches and a programme claim is awaiting review, the city shows **Match**, the programme shows **Unknown**, and CollegeFit reports **Insufficient evidence for ranking**. Preferences are encoded in the page URL so a student can bookmark or revisit them. CollegeFit adds no account preference storage. Compare and shortlist actions use the existing account and guest workflows.

## Guidance at `/predictor`

- **Eligibility.** The college and programme context can show reviewed admission requirements with publisher, category, route and year. The app does not establish a student's eligibility. Check the official requirements for the intended cycle and seat scope.
- **Historical comparison.** Select an individual reviewed record in the cutoff explorer or college profile. The record retains the college, programme, exam, counselling authority, rank definition, quota, category, PwD flag, seat pool, year, round and source. Enter a rank from the same rank list to compare it with the published opening and closing numbers. The typed rank stays in the browser and is omitted from the URL. Missing opening values stay unavailable. Preparatory lists, score and percentile records, legacy unspecified dimensions and records without a current approval do not support this comparison.
- **Future admission.** Probability is unavailable. The public product does not compute a future estimate, admission band or confidence score.

With zero genuinely reviewed cutoff records, guidance shows **Insufficient Verified Evidence** and links to the explorer. Existing exam links still open the guidance page with an exam filter.

## API

`GET /api/predict?cutoff=<record-id>` returns a single reviewed observation from the same PostgreSQL evidence query used by the explorer. Responses have `eligibility: "NOT_CONFIRMED"`. A result has `status: "HISTORICAL_OBSERVATION"` and an `observation` object. Unavailable records return `status: "INSUFFICIENT_VERIFIED_EVIDENCE"` with `observation: null`. Missing or invalid record IDs return HTTP 400. Consumers of the retired forecast query must migrate to the record ID contract. Existing rate limiting remains in place.

## Synthetic fixture

The optional synthetic cutoff seed exists for disposable development and tests. It creates fictional demo institutes, which the reviewed cutoff query excludes. Automated tests can exercise approval with synthetic decisions in an isolated database. This does not establish genuine approval or public data coverage.

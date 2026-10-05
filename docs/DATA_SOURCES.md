# Data sources and ingestion

## Principle

Every number a student might act on carries a `Source` row: publisher, URL, licence and retrieval
date. If we do not have a source, the field stays **null** and the UI says "Not available". We do
not fill gaps with estimates.

## Sources

| Source | What it provides | URL | Licence / terms |
| --- | --- | --- | --- |
| JoSAA | Opening/closing ranks by institute, program, quota, seat type and gender for IITs, NITs, IIITs and GFTIs | https://josaa.nic.in | **Not verified.** No open licence found on the site. Check terms before republishing; attribute and link back |
| MCC | NEET UG All India Quota allotment results | https://mcc.nic.in | **Not verified.** Same caution |
| NIRF | Official national rankings and scores | https://www.nirfindia.org | **Not verified.** Published by the Ministry of Education |
| AISHE | Institution codes and official statistics | https://aishe.gov.in | Check whether the specific dataset is on data.gov.in under GODL-India |
| NAAC | Accreditation grades and validity | https://www.naac.gov.in | **Not verified** |
| NMC | Recognised medical colleges and sanctioned seats | https://www.nmc.org.in | **Not verified** |
| AICTE | Approved technical institutions | https://www.aicte.gov.in | **Not verified** |
| data.gov.in | Various government datasets | https://data.gov.in | Most datasets are under the **Government Open Data Licence – India (GODL)**, which permits commercial and non-commercial reuse **with attribution**. Confirm per dataset |

**Verify before you rely on this table.** Terms change, and several of these sites publish no
machine-readable licence at all. For each source, record in the `Source` row what you actually
found on the day you downloaded it. Where no licence is stated, prefer linking users to the
original page over republishing bulk data.

### How to confirm a source

1. Open the publisher's own domain (not an aggregator or a coaching site).
2. Find the exact page holding the table, and keep that URL — not a search result.
3. Look for "Terms of Use", "Copyright" or a licence statement; copy the wording into
   `Source.notes`.
4. Record `retrievedAt`. Cutoff pages are replaced each cycle.
5. Check `robots.txt` before any automated fetching, and prefer the official download link.

## Ingestion workflow

```bash
# 1. Export the JoSAA table for one year + round to CSV (keep the header row).
# 2. Map institute names to colleges.
cp data/institutes.example.csv data/institutes.csv   # then fill it in

# 3. Dry run — writes nothing.
npx tsx scripts/ingest-josaa.ts \
  --file data/josaa-2025-round6.csv --year 2025 --round 6 \
  --source-url "https://josaa.nic.in/<exact page>" \
  --institutes data/institutes.csv --dry-run

# 4. Read the report, fix the mapping, then run for real (omit --dry-run).
```

Expected CSV columns: `Institute, Academic Program Name, Quota, Seat Type, Gender, Opening Rank,
Closing Rank`. Header aliases are handled; unknown columns are ignored.

### Guarantees

- **Validation.** Rows with an unknown seat type, gender, quota or unparseable rank are rejected
  with a line number and never imported.
- **Preparatory ranks.** A `P` suffix sets `isPreparatory`, and those rows are excluded from
  predictions.
- **Sanity check.** An opening rank worse than its closing rank is rejected.
- **Deduplication.** Within a file, repeated natural keys collapse to the last occurrence.
- **Idempotency.** The unique key is `(program, exam, year, round, quota, category, isPwd,
  seatPool)`, so re-running a file updates rather than duplicates.
- **No guessing.** Unmatched institutes are reported and skipped; the importer never fuzzy-matches
  a college name.
- **Versioning.** Nothing is overwritten across years or rounds — each is its own row.

## Where real data is unavailable

- `dataStatus = DEMO` rows render a "Demo data" badge, label each figure "(demo)", and show an
  explicit warning on the detail page. A site-wide banner appears until
  `NEXT_PUBLIC_DATA_NOTICE=off`.
- Unknown values are `null` and display as "Not available" — never 0 and never an estimate.
- The estimator returns `hasData: false` and points to JoSAA/MCC rather than guessing.

## Legal and ethical notes

- **Scraping.** Respect `robots.txt` and rate limits; prefer official bulk downloads. Do not
  circumvent access controls.
- **Copyright.** Facts (a closing rank) are not copyrightable in themselves, but a compiled
  database can attract rights, and site terms may restrict reuse contractually. Attribute every
  source and link to the original.
- **Trademarks.** College names and logos belong to the institutions. Use names factually;
  do not imply endorsement.
- **Personal data.** Never ingest candidate-level data (names, roll numbers) from allotment
  files. Only aggregate cutoffs.
- **Stakes.** Students make irreversible, expensive decisions from these numbers. A wrong cutoff
  is worse than a missing one, which is why unverified data is labelled and estimates are hedged.
- **Corrections.** Every page shows "last updated"; provide a visible way to report an error.

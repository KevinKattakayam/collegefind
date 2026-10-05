# Admission chance estimator

## What it is

For each seat — a (program, quota, category, PwD flag, gender pool) combination — the estimator
models **next year's closing value** as a random variable fitted to recent published closing
values, then reports the probability that it lands no better than the student's rank or score.

It is a **transparent heuristic, not a calibrated statistical model.** Nothing in it is trained on
outcomes. Treat the probabilities as ordered guidance ("this is safer than that"), not as
precise likelihoods.

## Why ranks are modelled in log space

Year-to-year movement in closing ranks is roughly proportional, not absolute: a rank moving from
2,000 to 2,200 and from 50,000 to 55,000 are both ordinary 10% shifts, while "+2,000 ranks" means
very different things at the two ends. Working with `log(rank)` makes the spread comparable across
the range and keeps every predicted rank positive. Percentiles and scores are modelled linearly.

## Algorithm

1. **Select data.** For each seat, take the **last round of each year** (that is the value that
   actually closed) for up to 5 recent years. Preparatory-list ranks (JoSAA's `P` suffix) are
   excluded.
2. **Locate.** Weighted mean of the transformed values, each year weighted `0.5^(age in years)`,
   so last year counts twice as much as the year before.
3. **Trend.** With 3+ years, fit a weighted least-squares slope, clamp it (±0.15/yr in log space
   for ranks) and apply **half** of it. Short noisy series otherwise extrapolate absurdly.
4. **Spread.** Sample standard deviation, floored by how much data exists: one year 0.30,
   two years 0.20, otherwise 0.10 (log units). Less data means a wider interval, never a
   confident one.
5. **Probability.** `P(admit) = Φ((μ − log(rank)) / σ)` for ranks; the sign flips for
   percentiles and scores, where higher is better.
6. **Clamp.** Displayed probabilities are capped to 2%–97%: the model cannot see rule changes,
   seat-matrix changes or an unusual year, so it must never claim certainty.

| Band | Probability |
| --- | --- |
| Safe | ≥ 75% |
| Target | 40–75% |
| Reach | 15–40% |
| Unlikely | < 15% (hidden unless requested) |

Confidence is `HIGH` with 4+ years of data, `MEDIUM` with 2–3, `LOW` with 1.

## Which rank applies to which seat

This follows the rule printed on JoSAA's own opening/closing rank tables:

- **OPEN seats** use the **Common Rank List (CRL)**.
- **EWS, OBC-NCL, SC and ST seats** use the **category rank**.
- **PwD seats** use the **PwD rank within the candidate's category**.
- Female candidates are additionally eligible for **female-only (supernumerary)** seats.
- Home-state quota (`HS`) seats are offered only for colleges in the student's state; `OS` only
  outside it; `GO`, `JK` and `LA` only for those territories.

If a reserved-category student does not supply a category rank, reserved seats are **skipped**
and this is stated in the response — the estimator never substitutes CRL for a category rank.

## API contract

`GET /api/predict`

| Parameter | Type | Notes |
| --- | --- | --- |
| `exam` | enum | `JEE_MAIN`, `JEE_ADVANCED`, `NEET`, `CAT`, `GATE` (required) |
| `rank` | int | CRL / All India Rank; required for rank-based exams |
| `categoryRank`, `pwdRank` | int | Required to evaluate reserved and PwD seats |
| `score` | number | CAT percentile (0–100) or GATE score; required for those exams |
| `category` | enum | `OPEN`, `EWS`, `OBC_NCL`, `SC`, `ST` (default `OPEN`) |
| `isPwd` | bool | Default false |
| `gender` | enum | `FEMALE`, `MALE`, `OTHER`, `UNSPECIFIED` |
| `homeState`, `states`, `branches`, `maxFees`, `round`, `includeUnlikely`, `limit` | | Filters, applied in SQL |

Response:

```jsonc
{
  "meta": {
    "hasData": true,            // false ⇒ no cutoffs imported for this exam
    "latestDataYear": 2025,
    "targetYear": 2026,
    "assumptions": ["..."],     // shown to the user verbatim
    "method": "...",
    "disclaimer": "..."
  },
  "results": [{
    "program": {...}, "college": {...},
    "seat": { "quota": "AI", "category": "OPEN", "seatPool": "GENDER_NEUTRAL",
              "valueUsed": 12000, "valueLabel": "CRL / All India Rank" },
    "probability": 0.62, "band": "TARGET", "confidence": "MEDIUM",
    "estimate": { "expected": 5150, "low": 4500, "high": 5900, "targetYear": 2026 },
    "history": [{ "year": 2024, "round": 6, "closing": 4870, "source": {...} }],
    "explanation": "Past final-round closing rank for OPEN, …"
  }],
  "total": 42
}
```

Errors are `400` with per-field `details`.

## Query strategy

Two indexed queries, no table scan:

1. Find candidate `programId`s whose closing values are plausibly within reach
   (index: `exam, category, seatPool, year`).
2. Fetch the multi-year history for only those programs, then compute in memory.

## Calibration

`intervalCoverage()` in `src/lib/predictor/model.ts` backtests the 80% interval: predict a known
year from earlier years and measure how often the actual value falls inside. A well-calibrated
model scores ≈0.80. **Run this against real JoSAA data before making any accuracy claim.**
The current unit test only proves the machinery works on synthetic series.

## Known limitations

- Ignores seat-matrix changes, new institutes/branches and policy changes.
- Assumes next year resembles recent years; a syllabus or exam-pattern change breaks that.
- Single-year history produces a very wide interval shown as `LOW` confidence.
- No modelling of choice-filling order or multi-round movement within a counselling cycle.
- NEET state-quota rules vary by state and are not modelled.

## Synthetic fixture

`npm run db:seed:synthetic` creates **fictional** institutes with invented cutoffs so the feature
can be demonstrated and tested. Real college names are never attached to invented cutoffs. It
refuses to run with `NODE_ENV=production`.

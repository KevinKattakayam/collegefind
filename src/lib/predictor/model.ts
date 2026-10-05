/**
 * Pure admission-chance model. No database access, fully unit-tested.
 *
 * Idea: treat next year's closing value for one seat (program + quota +
 * category + gender pool) as a random variable estimated from recent years.
 *   - RANK (lower is better): modelled in log space, because year-to-year
 *     changes in closing ranks are roughly proportional (+10% at rank 2,000
 *     and at rank 50,000 are equally plausible; +2,000 ranks is not).
 *   - PERCENTILE / SCORE (higher is better): modelled in linear space.
 * The chance of admission is P(closing is no better than the student's value).
 *
 * This is a transparent heuristic, NOT a calibrated statistical model. Use
 * `intervalCoverage` with historical data to check calibration before
 * claiming accuracy (see docs/PREDICTOR.md).
 */

export type Metric = 'RANK' | 'PERCENTILE' | 'SCORE';
export type Band = 'SAFE' | 'TARGET' | 'REACH' | 'UNLIKELY';
export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Observation {
  year: number;
  closing: number;
}

export interface ClosingEstimate {
  /** Point estimate of the closing value for targetYear, in original units. */
  expected: number;
  /** 80% interval bounds, in original units (low <= high). */
  low: number;
  high: number;
  /** Internal location/scale (log space for RANK). */
  mu: number;
  sigma: number;
  yearsUsed: number;
  targetYear: number;
}

export const MODEL = {
  maxYears: 5,
  recencyDecay: 0.5, // weight of a year relative to the following year
  trendShare: 0.5, // fraction of the fitted linear trend that is trusted
  maxLogSlopePerYear: 0.15, // RANK: cap trend at ~16%/year
  maxPercentileSlopePerYear: 1.0,
  maxScoreRelSlopePerYear: 0.05,
  // Spread floors. With few years of data we cannot see real volatility,
  // so uncertainty is deliberately wide.
  rank: { floor: 0.1, oneYear: 0.3, twoYears: 0.2 }, // log space
  percentile: { floor: 0.5, oneYear: 2.0, twoYears: 1.2 }, // percentile points
  score: { floor: 0.03, oneYear: 0.08, twoYears: 0.05 }, // fraction of mean score
  interval80: 1.2815515655446004,
  bands: { safe: 0.75, target: 0.4, reach: 0.15 },
} as const;

/** Standard normal CDF via the Abramowitz–Stegun 7.1.26 erf approximation (|err| < 1.5e-7). */
export function normalCdf(z: number): number {
  if (!Number.isFinite(z)) return z > 0 ? 1 : 0;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly =
    t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

function toModelSpace(v: number, metric: Metric) {
  return metric === 'RANK' ? Math.log(v) : v;
}

function fromModelSpace(v: number, metric: Metric) {
  return metric === 'RANK' ? Math.exp(v) : v;
}

export function estimateClosing(
  observations: Observation[],
  metric: Metric,
  targetYear: number,
): ClosingEstimate | null {
  const byYear = new Map<number, number>();
  for (const o of observations) {
    if (!Number.isFinite(o.closing) || o.year >= targetYear) continue;
    if (metric === 'RANK' && o.closing <= 0) continue;
    byYear.set(o.year, o.closing); // one value per year; caller decides which round
  }
  const pts = [...byYear.entries()]
    .filter(([year]) => year >= targetYear - MODEL.maxYears)
    .sort((a, b) => a[0] - b[0])
    .map(([year, closing]) => ({ year, x: toModelSpace(closing, metric) }));
  const n = pts.length;
  if (n === 0) return null;

  const latestYear = pts[n - 1].year;
  const w = pts.map((p) => Math.pow(MODEL.recencyDecay, latestYear - p.year));
  const wSum = w.reduce((a, b) => a + b, 0);
  const meanX = pts.reduce((a, p, i) => a + w[i] * p.x, 0) / wSum;
  const meanYear = pts.reduce((a, p, i) => a + w[i] * p.year, 0) / wSum;

  let mu = meanX;
  if (n >= 3) {
    let sxy = 0;
    let sxx = 0;
    pts.forEach((p, i) => {
      sxy += w[i] * (p.year - meanYear) * (p.x - meanX);
      sxx += w[i] * (p.year - meanYear) ** 2;
    });
    let slope = sxx > 0 ? sxy / sxx : 0;
    const cap =
      metric === 'RANK'
        ? MODEL.maxLogSlopePerYear
        : metric === 'PERCENTILE'
          ? MODEL.maxPercentileSlopePerYear
          : MODEL.maxScoreRelSlopePerYear * Math.abs(meanX);
    slope = Math.max(-cap, Math.min(cap, slope));
    mu = meanX + MODEL.trendShare * slope * (targetYear - meanYear);
  }

  let spread = 0;
  if (n >= 2) {
    const plainMean = pts.reduce((a, p) => a + p.x, 0) / n;
    spread = Math.sqrt(pts.reduce((a, p) => a + (p.x - plainMean) ** 2, 0) / (n - 1));
  }

  let sigma: number;
  if (metric === 'RANK') {
    const c = MODEL.rank;
    sigma = n === 1 ? c.oneYear : Math.max(spread, n === 2 ? c.twoYears : c.floor);
  } else if (metric === 'PERCENTILE') {
    const c = MODEL.percentile;
    sigma = n === 1 ? c.oneYear : Math.max(spread, n === 2 ? c.twoYears : c.floor);
  } else {
    const c = MODEL.score;
    const scale = Math.max(1, Math.abs(meanX));
    sigma = n === 1 ? c.oneYear * scale : Math.max(spread, (n === 2 ? c.twoYears : c.floor) * scale);
  }

  const z = MODEL.interval80;
  let low = fromModelSpace(mu - z * sigma, metric);
  let high = fromModelSpace(mu + z * sigma, metric);
  if (metric === 'PERCENTILE') {
    low = Math.max(0, low);
    high = Math.min(100, high);
  }
  return {
    expected: fromModelSpace(mu, metric),
    low,
    high,
    mu,
    sigma,
    yearsUsed: n,
    targetYear,
  };
}

/** Probability that a student with `value` is admitted, given the estimate. */
export function admissionProbability(value: number, est: ClosingEstimate, metric: Metric): number {
  if (metric === 'RANK') {
    if (value <= 0) return 0;
    // Admitted if next closing rank >= student's rank.
    return normalCdf((est.mu - Math.log(value)) / est.sigma);
  }
  // Admitted if next closing percentile/score <= student's value.
  return normalCdf((value - est.mu) / est.sigma);
}

/** Displayed probabilities are clamped (see service.ts); bands use the clamped value. */
export function bandFor(p: number): Band {
  if (p >= MODEL.bands.safe) return 'SAFE';
  if (p >= MODEL.bands.target) return 'TARGET';
  if (p >= MODEL.bands.reach) return 'REACH';
  return 'UNLIKELY';
}

export function confidenceFor(yearsUsed: number): Confidence {
  if (yearsUsed >= 4) return 'HIGH';
  if (yearsUsed >= 2) return 'MEDIUM';
  return 'LOW';
}

/**
 * Backtest helper: for each case, predict `actual.year` from `history` and
 * report how often the actual closing value fell inside the 80% interval.
 * A well-calibrated model scores close to 0.80.
 */
export function intervalCoverage(
  cases: { history: Observation[]; actual: Observation }[],
  metric: Metric,
): { n: number; coverage: number } {
  let n = 0;
  let inside = 0;
  for (const c of cases) {
    const est = estimateClosing(c.history, metric, c.actual.year);
    if (!est) continue;
    n++;
    if (c.actual.closing >= est.low && c.actual.closing <= est.high) inside++;
  }
  return { n, coverage: n ? inside / n : 0 };
}

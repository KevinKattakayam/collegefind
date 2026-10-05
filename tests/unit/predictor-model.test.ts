import { describe, expect, it } from 'vitest';
import {
  MODEL,
  admissionProbability,
  bandFor,
  confidenceFor,
  estimateClosing,
  intervalCoverage,
  normalCdf,
} from '@/lib/predictor/model';

describe('normalCdf', () => {
  it('matches known values', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
    expect(normalCdf(Infinity)).toBe(1);
    expect(normalCdf(-Infinity)).toBe(0);
  });
});

describe('estimateClosing', () => {
  it('returns null without usable data', () => {
    expect(estimateClosing([], 'RANK', 2026)).toBeNull();
    expect(estimateClosing([{ year: 2025, closing: 0 }], 'RANK', 2026)).toBeNull();
    // Data from the target year or later is never used (no leakage in backtests).
    expect(estimateClosing([{ year: 2026, closing: 5000 }], 'RANK', 2026)).toBeNull();
  });

  it('uses a wide spread when only one year is known', () => {
    const e = estimateClosing([{ year: 2025, closing: 10000 }], 'RANK', 2026)!;
    expect(e.expected).toBeCloseTo(10000, 0);
    expect(e.sigma).toBe(MODEL.rank.oneYear);
    expect(e.low).toBeLessThan(10000);
    expect(e.high).toBeGreaterThan(10000);
  });

  it('weights recent years more than old ones', () => {
    const e = estimateClosing(
      [
        { year: 2024, closing: 8000 },
        { year: 2025, closing: 12000 },
      ],
      'RANK',
      2026,
    )!;
    // Recency-weighted geometric mean lies closer to 12000 than the plain mean (~9800).
    expect(e.expected).toBeGreaterThan(10000);
    expect(e.expected).toBeLessThan(12000);
  });

  it('caps runaway trends', () => {
    const e = estimateClosing(
      [
        { year: 2023, closing: 1000 },
        { year: 2024, closing: 5000 },
        { year: 2025, closing: 25000 },
      ],
      'RANK',
      2026,
    )!;
    // An uncapped log-linear extrapolation would predict ~125,000.
    expect(e.expected).toBeLessThan(40000);
  });

  it('ignores years outside the window', () => {
    const e = estimateClosing(
      [
        { year: 2010, closing: 999999 },
        { year: 2025, closing: 5000 },
      ],
      'RANK',
      2026,
    )!;
    expect(e.yearsUsed).toBe(1);
    expect(e.expected).toBeCloseTo(5000, 0);
  });

  it('keeps percentiles inside 0–100', () => {
    const e = estimateClosing([{ year: 2025, closing: 99.5 }], 'PERCENTILE', 2026)!;
    expect(e.high).toBeLessThanOrEqual(100);
    expect(e.low).toBeGreaterThanOrEqual(0);
  });
});

describe('admissionProbability', () => {
  const hist = [
    { year: 2023, closing: 9500 },
    { year: 2024, closing: 10000 },
    { year: 2025, closing: 10500 },
  ];
  const est = estimateClosing(hist, 'RANK', 2026)!;

  it('is monotonic: a better (lower) rank never has a lower chance', () => {
    const ranks = [1000, 5000, 9000, 10000, 11000, 15000, 50000];
    const ps = ranks.map((r) => admissionProbability(r, est, 'RANK'));
    for (let i = 1; i < ps.length; i++) expect(ps[i]).toBeLessThanOrEqual(ps[i - 1]);
    expect(ps[0]).toBeGreaterThan(0.99);
    expect(ps[ps.length - 1]).toBeLessThan(0.01);
  });

  it('is about 50% at the expected closing rank', () => {
    expect(admissionProbability(est.expected, est, 'RANK')).toBeCloseTo(0.5, 2);
  });

  it('treats percentiles as higher-is-better', () => {
    const p = estimateClosing([{ year: 2024, closing: 95 }, { year: 2025, closing: 96 }], 'PERCENTILE', 2026)!;
    expect(admissionProbability(99.5, p, 'PERCENTILE')).toBeGreaterThan(admissionProbability(90, p, 'PERCENTILE'));
  });
});

describe('bands and confidence', () => {
  it('maps probabilities to bands at documented thresholds', () => {
    expect(bandFor(0.9)).toBe('SAFE');
    expect(bandFor(0.75)).toBe('SAFE');
    expect(bandFor(0.5)).toBe('TARGET');
    expect(bandFor(0.2)).toBe('REACH');
    expect(bandFor(0.1)).toBe('UNLIKELY');
  });
  it('maps years of data to confidence', () => {
    expect(confidenceFor(1)).toBe('LOW');
    expect(confidenceFor(3)).toBe('MEDIUM');
    expect(confidenceFor(5)).toBe('HIGH');
  });
});

describe('intervalCoverage (backtest helper)', () => {
  it('covers stable series well', () => {
    const cases = Array.from({ length: 50 }, (_, i) => {
      const base = 2000 + i * 500;
      return {
        history: [2021, 2022, 2023, 2024].map((year, k) => ({ year, closing: base * (1 + 0.03 * Math.sin(i + k)) })),
        actual: { year: 2025, closing: base * (1 + 0.03 * Math.sin(i + 4)) },
      };
    });
    const r = intervalCoverage(cases, 'RANK');
    expect(r.n).toBe(50);
    expect(r.coverage).toBeGreaterThan(0.8);
  });
});

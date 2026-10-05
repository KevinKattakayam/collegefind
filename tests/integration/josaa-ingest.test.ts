import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  examForInstitute,
  importJosaaRows,
  parseGender,
  parseJosaaCsv,
  parseProgramName,
  parseRank,
  parseSeatType,
} from '@/server/ingest/josaa';
import { resetDb, testDb } from './db';

const db = testDb();

const CSV = `Institute,Academic Program Name,Quota,Seat Type,Gender,Opening Rank,Closing Rank
Test Institute of Technology,"Computer Science and Engineering (4 Years, Bachelor of Technology)",AI,OPEN,Gender-Neutral,"1,024","4,870"
Test Institute of Technology,"Computer Science and Engineering (4 Years, Bachelor of Technology)",AI,OBC-NCL,Gender-Neutral,2000,9000
Test Institute of Technology,"Computer Science and Engineering (4 Years, Bachelor of Technology)",AI,OPEN,Female-only (including Supernumerary),5000,12000
Test Institute of Technology,"Computer Science and Engineering (4 Years, Bachelor of Technology)",AI,SC (PwD),Gender-Neutral,100P,124P
Test Institute of Technology,"Civil Engineering (4 Years, Bachelor of Technology)",HS,OPEN,Gender-Neutral,,15000
Broken Row Institute,"Some Program",AI,UNKNOWN-TYPE,Gender-Neutral,1,2
Bad Rank Institute,"Some Program",AI,OPEN,Gender-Neutral,1,not-a-number
`;

const SOURCE = {
  name: 'JoSAA test',
  publisher: 'JoSAA',
  url: 'https://josaa.nic.in/test',
  retrievedAt: new Date('2025-08-01T00:00:00Z'),
};

const MAPPING = new Map([
  ['Test Institute of Technology', { josaaName: 'Test Institute of Technology', slug: 'test-institute', name: 'Test Institute of Technology', shortName: 'TIT', city: 'Testpur', state: 'Kerala', type: 'GOVERNMENT' as const }],
]);

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await db.$disconnect();
});

describe('JoSAA parsing', () => {
  it('parses seat types, including PwD variants', () => {
    expect(parseSeatType('OPEN')).toEqual({ category: 'OPEN', isPwd: false });
    expect(parseSeatType('OBC-NCL')).toEqual({ category: 'OBC_NCL', isPwd: false });
    expect(parseSeatType('SC (PwD)')).toEqual({ category: 'SC', isPwd: true });
    expect(parseSeatType('MYSTERY')).toBeNull();
  });

  it('parses gender pools and preparatory ranks', () => {
    expect(parseGender('Gender-Neutral')).toBe('GENDER_NEUTRAL');
    expect(parseGender('Female-only (including Supernumerary)')).toBe('FEMALE_ONLY');
    expect(parseRank('1,024')).toEqual({ value: 1024, isPreparatory: false });
    expect(parseRank('124P')).toEqual({ value: 124, isPreparatory: true });
    expect(parseRank('abc')).toBeNull();
  });

  it('splits program names into branch, degree and duration', () => {
    expect(parseProgramName('Computer Science and Engineering (4 Years, Bachelor of Technology)')).toEqual({
      branch: 'Computer Science and Engineering',
      degree: 'Bachelor of Technology',
      durationYears: 4,
    });
  });

  it('maps IITs to JEE Advanced and other institutes to JEE Main', () => {
    expect(examForInstitute('Indian Institute of Technology Bombay')).toBe('JEE_ADVANCED');
    expect(examForInstitute('Indian Institute of Information Technology Design & Manufacturing')).toBe('JEE_MAIN');
    expect(examForInstitute('National Institute of Technology Calicut')).toBe('JEE_MAIN');
  });

  it('rejects malformed rows with line numbers instead of importing them', () => {
    const { rows, rejected } = parseJosaaCsv(CSV);
    expect(rows).toHaveLength(5);
    expect(rejected).toHaveLength(2);
    expect(rejected[0]).toMatchObject({ line: 7 });
    expect(rejected.map((r) => r.reason).join(' ')).toMatch(/seat type|closing/i);
  });
});

describe('JoSAA import', () => {
  it('imports rows, links a source, and is idempotent on re-run', async () => {
    const { rows } = parseJosaaCsv(CSV);
    const first = await importJosaaRows(db, rows, { year: 2025, round: 6, source: SOURCE, institutes: MAPPING });
    expect(first.upserted).toBe(5);
    expect(first.unmatchedInstitutes.sort()).toEqual(['Bad Rank Institute', 'Broken Row Institute'].filter((n) => rows.some((r) => r.institute === n)));

    const after = await db.cutoffRecord.count();
    expect(after).toBe(5);

    // Re-running the same file must not duplicate rows.
    await importJosaaRows(db, rows, { year: 2025, round: 6, source: SOURCE, institutes: MAPPING });
    expect(await db.cutoffRecord.count()).toBe(5);

    const pwd = await db.cutoffRecord.findFirst({ where: { isPwd: true } });
    expect(pwd).toMatchObject({ category: 'SC', isPreparatory: true, closingValue: 124 });

    const open = await db.cutoffRecord.findFirst({ where: { category: 'OPEN', seatPool: 'GENDER_NEUTRAL', quota: 'AI' } });
    expect(open).toMatchObject({ openingValue: 1024, closingValue: 4870, exam: 'JEE_MAIN' });

    const withSource = await db.cutoffRecord.findFirst({ include: { source: true } });
    expect(withSource?.source.url).toBe(SOURCE.url);
  });

  it('dry run reports unmatched institutes without writing anything', async () => {
    const { rows } = parseJosaaCsv(CSV);
    const summary = await importJosaaRows(db, rows, { year: 2025, round: 6, source: SOURCE, institutes: new Map(), dryRun: true });
    expect(summary.unmatchedInstitutes).toContain('Test Institute of Technology');
    expect(await db.cutoffRecord.count()).toBe(0);
    expect(await db.source.count()).toBe(0);
  });
});

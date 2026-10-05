import { describe, expect, it } from 'vitest';
import {
  collegesQuerySchema,
  comparisonCreateSchema,
  predictQuerySchema,
  questionCreateSchema,
  registerSchema,
} from '@/lib/validation';

describe('registerSchema', () => {
  const base = { name: 'Asha', email: 'Asha@Example.COM ', password: 'correct horse battery' };

  it('normalises email to lowercase and trims', () => {
    expect(registerSchema.parse(base).email).toBe('asha@example.com');
  });
  it.each([
    ['too short', 'short1'],
    ['common', 'password123'],
    ['repetitive', 'aaaaaaaaaaaa'],
    ['over 72 bytes', 'é'.repeat(37)],
  ])('rejects a %s password', (_label, password) => {
    expect(registerSchema.safeParse({ ...base, password }).success).toBe(false);
  });
  it('rejects names containing angle brackets', () => {
    expect(registerSchema.safeParse({ ...base, name: '<script>' }).success).toBe(false);
  });
});

describe('collegesQuerySchema', () => {
  it('applies defaults', () => {
    expect(collegesQuerySchema.parse({})).toMatchObject({ page: 1, limit: 12, sort: 'name' });
  });
  it('rejects non-numeric fees instead of passing NaN to the database', () => {
    expect(collegesQuerySchema.safeParse({ minFees: 'abc' }).success).toBe(false);
    expect(collegesQuerySchema.safeParse({ page: 'abc' }).success).toBe(false);
  });
  it('rejects minFees greater than maxFees', () => {
    expect(collegesQuerySchema.safeParse({ minFees: '500000', maxFees: '100' }).success).toBe(false);
  });
  it('parses CSV lists and validates members', () => {
    expect(collegesQuerySchema.parse({ naac: 'A++,A' }).naac).toEqual(['A++', 'A']);
    expect(collegesQuerySchema.safeParse({ exams: 'JEE_MAIN,HACK' }).success).toBe(false);
  });
  it('caps page size', () => {
    expect(collegesQuerySchema.safeParse({ limit: '5000' }).success).toBe(false);
  });
});

describe('predictQuerySchema', () => {
  it('requires a rank for rank-based exams', () => {
    expect(predictQuerySchema.safeParse({ exam: 'JEE_MAIN' }).success).toBe(false);
  });
  it('requires a score for CAT and rejects percentiles above 100', () => {
    expect(predictQuerySchema.safeParse({ exam: 'CAT' }).success).toBe(false);
    expect(predictQuerySchema.safeParse({ exam: 'CAT', score: '150' }).success).toBe(false);
    expect(predictQuerySchema.safeParse({ exam: 'CAT', score: '98.2' }).success).toBe(true);
  });
  it('parses booleans and lists from query strings', () => {
    const p = predictQuerySchema.parse({ exam: 'NEET', rank: '1200', includeUnlikely: 'true', branches: 'Computer, Electrical' });
    expect(p.includeUnlikely).toBe(true);
    expect(p.branches).toEqual(['Computer', 'Electrical']);
  });
  it('requires a PwD rank when PwD is selected', () => {
    expect(predictQuerySchema.safeParse({ exam: 'JEE_MAIN', rank: '10', isPwd: 'true' }).success).toBe(false);
  });
});

describe('community text', () => {
  it('strips control characters and trims before length checks', () => {
    const r = questionCreateSchema.parse({ collegeId: 'abc123', text: '  Is the hostel\u0000 available?  ' });
    expect(r.text).toBe('Is the hostel available?');
  });
  it('rejects link spam', () => {
    const text = 'Visit https://a.example https://b.example https://c.example now';
    expect(questionCreateSchema.safeParse({ collegeId: 'abc123', text }).success).toBe(false);
  });
  it('rejects ids with unsafe characters', () => {
    expect(questionCreateSchema.safeParse({ collegeId: "x' OR 1=1", text: 'A valid question here' }).success).toBe(false);
  });
});

describe('comparisonCreateSchema', () => {
  it('requires 2–3 distinct colleges', () => {
    expect(comparisonCreateSchema.safeParse({ collegeIds: ['a'] }).success).toBe(false);
    expect(comparisonCreateSchema.safeParse({ collegeIds: ['a', 'a'] }).success).toBe(false);
    expect(comparisonCreateSchema.safeParse({ collegeIds: ['a', 'b', 'c', 'd'] }).success).toBe(false);
    expect(comparisonCreateSchema.safeParse({ collegeIds: ['a', 'b'] }).success).toBe(true);
  });
});

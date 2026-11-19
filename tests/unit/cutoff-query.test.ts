import { describe, expect, it } from 'vitest';
import { cutoffQuerySchema } from '@/server/cutoffs';

describe('cutoff explorer query validation', () => {
  it('supports a shareable full-dimension query and bounded page size', () => {
    expect(cutoffQuerySchema.parse({
      college: 'nit-trichy', program: 'Computer Science', counsellingSystem: 'JOSAA', exam: 'JEE_MAIN',
      rankType: 'CATEGORY', yearFrom: '2023', yearTo: '2025', category: 'OBC_NCL', quota: 'OS', seatPool: 'FEMALE_ONLY',
      round: '6', isPwd: 'true', metric: 'RANK', page: '2', pageSize: '50',
    })).toMatchObject({ college: 'nit-trichy', rankType: 'CATEGORY', yearFrom: 2023, yearTo: 2025, isPwd: true, page: 2, pageSize: 50 });
  });

  it('rejects oversized pages, bad dimensions, reversed ranges and mixed exact/range years', () => {
    expect(cutoffQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
    expect(cutoffQuerySchema.safeParse({ page: '10001' }).success).toBe(false);
    expect(cutoffQuerySchema.safeParse({ seatPool: 'ALL_SEATS' }).success).toBe(false);
    expect(cutoffQuerySchema.safeParse({ rankType: 'NIRF' }).success).toBe(false);
    expect(cutoffQuerySchema.safeParse({ yearFrom: '2025', yearTo: '2022' }).success).toBe(false);
    expect(cutoffQuerySchema.safeParse({ year: '2024', yearFrom: '2023' }).success).toBe(false);
  });
});

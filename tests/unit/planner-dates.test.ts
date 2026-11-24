import { describe, expect, it } from 'vitest';
import { localDateTimeToInstant } from '@/lib/planner-dates';

describe('personal planner timezone dates', () => {
  it('stores local date and time as the corresponding UTC instant', () => {
    expect(localDateTimeToInstant('2026-01-15', '09:30', 'Asia/Kolkata').toISOString()).toBe('2026-01-15T04:00:00.000Z');
  });
  it('rejects invalid calendar dates, unknown zones and DST gaps', () => {
    expect(() => localDateTimeToInstant('2026-02-30', null, 'Asia/Kolkata')).toThrow();
    expect(() => localDateTimeToInstant('2026-01-15', '09:30', 'Mars/Olympus')).toThrow();
    expect(() => localDateTimeToInstant('2026-03-08', '02:30', 'America/New_York')).toThrow(/does not exist/);
  });
  it('resolves an ambiguous DST fall-back time to its first occurrence', () => {
    expect(localDateTimeToInstant('2026-11-01', '01:30', 'America/New_York').toISOString()).toBe('2026-11-01T05:30:00.000Z');
  });
  it('uses the end of the selected local day when time is omitted', () => {
    expect(localDateTimeToInstant('2026-01-15', null, 'Asia/Kolkata').toISOString()).toBe('2026-01-15T18:29:59.999Z');
  });
});

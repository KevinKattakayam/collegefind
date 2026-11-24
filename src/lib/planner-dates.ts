/** Converts a local calendar date/time in an IANA zone to an instant without
 * relying on the server's timezone. Nonexistent DST wall times are rejected;
 * an ambiguous fall-back time resolves to its first occurrence. */
export function localDateTimeToInstant(date: string, time: string | null, timeZone: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Enter a valid calendar date');
  const [year, month, day] = date.split('-').map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) throw new Error('Enter a valid calendar date');
  const chosenTime = time ?? '23:59';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(chosenTime)) throw new Error('Enter a valid local time');
  try { new Intl.DateTimeFormat('en', { timeZone }).format(new Date()); } catch { throw new Error('Select a valid timezone'); }
  const [hour, minute] = chosenTime.split(':').map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute, time ? 0 : 59, time ? 0 : 999);
  const format = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const parts = (instant: number) => Object.fromEntries(format.formatToParts(new Date(instant)).map(p => [p.type, p.value]));
  const offsets = new Set<number>();
  for (const delta of [-36, -12, 0, 12, 36]) {
    const sample = target + delta * 60 * 60 * 1000;
    const p = parts(sample);
    const localAsUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
    offsets.add(localAsUtc - Math.floor(sample / 1000) * 1000);
  }
  const candidates = [...offsets].map(offset => target - offset).filter(instant => {
    const p = parts(instant);
    return Number(p.year) === year && Number(p.month) === month && Number(p.day) === day && Number(p.hour) === hour && Number(p.minute) === minute;
  }).sort((a, b) => a - b);
  if (!candidates.length) throw new Error('That local time does not exist because of a timezone clock change');
  return new Date(candidates[0]);
}

export function deadlineDateFromStored(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}

export function deadlineTimeFromStored(instant: Date, timeZone: string): string | null {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant);
  const hour = parts.find(part => part.type === 'hour')?.value;
  const minute = parts.find(part => part.type === 'minute')?.value;
  if (hour === '23' && minute === '59' && instant.getUTCMilliseconds() === 999) return null;
  return hour && minute ? `${hour}:${minute}` : null;
}

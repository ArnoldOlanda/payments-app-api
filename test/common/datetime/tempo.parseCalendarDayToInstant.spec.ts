import {
  dayStart,
  dayEnd,
  parseCalendarDayToInstant,
} from 'src/common/datetime/tempo';

describe('parseCalendarDayToInstant (TZ-aware)', () => {
  it('returns 00:00:00.000 in Asia/Tokyo for 2026-07-25', () => {
    const result = parseCalendarDayToInstant(
      '2026-07-25',
      'Asia/Tokyo',
      'start',
    );
    // 2026-07-25T00:00 JST == 2026-07-24T15:00:00Z
    expect(result.toISOString()).toBe('2026-07-24T15:00:00.000Z');
    // Sanity check: matches the wrapper's dayStart for noon-of-that-day.
    const noon = new Date(Date.UTC(2026, 6, 25, 12, 0, 0));
    expect(result.toISOString()).toBe(
      dayStart(noon, 'Asia/Tokyo').toISOString(),
    );
  });

  it('returns 23:59:59.999 in America/Argentina/Buenos_Aires for 2026-07-25', () => {
    const result = parseCalendarDayToInstant(
      '2026-07-25',
      'America/Argentina/Buenos_Aires',
      'end',
    );
    // 2026-07-25T23:59:59.999 ART (UTC-3) == 2026-07-26T02:59:59.999Z
    expect(result.toISOString()).toBe('2026-07-26T02:59:59.999Z');
    const noon = new Date(Date.UTC(2026, 6, 25, 12, 0, 0));
    expect(result.toISOString()).toBe(
      dayEnd(noon, 'America/Argentina/Buenos_Aires').toISOString(),
    );
  });

  it('end and start are 24 hours − 1 ms apart for the same calendar day', () => {
    const start = parseCalendarDayToInstant('2026-07-25', 'UTC', 'start');
    const end = parseCalendarDayToInstant('2026-07-25', 'UTC', 'end');
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
  });

  it('throws when the value is not YYYY-MM-DD', () => {
    expect(() =>
      parseCalendarDayToInstant('25/07/2026', 'UTC', 'start'),
    ).toThrow();
    expect(() =>
      parseCalendarDayToInstant('2026-7-25', 'UTC', 'start'),
    ).toThrow();
    expect(() =>
      parseCalendarDayToInstant('2026-07-25T00:00:00Z', 'UTC', 'start'),
    ).toThrow();
  });
});

import {
  dayStart,
  dayEnd,
  weekStart,
  weekEnd,
  format,
} from 'src/common/datetime/tempo';

describe('tempo wrapper (TZ-aware)', () => {
  describe('dayStart', () => {
    it('returns midnight in Asia/Tokyo for a UTC instant that is already JST midnight', () => {
      // 2025-06-15T15:00:00Z == 2025-06-16T00:00 JST.
      // The "day" in Tokyo is 2025-06-16, so dayStart must equal the input.
      const now = new Date('2025-06-15T15:00:00Z');
      expect(dayStart(now, 'Asia/Tokyo').toISOString()).toBe(
        '2025-06-15T15:00:00.000Z',
      );
    });

    it('returns midnight in America/Argentina/Buenos_Aires (UTC-3, no DST)', () => {
      // 2025-07-15T12:00:00Z == 2025-07-15T09:00 ART.
      // The "day" in BA is 2025-07-15, so dayStart == 2025-07-15T03:00:00Z.
      const now = new Date('2025-07-15T12:00:00Z');
      expect(
        dayStart(now, 'America/Argentina/Buenos_Aires').toISOString(),
      ).toBe('2025-07-15T03:00:00.000Z');
    });

    it('returns the previous calendar day in tz when UTC instant is early morning UTC but late previous day in tz', () => {
      // 2025-06-16T02:00:00Z == 2025-06-15T23:00 ART. The "day" in BA is 2025-06-15.
      const now = new Date('2025-06-16T02:00:00Z');
      expect(
        dayStart(now, 'America/Argentina/Buenos_Aires').toISOString(),
      ).toBe('2025-06-15T03:00:00.000Z');
    });

    it('handles DST transition correctly (America/Los_Angeles, post-spring-forward)', () => {
      // 2025-03-09T12:00:00Z == 2025-03-09T05:00 PDT (already after spring-forward at 02:00 PST -> 03:00 PDT).
      // Day in LA is 2025-03-09, midnight PDT == 2025-03-09T07:00:00Z.
      const now = new Date('2025-03-09T12:00:00Z');
      expect(dayStart(now, 'America/Los_Angeles').toISOString()).toBe(
        '2025-03-09T07:00:00.000Z',
      );
    });
  });

  describe('dayEnd', () => {
    it('returns 23:59:59.999 in Asia/Tokyo', () => {
      // 2025-06-15T15:00:00Z == 2025-06-16 in Tokyo.
      // dayEnd in Tokyo == 2025-06-16T23:59:59.999 JST == 2025-06-16T14:59:59.999Z.
      const now = new Date('2025-06-15T15:00:00Z');
      expect(dayEnd(now, 'Asia/Tokyo').toISOString()).toBe(
        '2025-06-16T14:59:59.999Z',
      );
    });
  });

  describe('weekStart', () => {
    it('returns Monday in America/Argentina/Buenos_Aires (startOfWeekDay=1)', () => {
      // 2025-06-18T12:00:00Z == Wed 2025-06-18 09:00 ART.
      // Monday of that week = 2025-06-16 00:00 ART == 2025-06-16T03:00:00Z.
      const now = new Date('2025-06-18T12:00:00Z');
      expect(
        weekStart(now, 1, 'America/Argentina/Buenos_Aires').toISOString(),
      ).toBe('2025-06-16T03:00:00.000Z');
    });

    it('returns Sunday in America/Argentina/Buenos_Aires (startOfWeekDay=0)', () => {
      // Same instant; with startOfWeekDay=0 the week starts on Sunday.
      // Sun of that week (containing Wed Jun 18) = 2025-06-15 00:00 ART.
      const now = new Date('2025-06-18T12:00:00Z');
      expect(
        weekStart(now, 0, 'America/Argentina/Buenos_Aires').toISOString(),
      ).toBe('2025-06-15T03:00:00.000Z');
    });

    it('handles month wrap (early Sunday → Monday in previous month)', () => {
      // 2025-11-02T12:00:00Z == Sun 2025-11-02 09:00 ART.
      // Monday on or before that Sunday = 2025-10-27 00:00 ART == 2025-10-27T03:00:00Z.
      // Forces the algorithm to wrap into the previous month (targetDay = -4).
      const now = new Date('2025-11-02T12:00:00Z');
      expect(
        weekStart(now, 1, 'America/Argentina/Buenos_Aires').toISOString(),
      ).toBe('2025-10-27T03:00:00.000Z');
    });

    it('handles year wrap (early January → Monday of previous year)', () => {
      // 2026-01-04T12:00:00Z == Sun 2026-01-04 09:00 ART.
      // Monday of that week = 2025-12-29 00:00 ART == 2025-12-29T03:00:00Z.
      const now = new Date('2026-01-04T12:00:00Z');
      expect(
        weekStart(now, 1, 'America/Argentina/Buenos_Aires').toISOString(),
      ).toBe('2025-12-29T03:00:00.000Z');
    });
  });

  describe('weekEnd', () => {
    it('returns the last millisecond of the week (weekStart + 7 days − 1 ms)', () => {
      // Same instant as the BA Monday test.
      const now = new Date('2025-06-18T12:00:00Z');
      // 7 days - 1 ms later = Sun 2025-06-22 23:59:59.999 ART == 2025-06-23T02:59:59.999Z.
      expect(
        weekEnd(now, 1, 'America/Argentina/Buenos_Aires').toISOString(),
      ).toBe('2025-06-23T02:59:59.999Z');
    });
  });

  describe('format', () => {
    it('renders the date in the target timezone', () => {
      const d = new Date('2025-06-15T15:00:00Z');
      expect(format(d, 'YYYY-MM-DD HH:mm', 'Asia/Tokyo')).toBe(
        '2025-06-16 00:00',
      );
    });

    it('renders the date in America/Argentina/Buenos_Aires', () => {
      const d = new Date('2025-07-15T12:00:00Z');
      expect(
        format(d, 'YYYY-MM-DD HH:mm', 'America/Argentina/Buenos_Aires'),
      ).toBe('2025-07-15 09:00');
    });
  });
});

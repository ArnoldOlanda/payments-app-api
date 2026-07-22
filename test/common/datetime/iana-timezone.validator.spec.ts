import { BadRequestException } from '@nestjs/common';
import { assertIanaTimezone } from 'src/common/datetime/iana-timezone.validator';

describe('assertIanaTimezone()', () => {
  describe('accepts valid IANA identifiers', () => {
    it('accepts "America/Argentina/Buenos_Aires"', () => {
      expect(() =>
        assertIanaTimezone('America/Argentina/Buenos_Aires'),
      ).not.toThrow();
    });

    it('accepts "UTC"', () => {
      expect(() => assertIanaTimezone('UTC')).not.toThrow();
    });

    it('accepts "Asia/Tokyo"', () => {
      expect(() => assertIanaTimezone('Asia/Tokyo')).not.toThrow();
    });

    it('accepts "Europe/Madrid"', () => {
      expect(() => assertIanaTimezone('Europe/Madrid')).not.toThrow();
    });
  });

  describe('rejects invalid identifiers', () => {
    it('rejects "Mars/Olympus_Mons" with BadRequestException', () => {
      expect(() => assertIanaTimezone('Mars/Olympus_Mons')).toThrow(
        BadRequestException,
      );
    });

    it('rejects "UTC+3" (offset syntax, not IANA)', () => {
      expect(() => assertIanaTimezone('UTC+3')).toThrow(BadRequestException);
    });

    it('rejects "+05:30" (offset syntax, not IANA)', () => {
      expect(() => assertIanaTimezone('+05:30')).toThrow(BadRequestException);
    });

    it('rejects empty string', () => {
      expect(() => assertIanaTimezone('')).toThrow(BadRequestException);
    });

    it('rejects whitespace-only string', () => {
      expect(() => assertIanaTimezone('   ')).toThrow(BadRequestException);
    });

    it('rejects strings longer than 64 characters', () => {
      const tooLong = 'A'.repeat(65);
      expect(() => assertIanaTimezone(tooLong)).toThrow(BadRequestException);
    });

    it('rejects non-string values', () => {
      expect(() => assertIanaTimezone(null as unknown as string)).toThrow(
        BadRequestException,
      );
      expect(() => assertIanaTimezone(undefined as unknown as string)).toThrow(
        BadRequestException,
      );
      expect(() => assertIanaTimezone(123 as unknown as string)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('error message', () => {
    it('includes the offending value in the message', () => {
      try {
        assertIanaTimezone('Mars/Olympus_Mons');
        fail('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        const msg = (err as BadRequestException).message;
        expect(msg).toContain('Mars/Olympus_Mons');
      }
    });
  });
});

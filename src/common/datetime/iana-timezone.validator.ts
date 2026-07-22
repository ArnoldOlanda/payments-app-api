import { BadRequestException } from '@nestjs/common';

const MAX_TIMEZONE_LENGTH = 64;

/**
 * Validate that `tz` is an IANA timezone identifier.
 *
 * IANA identifiers look like "America/Argentina/Buenos_Aires", "Asia/Tokyo", "UTC".
 * Offset syntax ("UTC+3", "+05:30") is rejected on purpose — the project stores
 * IANA identifiers exclusively so we can rely on the live tz database for DST.
 *
 * Throws BadRequestException on any failure. The message always includes the
 * offending value so the client can debug.
 */
export function assertIanaTimezone(tz: unknown): asserts tz is string {
  if (typeof tz !== 'string') {
    throw new BadRequestException(`Invalid IANA timezone: ${String(tz)}`);
  }
  if (tz.trim().length === 0) {
    throw new BadRequestException(`Invalid IANA timezone: ${tz}`);
  }
  if (tz.length > MAX_TIMEZONE_LENGTH) {
    throw new BadRequestException(`Invalid IANA timezone: ${tz}`);
  }
  try {
    // Throws RangeError if `tz` is not a known IANA identifier.
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    throw new BadRequestException(`Invalid IANA timezone: ${tz}`);
  }
}

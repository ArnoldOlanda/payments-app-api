import { format as tempoFormat } from '@formkit/tempo';

/**
 * TZ-aware wrappers over @formkit/tempo + Intl primitives.
 *
 * Why this exists: @formkit/tempo v0.1.2 does NOT accept a TZ option on
 * dayStart/dayEnd/weekStart/weekEnd. Only `format` accepts it. This wrapper
 * fills the gap using Intl.DateTimeFormat directly so that every consumer
 * gets TZ-correct boundaries with one consistent signature.
 *
 * Contract: every function takes `tz` as its LAST argument. Callers cannot
 * forget the TZ — TypeScript enforces it.
 */

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

interface PartsInTz {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');
const pad4 = (n: number): string => String(n).padStart(4, '0');

/**
 * Extract every part of `d` AS OBSERVED IN `tz`. Robust across DST.
 */
function partsInTz(d: Date, tz: string): PartsInTz {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).map((p) => [p.type, p.value]),
  );
  // Some V8 versions emit "24" for midnight under hour12:false; normalize to 0.
  const rawHour = parts.hour;
  const hour = rawHour === '24' ? 0 : parseInt(rawHour, 10);
  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hour,
    minute: parseInt(parts.minute, 10),
    second: parseInt(parts.second, 10),
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
  };
}

/**
 * Returns the IANA offset string (e.g. "+09:00" or "-03:00") for noon on the
 * given calendar day in the given tz. Using noon avoids the DST-transition
 * ambiguity at midnight (spring-forward / fall-back).
 */
function offsetInTzAtNoon(
  tz: string,
  year: number,
  month: number,
  day: number,
): string {
  const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'longOffset',
    year: 'numeric',
  });
  const parts = fmt.formatToParts(probe);
  const tzName = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const offset = tzName.replace(/^GMT/, '');
  return offset || '+00:00';
}

/**
 * Compose an ISO string with explicit TZ offset and parse it as a UTC instant.
 * Format: "YYYY-MM-DDTHH:mm:ss[.SSS]±HH:MM".
 */
function instantInTz(
  year: number,
  month: number,
  day: number,
  hh: string,
  mm: string,
  ss: string,
  ms: string,
  tz: string,
): Date {
  const offset = offsetInTzAtNoon(tz, year, month, day);
  const iso = `${pad4(year)}-${pad2(month)}-${pad2(day)}T${hh}:${mm}:${ss}.${ms}${offset}`;
  return new Date(iso);
}

/**
 * Start of the day containing `d`, in `tz`. Returns a UTC Date.
 */
export function dayStart(d: Date, tz: string): Date {
  const p = partsInTz(d, tz);
  return instantInTz(p.year, p.month, p.day, '00', '00', '00', '000', tz);
}

/**
 * End of the day containing `d`, in `tz`. Returns a UTC Date at 23:59:59.999.
 */
export function dayEnd(d: Date, tz: string): Date {
  const p = partsInTz(d, tz);
  return instantInTz(p.year, p.month, p.day, '23', '59', '59', '999', tz);
}

/**
 * Start of the week containing `d`, in `tz`. `startOfWeekDay` is 0=Sun..6=Sat.
 * The week starts on the most recent occurrence of `startOfWeekDay` on or
 * before `d` as observed in `tz`. Handles month and year wrap.
 */
export function weekStart(d: Date, startOfWeekDay: number, tz: string): Date {
  const p = partsInTz(d, tz);
  const daysBack = (p.weekday - startOfWeekDay + 7) % 7;
  // Use UTC date math to compute the target calendar date. Negative days
  // naturally wrap to the previous month/year.
  const candidate = new Date(Date.UTC(p.year, p.month - 1, p.day - daysBack));
  const year = candidate.getUTCFullYear();
  const month = candidate.getUTCMonth() + 1;
  const day = candidate.getUTCDate();
  return instantInTz(year, month, day, '00', '00', '00', '000', tz);
}

/**
 * End of the week containing `d`, in `tz`. Defined as weekStart + 7 days − 1 ms.
 */
export function weekEnd(d: Date, startOfWeekDay: number, tz: string): Date {
  const start = weekStart(d, startOfWeekDay, tz);
  return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
}

/**
 * Format a date in `tz` using @formkit/tempo's token syntax.
 * Token reference: https://tempo.formkit.com — YYYY MM DD HH mm ss etc.
 */
export function format(d: Date, fmt: string, tz: string): string {
  return tempoFormat({ date: d, format: fmt, tz });
}

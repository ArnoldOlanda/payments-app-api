/**
 * Pure helpers for the weekly collections PDF.
 *
 * No I/O, no time-of-day side effects, no module state. Used by the
 * template and the controller (for the Content-Disposition filename).
 */

/**
 * Sanitize a free-form string into a filename-safe slug.
 *
 * Rules:
 * - Lowercase the entire input.
 * - Replace every run of characters outside `[a-z0-9-]` with a single `-`.
 * - Trim leading and trailing `-` characters.
 * - Reject the result if it still contains `..` or `/` (defense in depth;
 *   the regex should already strip them, but we double-check).
 *
 * The empty string is a valid output for an input that was entirely unsafe.
 */
export function sanitizeFilenameSlug(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.includes('..') || slug.includes('/')) {
    throw new Error(
      `sanitizeFilenameSlug: produced unsafe slug "${slug}" from "${input}"`,
    );
  }

  return slug;
}

/**
 * Format a numeric amount in Peruvian soles with two decimal places and the
 * `S/` prefix. Uses the es-PE locale so the thousands separator is `,`.
 */
export function formatPEN(amount: number): string {
  return `S/ ${amount.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

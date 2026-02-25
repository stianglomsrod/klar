/**
 * Time formatting utility.
 * Postgres TIME columns cast to TEXT produce "HH:MM:SS".
 * This helper trims to "HH:MM" for user-facing display.
 */

/**
 * Trim a time string to HH:MM (removes seconds if present).
 * Accepts "10:10:00" → "10:10", or "10:10" → "10:10" (safe for already-trimmed strings).
 */
export function formatTime(timeString: string): string {
  if (!timeString) return "";
  return timeString.slice(0, 5);
}

/**
 * ISO 8601 week number calculation.
 * Reusable across the student dashboard, timeplan page, and any schedule-related view.
 */

/**
 * Get the ISO 8601 week number for a given date.
 * Week 1 is the week containing the first Thursday of the year.
 */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Get the JS day-of-week as ISO day number (Monday=1 .. Sunday=7).
 * JavaScript's `Date.getDay()` returns 0 for Sunday — this converts to ISO.
 */
export function getISODayOfWeek(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

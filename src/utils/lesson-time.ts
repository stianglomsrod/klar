/**
 * Lesson-time helpers for determining lesson state and progress.
 * Pure functions — pass `now` explicitly so callers control the time source
 * (e.g. a reactive `currentTime` state vs. a one-shot `new Date()`).
 */

/* ── Types ─────────────────────────────────────────────── */

export type LessonState = "upcoming" | "active" | "finished";

/* ── Helpers ───────────────────────────────────────────── */

/**
 * Determine if a lesson is upcoming, active, or finished.
 *
 * @param startTime  "HH:MM" or "HH:MM:SS"
 * @param endTime    "HH:MM" or "HH:MM:SS"
 * @param now        The reference point in time (today).
 */
export function getLessonState(
  startTime: string,
  endTime: string,
  now: Date,
): LessonState {
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);

  const startDate = new Date(now);
  startDate.setHours(startHour, startMin, 0, 0);

  const endDate = new Date(now);
  endDate.setHours(endHour, endMin, 0, 0);

  if (now < startDate) return "upcoming";
  if (now >= startDate && now < endDate) return "active";
  return "finished";
}

/**
 * Return lesson progress as a percentage (0–100).
 *
 * @param startTime  "HH:MM" or "HH:MM:SS"
 * @param endTime    "HH:MM" or "HH:MM:SS"
 * @param now        The reference point in time (today).
 */
export function getLessonProgressPercent(
  startTime: string,
  endTime: string,
  now: Date,
): number {
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);

  const startDate = new Date(now);
  startDate.setHours(startHour, startMin, 0, 0);

  const endDate = new Date(now);
  endDate.setHours(endHour, endMin, 0, 0);

  const total = endDate.getTime() - startDate.getTime();
  if (total <= 0) return 0;

  const elapsed = now.getTime() - startDate.getTime();
  return Math.max(0, Math.min(100, (elapsed / total) * 100));
}

/**
 * Shared constants used across the application.
 * Single source of truth for weekday definitions and default values.
 */

/* ── Weekdays ──────────────────────────────────────────── */

/** Canonical weekday list (ISO numbering: Monday = 1 … Friday = 5). */
export const WEEKDAYS = [
  { number: 1, label: "Mandag" },
  { number: 2, label: "Tirsdag" },
  { number: 3, label: "Onsdag" },
  { number: 4, label: "Torsdag" },
  { number: 5, label: "Fredag" },
] as const;

/** Weekday options shaped for <select> / <option> elements (`value` + `label`). */
export const WEEKDAY_OPTIONS = WEEKDAYS.map((d) => ({
  value: d.number,
  label: d.label,
}));

/* ── Petal / Flower defaults ───────────────────────────── */

/**
 * Default (unfilled) petal colour — matches the Supabase column default.
 * Gray signals "not yet earned"; coloured petals are chosen by the student.
 */
export const DEFAULT_PETAL_COLOR = "#E0E0E0";

/** Convenience: a full set of five default petals. */
export const DEFAULT_PETAL_COLORS = Array.from(
  { length: 5 },
  () => DEFAULT_PETAL_COLOR,
);

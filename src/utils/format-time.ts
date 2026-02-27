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

/**
 * Human-friendly relative timestamp in Norwegian Bokmål.
 * Returns e.g. "akkurat nå", "3 min siden", "2 timer siden", "i går", or a short date.
 */
export function timeAgo(dateStr: string): string {
  if (!dateStr || isNaN(new Date(dateStr).getTime())) return "Nylig";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "akkurat nå";
  if (mins < 60) return `${mins} min siden`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ${hrs === 1 ? "time" : "timer"} siden`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} ${days === 1 ? "dag" : "dager"} siden`;
  return new Date(dateStr).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
  });
}

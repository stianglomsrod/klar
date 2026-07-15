/**
 * Shared normalization utilities for class names and subject names.
 * Used by both save-weekly-plan.ts (Ukebrev) and save-lesson-plan.ts (Ukeplanlegger).
 */

// ── Class Normalization ──────────────────────────────

/** Strips whitespace, dots, dashes → uppercase. "7 a" / "7-A" / "7.a" → "7A" */
export const normalizeClassName = (name: string) =>
  name.replace(/[^a-zA-Z0-9æøåÆØÅ]/g, "").toUpperCase();

/**
 * Detect if a normalized class name is a grade-level target (e.g., "6TRINN", "6").
 * Returns the grade number as a string if detected, or null otherwise.
 */
export function extractGradeNumber(normalizedName: string): string | null {
  // "6TRINN", "7TRINN" etc.
  const trinnMatch = normalizedName.match(/^(\d{1,2})TRINN$/);
  if (trinnMatch) return trinnMatch[1];
  // Bare digit — "6", "7" (only 1-2 digit numbers, no letters)
  if (/^\d{1,2}$/.test(normalizedName)) return normalizedName;
  return null;
}

// ── Subject Normalization & Splitting ────────────────

/** Dictionary mapping common Norwegian abbreviations → canonical subject name */
export const SUBJECT_ALIASES: Record<string, string> = {
  matte: "Matematikk",
  mat: "Matematikk",
  matematikk: "Matematikk",
  "k&h": "Kunst og håndverk",
  kogh: "Kunst og håndverk",
  "k og h": "Kunst og håndverk",
  "kunst og håndverk": "Kunst og håndverk",
  samf: "Samfunnsfag",
  "samf.fag": "Samfunnsfag",
  "samf. fag": "Samfunnsfag",
  samfunnsfag: "Samfunnsfag",
  nat: "Naturfag",
  "nat.fag": "Naturfag",
  "nat. fag": "Naturfag",
  naturfag: "Naturfag",
  gym: "Kroppsøving",
  kropps: "Kroppsøving",
  kroppsøving: "Kroppsøving",
  eng: "Engelsk",
  engelsk: "Engelsk",
  bib: "Bibliotek",
  bibl: "Bibliotek",
  bibliotek: "Bibliotek",
  nor: "Norsk",
  norsk: "Norsk",
  "m&h": "Mat og helse",
  mogh: "Mat og helse",
  "m og h": "Mat og helse",
  "mat og helse": "Mat og helse",
  krle: "KRLE",
  musikk: "Musikk",
  mus: "Musikk",
};

/** Normalize a single subject token via the alias dictionary. Title-cases if unknown. */
export function normalizeSubjectToken(token: string): string {
  const key = token.trim().toLowerCase();
  if (SUBJECT_ALIASES[key]) return SUBJECT_ALIASES[key];
  // Unknown — force Title Case ("FYSAK" / "fysak" → "Fysak")
  const lower = key;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Split a subject string on `/`, `&`, or ` og ` and normalize each part.
 * Returns an array of canonical names. Single subjects return a 1-element array.
 * Example: "Nor/bib" → ["Norsk", "Bibliotek"]
 */
export function splitAndNormalizeSubject(raw: string): string[] {
  // Check for "/" and " og " delimiters (but not "&" inside known aliases like "K&H")
  // First check if the whole string is a known alias (handles "K&H", "M&H")
  const wholeKey = raw.trim().toLowerCase();
  if (SUBJECT_ALIASES[wholeKey]) return [SUBJECT_ALIASES[wholeKey]];

  // Split on / or " og " (but not bare "&" which may be part of "K&H")
  const parts = raw
    .split(/\/| og /i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return [normalizeSubjectToken(raw)];
  return parts.map(normalizeSubjectToken);
}

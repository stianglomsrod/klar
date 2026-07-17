/**
 * Smart teacher name resolution (progressive disclosure).
 *
 * Given a list of full names, returns a Map<fullName, displayName>
 * using the shortest unambiguous form:
 *   1. First name only          → "Stian"
 *   2. First name + last initial → "Stian L."
 *   3. Full name (fallback)      → "Stian Larsen"
 */
export function resolveTeacherNames(
  fullNames: (string | null | undefined)[],
): Map<string, string> {
  const result = new Map<string, string>();
  const names = fullNames.filter((n): n is string => !!n);

  // Deduplicate to avoid counting the same teacher twice
  const unique = [...new Set(names)];

  // Parse each name into parts
  const parsed = unique.map((full) => {
    const parts = full.trim().split(/\s+/);
    const first = parts[0];
    const last = parts.length > 1 ? parts.slice(1).join(" ") : "";
    return { full, first, last };
  });

  // Group by first name to detect collisions
  const firstNameGroups = new Map<string, typeof parsed>();
  for (const entry of parsed) {
    const key = entry.first.toLowerCase();
    const group = firstNameGroups.get(key) || [];
    group.push(entry);
    firstNameGroups.set(key, group);
  }

  for (const entry of parsed) {
    const key = entry.first.toLowerCase();
    const group = firstNameGroups.get(key)!;

    if (group.length === 1) {
      // Unique first name → use first name only
      result.set(entry.full, entry.first);
    } else if (entry.last) {
      // Collision on first name → try "First L."
      const initial = entry.last.charAt(0).toUpperCase() + ".";
      const candidate = `${entry.first} ${initial}`;

      // Check if this initial is also ambiguous
      const sameInitial = group.filter(
        (g) =>
          g.last &&
          g.last.charAt(0).toLowerCase() === entry.last.charAt(0).toLowerCase(),
      );

      if (sameInitial.length <= 1) {
        result.set(entry.full, candidate);
      } else {
        // Full name as last resort
        result.set(entry.full, entry.full);
      }
    } else {
      // No last name but collision → full name
      result.set(entry.full, entry.full);
    }
  }

  return result;
}

import type { Student, Class, Trinn } from "./types";

/**
 * Extract the leading numeric portion of a class name (e.g. "5A" → "5").
 */
export const extractTrinnFromClassName = (className: string): string | null => {
  const match = className.match(/^(\d+)/);
  return match ? match[1] : null;
};

/**
 * Group flat class + student arrays into a `Trinn[]` hierarchy,
 * assigning students to their class and sorting groups numerically.
 */
export const groupClassesByTrinn = (
  classes: { id: string; name: string; grade_id: string | null }[],
  students: Student[],
): Trinn[] => {
  // Assign students to classes
  const classesWithStudents: Class[] = classes.map((cls) => ({
    ...cls,
    students: students.filter((student) => student.class_id === cls.id),
  }));

  // Group classes by trinn
  const trinnMap = new Map<string, Class[]>();

  classesWithStudents.forEach((cls) => {
    const trinnNumber = extractTrinnFromClassName(cls.name);
    const trinnKey = trinnNumber || "andre";

    if (!trinnMap.has(trinnKey)) {
      trinnMap.set(trinnKey, []);
    }
    trinnMap.get(trinnKey)!.push(cls);
  });

  // Convert map to array and sort
  const trinnArray: Trinn[] = Array.from(trinnMap.entries())
    .map(([trinnKey, classes]) => {
      // Get grade_id from the first class in this group (all share same grade)
      const gradeId = classes[0]?.grade_id ?? null;
      return {
        id: trinnKey,
        name: trinnKey === "andre" ? "Andre" : `${trinnKey}. Trinn`,
        grade_id: gradeId,
        classes: classes.sort((a, b) => a.name.localeCompare(b.name)),
      };
    })
    .sort((a, b) => {
      // "Andre" always goes last
      if (a.id === "andre") return 1;
      if (b.id === "andre") return -1;
      // Sort numerically
      return parseInt(a.id) - parseInt(b.id);
    });

  return trinnArray;
};

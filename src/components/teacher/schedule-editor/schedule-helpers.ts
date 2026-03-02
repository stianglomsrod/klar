import type { ScheduleEntry, MergedEntry, Subject, ClassInfo } from "./types";
import { getSubjectTheme } from "@/utils/subject-colors";

/**
 * Map a schedule entry's start-time to a human-readable period label.
 */
export const getDefaultTitle = (entry: ScheduleEntry): string => {
  const start = entry.start_time?.slice(0, 5) || "";
  switch (start) {
    case "08:30":
      return "1. time";
    case "09:15":
      return "2. time";
    case "10:00":
      return "Friminutt";
    case "10:10":
      return "3. time";
    case "10:55":
      return "Lunsj";
    case "11:15":
      return "Friminutt";
    case "11:45":
      return "4. time";
    case "12:30":
      return "Friminutt";
    case "12:40":
      return "5. time";
    case "13:25":
      return "6. time";
    default:
      return "";
  }
};

/**
 * Resolve subject metadata (name + color theme) from a subject ID.
 */
export const getSubjectMeta = (
  subjectId: string | null,
  subjects: Subject[],
) => {
  if (!subjectId) return null;
  const subject = subjects.find((s) => s.id === subjectId);
  if (!subject) return null;
  const theme = getSubjectTheme(subject.color_theme || "blue");
  return { name: subject.title, theme };
};

/**
 * Return sorted entries for a given day, optionally hiding the 6th period
 * for grades below 5.
 */
export const getEntriesForDay = (
  dayNumber: number,
  scheduleEntries: MergedEntry[],
  classInfo: ClassInfo,
): MergedEntry[] => {
  const hideSixth = classInfo.grade !== null && classInfo.grade < 5;
  return scheduleEntries
    .filter((e) => e.day_of_week === dayNumber)
    .filter((e) => {
      if (!hideSixth) return true;
      const isSixthPeriodStart = e.start_time?.startsWith("13:25");
      const isSixthPeriodEnd = e.end_time?.startsWith("14:10");
      return !(isSixthPeriodStart && isSixthPeriodEnd);
    })
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
};

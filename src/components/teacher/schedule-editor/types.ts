import type {
  TeacherScheduleEntry,
  Subject as SharedSubject,
} from "@/types/shared";
import { WEEKDAYS } from "@/utils/constants";

// ── Domain aliases ───────────────────────────────────
export type ScheduleEntry = TeacherScheduleEntry;

export type MergedEntry = ScheduleEntry & {
  isOverride?: boolean;
  isFallback?: boolean;
};

export type Subject = SharedSubject;

export type ClassInfo = { name: string | null; grade: number | null };

export type ScheduleFormData = {
  subject_id: string;
  selected_days: number[];
  start_time: string;
  end_time: string;
  type: string;
  custom_title: string;
  target: string;
};

// ── Constants ────────────────────────────────────────
export const DAYS_OF_WEEK = WEEKDAYS;

export const SCHEDULE_TYPES = ["lesson", "break", "activity"];

// ── Helpers ──────────────────────────────────────────
export const parseGradeFromClassName = (
  name: string | null,
): number | null => {
  if (!name) return null;
  const match = name.match(/\d+/);
  if (!match) return null;
  const grade = parseInt(match[0], 10);
  return Number.isNaN(grade) ? null : grade;
};

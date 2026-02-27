/**
 * Canonical shared type definitions for the Klar Education Platform.
 * Single source of truth — import from "@/types/shared" instead of
 * re-declaring these shapes locally.
 */

/* ── Quiz ──────────────────────────────────────────────── */

/** Quiz question shape (stored as JSONB in tasks.quiz_data / task_library.quiz_data). */
export type QuizQuestion = {
  id: string;
  text: string;
  answerType: "text" | "radio" | "checkbox";
  options: string[];
};

/* ── Tasks ─────────────────────────────────────────────── */

/** Student-facing task (used by TaskCard, Subject page, Lesson page). */
export type StudentTask = {
  id: string;
  title: string;
  description: string;
  points_value: number;
  type: string;
  is_completed: boolean;
  quiz_data?: QuizQuestion[] | null;
};

/* ── Subjects ──────────────────────────────────────────── */

/** Base subject shape (matches the `subjects` table core columns). */
export type Subject = {
  id: string;
  title: string;
  emoji: string;
  color_theme: string | null;
};

/** Subject with inline task status (archive views, fag/subjects page). */
export type SubjectWithTasks = Subject & {
  tasks: { id: string; is_completed: boolean }[];
};

/* ── Students (teacher-side) ───────────────────────────── */

/** Full teacher-side student shape (classes page, student table, edit sheet). */
export type TeacherStudent = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  level: number;
  class_name: string | null;
  class_id: string | null;
  show_flower_garden: boolean;
  custom_welcome_message: string | null;
};

/* ── Classes ───────────────────────────────────────────── */

/** Class selector option (with optional grade info). */
export type ClassOption = {
  id: string;
  name: string;
  grade_name?: string | null;
};

/* ── Schedule Entries ──────────────────────────────────── */

/**
 * Teacher-side schedule entry (matches `schedule_entries` table).
 * Used by WeeklyScheduleEditor, CreateTaskModal, and other teacher schedule views.
 *
 * NOTE: Student-facing entries (`StudentScheduleEntry`) live in
 * `@/components/student/ScheduleCard` and include task-count fields.
 * Parsed entries (`ParsedScheduleEntry`) live in `@/app/actions/parse-weekly-plan`
 * and use camelCase keys for the AI parser.
 */
export type TeacherScheduleEntry = {
  id: string;
  class_id: string | null;
  student_id: string | null;
  subject_id: string | null;
  subject_title?: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  type: string;
  custom_title: string | null;
  week_number?: number | null;
  isOverride?: boolean;
};

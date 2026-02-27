"use client";

// ── Types ────────────────────────────────────────────

export type ScheduleTarget = {
  classId: string;
  studentId?: string | null;
};

export type FallbackMarker = {
  isFallback?: boolean;
};

// ── fetchMergedSchedule ──────────────────────────────
//
// Used by WeeklyScheduleEditor.
// Fetches BOTH the target week and masterplan (week 0),
// then overlays primary on top of fallback so the caller
// knows which entries are inherited.

export async function fetchMergedSchedule(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  target: ScheduleTarget,
  weekNumber: number,
) {
  const base = () =>
    supabase
      .from("schedule_entries")
      .select("*")
      .eq("class_id", target.classId)
      .order("day_of_week")
      .order("start_time");

  const mergeKey = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entry: any,
  ) =>
    `${entry.day_of_week}-${entry.start_time}-${entry.end_time}-${
      target.studentId || "class"
    }`;

  const scoped = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: any,
    studentId?: string | null,
  ) =>
    studentId
      ? query.eq("student_id", studentId)
      : query.is("student_id", null);

  const { data: primaryData, error: primaryError } = await scoped(
    base().eq("week_number", weekNumber),
    target.studentId,
  );
  if (primaryError) throw primaryError;

  const fallbackData =
    weekNumber === 0
      ? []
      : (await scoped(base().eq("week_number", 0), target.studentId)).data ||
        [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const merged = new Map<string, any>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (fallbackData || []).forEach((entry: any) => {
    merged.set(mergeKey(entry), { ...entry, isFallback: true });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (primaryData || []).forEach((entry: any) => {
    merged.set(mergeKey(entry), { ...entry, isFallback: false });
  });

  return Array.from(merged.values());
}

// ── fetchScheduleFallback ────────────────────────────
//
// Used by CreateTaskModal / SchedulePicker.
// Tries the target week first; only falls back to
// masterplan (week 0) if the primary query returns empty.

export async function fetchScheduleFallback(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  target: ScheduleTarget,
  weekNumber: number,
  selectColumns = "id, class_id, student_id, subject_id, day_of_week, start_time, end_time, type, custom_title, week_number, subjects (title)",
  typeFilter: string | null = "lesson",
) {
  const baseSelect = () => {
    let q = supabase
      .from("schedule_entries")
      .select(selectColumns)
      .eq("class_id", target.classId)
      .order("day_of_week")
      .order("start_time");
    if (typeFilter) q = q.eq("type", typeFilter);
    return q;
  };

  const scoped = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: any,
    studentId?: string | null,
  ) =>
    studentId
      ? query.eq("student_id", studentId)
      : query.is("student_id", null);

  const { data: primaryData, error: primaryError } = await scoped(
    baseSelect().eq("week_number", weekNumber),
    target.studentId,
  );
  if (primaryError) throw primaryError;

  if (primaryData && primaryData.length > 0) return primaryData;

  if (weekNumber !== 0) {
    const { data: fallbackData, error: fallbackError } = await scoped(
      baseSelect().eq("week_number", 0),
      target.studentId,
    );
    if (fallbackError) throw fallbackError;
    return fallbackData || [];
  }

  return [];
}

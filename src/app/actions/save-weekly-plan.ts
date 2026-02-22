"use server";

import { createClient } from "@/utils/supabase/server";
import type { WeeklyPlanData } from "./parse-weekly-plan";

// ── Types ────────────────────────────────────────────

export type SaveWeeklyPlanResult =
  | { success: true; stats: SaveStats }
  | { success: false; error: string };

type SaveStats = {
  scheduleEntries: number;
};

// ── Server Action ────────────────────────────────────

export async function saveWeeklyPlan(
  data: WeeklyPlanData,
): Promise<SaveWeeklyPlanResult> {
  const supabase = await createClient();

  // ── Auth ──────────────────────────────────────────

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Ikke autentisert. Logg inn på nytt." };
  }

  const teacherId = user.id;

  // ── 1. Resolve class names → class_ids ────────────

  const classNames = [
    ...new Set(data.schedule.map((e) => e.className).filter(Boolean)),
  ];

  const classMap = new Map<string, string>();

  if (classNames.length > 0) {
    const { data: classes, error } = await supabase
      .from("classes")
      .select("id, name")
      .in("name", classNames);

    if (error) {
      return {
        success: false,
        error: `Feil ved henting av klasser: ${error.message}`,
      };
    }

    for (const c of classes ?? []) {
      classMap.set(c.name, c.id);
    }

    const missing = classNames.filter((n) => !classMap.has(n));
    if (missing.length > 0) {
      return {
        success: false,
        error: `Fant ikke klassene: ${missing.join(", ")}. Opprett dem først under «Mine Klasser».`,
      };
    }
  }

  // ── 2. Resolve subject names → subject_ids ────────

  const allSubjectNames = [
    ...new Set(
      [
        ...data.schedule.map((e) => e.subjectName),
        ...data.learningGoals.map((g) => g.subject),
        ...data.homework.map((h) => h.subject),
      ].filter(Boolean),
    ),
  ];

  const subjectMap = new Map<string, string>();

  if (allSubjectNames.length > 0) {
    const { data: subjects, error } = await supabase
      .from("subjects")
      .select("id, title")
      .in("title", allSubjectNames);

    if (error) {
      return {
        success: false,
        error: `Feil ved henting av fag: ${error.message}`,
      };
    }

    for (const s of subjects ?? []) {
      subjectMap.set(s.title, s.id);
    }

    // Create missing subjects (supports custom/hybrid names like "Norsk/Bibliotek")
    const missingSubjects = allSubjectNames.filter((n) => !subjectMap.has(n));

    for (const name of missingSubjects) {
      const { data: newSubject, error: createError } = await supabase
        .from("subjects")
        .insert({ title: name, created_by: teacherId })
        .select("id")
        .single();

      if (createError) {
        return {
          success: false,
          error: `Feil ved opprettelse av fag «${name}»: ${createError.message}`,
        };
      }

      subjectMap.set(name, newSubject.id);
    }
  }

  // ── 3. Save weekly update (messages + learning goals + homework) ──

  const contentParts: string[] = [];

  if (data.generalMessages.length > 0) {
    contentParts.push(
      "--- Beskjeder ---\n" + data.generalMessages.join("\n\n"),
    );
  }

  if (data.learningGoals.length > 0) {
    contentParts.push(
      "--- Læringsmål ---\n" +
        data.learningGoals
          .map(
            (g) =>
              `${g.subject}:\n${g.goals.map((x) => `  • ${x}`).join("\n")}`,
          )
          .join("\n\n"),
    );
  }

  if (data.homework.length > 0) {
    contentParts.push(
      "--- Lekser ---\n" +
        data.homework
          .map(
            (h) =>
              `${h.subject}:\n${h.tasks.map((t) => `  • ${t}`).join("\n")}`,
          )
          .join("\n\n"),
    );
  }

  if (contentParts.length > 0) {
    const { error } = await supabase.from("weekly_updates").insert({
      week_number: data.weekNumber,
      content_text: contentParts.join("\n\n"),
      created_by: teacherId,
    });

    if (error) {
      return {
        success: false,
        error: `Feil ved lagring av ukebrev: ${error.message}`,
      };
    }
  }

  // ── 4. Save schedule entries ──────────────────────

  let scheduleCount = 0;

  if (data.schedule.length > 0) {
    const rows = data.schedule.map((e) => ({
      class_id: classMap.get(e.className) ?? null,
      subject_id: subjectMap.get(e.subjectName) ?? null,
      day_of_week: e.dayOfWeek,
      start_time: e.startTime,
      end_time: e.endTime,
      type: "lesson" as const,
      week_number: data.weekNumber,
    }));

    const { error } = await supabase.from("schedule_entries").insert(rows);

    if (error) {
      return {
        success: false,
        error: `Feil ved lagring av timeplan: ${error.message}`,
      };
    }

    scheduleCount = rows.length;
  }

  return {
    success: true,
    stats: {
      scheduleEntries: scheduleCount,
    },
  };
}

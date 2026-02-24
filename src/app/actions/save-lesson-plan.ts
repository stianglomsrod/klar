"use server";

import { createClient } from "@/utils/supabase/server";
import type { LessonPlanData, LessonPlanTask } from "./parse-weekly-plan";
import {
  normalizeClassName,
  splitAndNormalizeSubject,
} from "./shared-normalization";

// ── Types ────────────────────────────────────────────

export type UnmatchedSession = {
  subjectName: string;
  sessionNumber: number;
  targetClasses: string[];
  reason: string;
};

export type SaveLessonPlanResult =
  | {
      success: true;
      stats: { tasksCreated: number; scheduleLinked: number };
      unmatchedSessions: UnmatchedSession[];
    }
  | { success: false; error: string }
  | {
      success: false;
      missingClasses: string[];
      missingSubjects: string[];
    };

// ── Server Action ────────────────────────────────────

export async function saveLessonPlan(
  data: LessonPlanData,
  forceCreate?: boolean,
): Promise<SaveLessonPlanResult> {
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

  try {
    // ── 1. Extract unique classes & subjects from tasks ──

    const rawClassNames = [
      ...new Set(data.tasks.flatMap((t) => t.targetClasses).filter(Boolean)),
    ];
    const normalizedClassSet = new Map<string, string>(); // norm → raw
    for (const raw of rawClassNames) {
      if (raw === "Alle") continue; // handled separately
      normalizedClassSet.set(normalizeClassName(raw), raw);
    }
    const normalizedClassNames = [...normalizedClassSet.keys()];

    // classMap: normalizedName → class_id
    const classMap = new Map<string, string>();

    if (normalizedClassNames.length > 0) {
      const { data: allClasses, error } = await supabase
        .from("classes")
        .select("id, name");

      if (error) {
        return {
          success: false,
          error: `Feil ved henting av klasser: ${error.message}`,
        };
      }

      const dbNormMap = new Map<string, { id: string; name: string }>();
      for (const c of allClasses ?? []) {
        dbNormMap.set(normalizeClassName(c.name), { id: c.id, name: c.name });
      }

      for (const norm of normalizedClassNames) {
        const match = dbNormMap.get(norm);
        if (match) classMap.set(norm, match.id);
      }
    }

    // Handle "Alle" — resolve to ALL classes the teacher has access to
    const hasAlleTarget = data.tasks.some((t) =>
      t.targetClasses.includes("Alle"),
    );
    if (hasAlleTarget && classMap.size === 0) {
      const { data: allClasses } = await supabase
        .from("classes")
        .select("id, name");
      for (const c of allClasses ?? []) {
        classMap.set(normalizeClassName(c.name), c.id);
      }
    }

    const missingClasses = normalizedClassNames.filter((n) => !classMap.has(n));

    // ── 2. Resolve subject names ──

    const allRawSubjectNames = [
      ...new Set(data.tasks.map((t) => t.subjectName).filter(Boolean)),
    ];

    const allNormalizedParts = new Set<string>();
    const subjectPrimaryMap = new Map<string, string>(); // rawName → primary canonical

    for (const raw of allRawSubjectNames) {
      const parts = splitAndNormalizeSubject(raw);
      subjectPrimaryMap.set(raw, parts[0]);
      for (const p of parts) allNormalizedParts.add(p);
    }

    const partsArray = [...allNormalizedParts];
    const subjectMap = new Map<string, string>(); // canonicalTitle → subject_id

    if (partsArray.length > 0) {
      const { data: subjects, error } = await supabase
        .from("subjects")
        .select("id, title")
        .in("title", partsArray);

      if (error) {
        return {
          success: false,
          error: `Feil ved henting av fag: ${error.message}`,
        };
      }

      for (const s of subjects ?? []) {
        subjectMap.set(s.title, s.id);
      }
    }

    const missingSubjects = partsArray.filter((n) => !subjectMap.has(n));

    // ── 3. Stop-and-ask if missing ──

    if (
      !forceCreate &&
      (missingClasses.length > 0 || missingSubjects.length > 0)
    ) {
      return { success: false, missingClasses, missingSubjects };
    }

    // ── 4. Auto-create missing entities ──

    if (missingClasses.length > 0) {
      const rows = missingClasses.map((norm) => ({ name: norm }));
      const { data: created, error: createError } = await supabase
        .from("classes")
        .insert(rows)
        .select("id, name");

      if (createError) {
        return {
          success: false,
          error: `Feil ved opprettelse av klasser: ${createError.message}`,
        };
      }

      for (const c of created ?? []) {
        classMap.set(normalizeClassName(c.name), c.id);
      }
    }

    if (missingSubjects.length > 0) {
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

    // ── 5. Nth-occurrence matching & task creation ──

    let totalTasksCreated = 0;
    let totalScheduleLinked = 0;
    const unmatchedSessions: UnmatchedSession[] = [];

    // Resolve target class_ids for each task
    const allClassIds = [...new Set(classMap.values())];

    for (const task of data.tasks) {
      // Determine class_ids for this task
      const targetClassIds: string[] = task.targetClasses.includes("Alle")
        ? allClassIds
        : task.targetClasses
            .map((c) => classMap.get(normalizeClassName(c)))
            .filter((id): id is string => !!id);

      if (targetClassIds.length === 0) {
        unmatchedSessions.push({
          subjectName: task.subjectName,
          sessionNumber: task.sessionNumber,
          targetClasses: task.targetClasses,
          reason: "Ingen gyldige klasser funnet.",
        });
        continue;
      }

      // Resolve subject_id
      const primarySubject = subjectPrimaryMap.get(task.subjectName);
      const subjectId = primarySubject
        ? (subjectMap.get(primarySubject) ?? null)
        : null;

      // ── 5a. Insert task_library ──

      const { data: libraryTask, error: libError } = await supabase
        .from("task_library")
        .insert({
          title: task.title,
          description: buildTaskDescription(task),
          subject_id: subjectId,
          type: "standard",
          created_by: teacherId,
        })
        .select("id")
        .single();

      if (libError) {
        console.warn(
          `task_library insert failed for "${task.title}":`,
          libError.message,
        );
        continue;
      }

      // ── 5b. Find students in target classes ──

      const { data: students } = await supabase
        .from("student_profiles")
        .select("id")
        .in("class_id", targetClassIds);

      const studentIds = (students ?? []).map((s) => s.id);

      if (studentIds.length === 0) {
        // No students yet — still create library entry, skip task insertion
        unmatchedSessions.push({
          subjectName: task.subjectName,
          sessionNumber: task.sessionNumber,
          targetClasses: task.targetClasses,
          reason: "Ingen elever funnet i målklassene.",
        });
        continue;
      }

      // ── 5c. Insert tasks (one per student) ──

      const taskRows = studentIds.map((sid) => ({
        title: task.title,
        description: buildTaskDescription(task),
        subject_id: subjectId,
        points_value: 10,
        student_id: sid,
        created_by: teacherId,
        is_completed: false,
        type: "standard" as const,
        task_library_id: libraryTask.id,
      }));

      const { data: insertedTasks, error: taskError } = await supabase
        .from("tasks")
        .insert(taskRows)
        .select("id");

      if (taskError) {
        console.warn(
          `tasks insert failed for "${task.title}":`,
          taskError.message,
        );
        continue;
      }

      totalTasksCreated += (insertedTasks ?? []).length;

      // ── 5d. Nth-occurrence matching: find schedule_entry_id ──

      const matchedEntryId = await findNthScheduleEntry(
        supabase,
        targetClassIds,
        subjectId,
        data.weekNumber,
        task.sessionNumber,
      );

      if (matchedEntryId && insertedTasks && insertedTasks.length > 0) {
        // ── 5e. Insert task_schedule_entries ──
        const junctionRows = insertedTasks.map((t) => ({
          task_id: t.id,
          schedule_entry_id: matchedEntryId,
        }));

        const { error: junctionError } = await supabase
          .from("task_schedule_entries")
          .insert(junctionRows);

        if (!junctionError) {
          totalScheduleLinked += junctionRows.length;
        } else {
          console.warn(
            `task_schedule_entries insert failed for "${task.title}":`,
            junctionError.message,
          );
        }
      } else if (!matchedEntryId) {
        unmatchedSessions.push({
          subjectName: task.subjectName,
          sessionNumber: task.sessionNumber,
          targetClasses: task.targetClasses,
          reason: `Fant ikke økt ${task.sessionNumber} for ${task.subjectName} i timeplanen.`,
        });
      }
    }

    return {
      success: true,
      stats: {
        tasksCreated: totalTasksCreated,
        scheduleLinked: totalScheduleLinked,
      },
      unmatchedSessions,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "En ukjent feil oppstod ved lagring";
    return { success: false, error: message };
  }
}

// ── Helpers ──────────────────────────────────────────

/** Build a rich description from a LessonPlanTask's goals and description. */
function buildTaskDescription(task: LessonPlanTask): string {
  const parts: string[] = [];
  if (task.description) parts.push(task.description);
  if (task.goals.length > 0) {
    parts.push("Mål:\n" + task.goals.map((g) => `  • ${g}`).join("\n"));
  }
  return parts.join("\n\n") || task.title;
}

/**
 * Nth-occurrence matching engine.
 *
 * Queries schedule_entries for a given set of class_ids and subject_id,
 * ordered by day_of_week ASC, start_time ASC. Returns the entry at
 * position [sessionNumber - 1], or null if it doesn't exist.
 *
 * Falls back to week_number=0 (masterplan) if no entries for the target week.
 */
async function findNthScheduleEntry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  classIds: string[],
  subjectId: string | null,
  weekNumber: number,
  sessionNumber: number,
): Promise<string | null> {
  if (!subjectId) return null;

  // Try target week first
  const { data: entries } = await supabase
    .from("schedule_entries")
    .select("id")
    .in("class_id", classIds)
    .eq("subject_id", subjectId)
    .eq("week_number", weekNumber)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (entries && entries.length >= sessionNumber) {
    return entries[sessionNumber - 1].id;
  }

  // Fallback: masterplan (week_number = 0)
  if (weekNumber > 0) {
    const { data: fallback } = await supabase
      .from("schedule_entries")
      .select("id")
      .in("class_id", classIds)
      .eq("subject_id", subjectId)
      .eq("week_number", 0)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    if (fallback && fallback.length >= sessionNumber) {
      return fallback[sessionNumber - 1].id;
    }
  }

  return null;
}

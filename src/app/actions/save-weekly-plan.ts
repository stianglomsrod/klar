"use server";

import { createClient } from "@/utils/supabase/server";
import type { WeeklyPlanData } from "./parse-weekly-plan";
import { normalizeClassName } from "./shared-normalization";
import {
  authenticateTeacher,
  resolveClasses,
  resolveSubjects,
  autoCreateClasses,
  autoCreateSubjects,
} from "./shared-plan-utils";

// ── Types ────────────────────────────────────────────

export type SaveWeeklyPlanResult =
  | { success: true; stats: SaveStats }
  | { success: false; error: string }
  | {
      success: false;
      missingClasses: string[];
      missingSubjects: string[];
    };

type SaveStats = {
  scheduleEntries: number;
};

// ── Server Action ────────────────────────────────────

export async function saveWeeklyPlan(
  data: WeeklyPlanData,
  forceCreate?: boolean,
  alsoSaveAsMasterplan?: boolean,
): Promise<SaveWeeklyPlanResult> {
  const supabase = await createClient();

  let teacherId: string;
  try {
    ({ teacherId } = await authenticateTeacher(supabase));
  } catch {
    return { success: false, error: "Ikke autentisert. Logg inn på nytt." };
  }

  try {
    // ── 1. Resolve class names → class_ids ──

    const rawClassNames = [
      ...new Set(data.schedule.map((e) => e.className).filter(Boolean)),
    ];

    const { classMap, missingClasses } = await resolveClasses(
      supabase,
      rawClassNames,
    );

    // ── 2. Resolve subject names → subject_ids ──

    const allRawSubjectNames = [
      ...new Set(
        [
          ...data.schedule.map((e) => e.subjectName),
          ...data.learningGoals.map((g) => g.subject),
          ...data.homework.map((h) => h.subject),
        ].filter(Boolean),
      ),
    ];

    const { subjectMap, missingSubjects, subjectInfoMap } =
      await resolveSubjects(supabase, allRawSubjectNames);

    // ── 3. Stop-and-ask if anything is missing ──────

    if (
      !forceCreate &&
      (missingClasses.length > 0 || missingSubjects.length > 0)
    ) {
      return {
        success: false,
        missingClasses,
        missingSubjects,
      };
    }

    // ── 4. Auto-create missing entities if forceCreate ──

    await autoCreateClasses(supabase, missingClasses, classMap);
    await autoCreateSubjects(supabase, missingSubjects, teacherId, subjectMap);

    // ── 5. Save weekly update (messages + learning goals + homework) ──

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

    // ── 6. Save schedule entries (hybrid subjects → custom_title) ──

    let scheduleCount = 0;

    if (data.schedule.length > 0) {
      const rows = data.schedule.map((e) => {
        const info = subjectInfoMap.get(e.subjectName);
        const isHybrid = info && info.parts.length > 1;
        const primaryId = info ? (subjectMap.get(info.primary) ?? null) : null;

        return {
          class_id: classMap.get(normalizeClassName(e.className)) ?? null,
          subject_id: primaryId,
          custom_title: isHybrid ? info.fullTitle : null,
          day_of_week: e.dayOfWeek,
          start_time: e.startTime,
          end_time: e.endTime,
          type: "lesson" as const,
          week_number: data.weekNumber,
        };
      });

      // ── 6a. Masterplan handling (week_number = 0) ──

      if (data.weekNumber > 0) {
        const classIdsInImport = [
          ...new Set(rows.map((r) => r.class_id).filter(Boolean)),
        ] as string[];

        if (classIdsInImport.length > 0) {
          if (alsoSaveAsMasterplan) {
            // User toggled "save as masterplan" → replace existing masterplan
            await supabase
              .from("schedule_entries")
              .delete()
              .in("class_id", classIdsInImport)
              .eq("week_number", 0);

            const masterplanRows = rows
              .filter((r) => r.class_id)
              .map((r) => ({ ...r, week_number: 0 }));

            if (masterplanRows.length > 0) {
              const { error: mpError } = await supabase
                .from("schedule_entries")
                .insert(masterplanRows);

              if (mpError) {
                console.warn(
                  "Masterplan save failed (non-blocking):",
                  mpError.message,
                );
              }
            }
          } else {
            // Auto-create masterplan only if none exists (prevents "Endret" badges)
            const { data: existingMasterplans } = await supabase
              .from("schedule_entries")
              .select("class_id")
              .in("class_id", classIdsInImport)
              .eq("week_number", 0);

            const classesWithMasterplan = new Set(
              (existingMasterplans ?? []).map((e) => e.class_id),
            );

            const masterplanRows = rows
              .filter(
                (r) => r.class_id && !classesWithMasterplan.has(r.class_id),
              )
              .map((r) => ({ ...r, week_number: 0 }));

            if (masterplanRows.length > 0) {
              const { error: mpError } = await supabase
                .from("schedule_entries")
                .insert(masterplanRows);

              if (mpError) {
                console.warn(
                  "Masterplan auto-creation failed (non-blocking):",
                  mpError.message,
                );
              }
            }
          }
        }
      }

      // ── 6b. Insert the actual week entries ──

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
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "En ukjent feil oppstod ved lagring";
    return { success: false, error: message };
  }
}

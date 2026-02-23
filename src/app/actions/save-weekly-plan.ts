"use server";

import { createClient } from "@/utils/supabase/server";
import type { WeeklyPlanData } from "./parse-weekly-plan";

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

// ── Helpers: Class Normalization ─────────────────────

/** Strips whitespace, dots, dashes → uppercase. "7 a" / "7-A" / "7.a" → "7A" */
const normalizeClassName = (name: string) =>
  name.replace(/[^a-zA-Z0-9æøåÆØÅ]/g, "").toUpperCase();

// ── Helpers: Subject Normalization & Splitting ───────

/** Dictionary mapping common Norwegian abbreviations → canonical subject name */
const SUBJECT_ALIASES: Record<string, string> = {
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
function normalizeSubjectToken(token: string): string {
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
function splitAndNormalizeSubject(raw: string): string[] {
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

// ── Server Action ────────────────────────────────────

export async function saveWeeklyPlan(
  data: WeeklyPlanData,
  forceCreate?: boolean,
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

  try {
    // ── 1. Resolve class names → class_ids (with normalization) ──

    const rawClassNames = [
      ...new Set(data.schedule.map((e) => e.className).filter(Boolean)),
    ];
    const normalizedClassSet = new Map<string, string>(); // norm → raw
    for (const raw of rawClassNames) {
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

    const missingClasses = normalizedClassNames.filter((n) => !classMap.has(n));

    // ── 2. Resolve subject names → subject_ids (with normalization) ──

    // Collect all raw subject names from every section
    const allRawSubjectNames = [
      ...new Set(
        [
          ...data.schedule.map((e) => e.subjectName),
          ...data.learningGoals.map((g) => g.subject),
          ...data.homework.map((h) => h.subject),
        ].filter(Boolean),
      ),
    ];

    // Build normalized lookup: rawName → { parts: string[], primary: string, fullTitle: string }
    type SubjectInfo = {
      parts: string[];
      primary: string;
      fullTitle: string;
    };
    const subjectInfoMap = new Map<string, SubjectInfo>();
    const allNormalizedParts = new Set<string>();

    for (const raw of allRawSubjectNames) {
      const parts = splitAndNormalizeSubject(raw);
      const primary = parts[0];
      const fullTitle = parts.join("/");
      subjectInfoMap.set(raw, { parts, primary, fullTitle });
      for (const p of parts) allNormalizedParts.add(p);
    }

    // Query DB for all unique normalized parts
    const partsArray = [...allNormalizedParts];
    // subjectMap: normalizedTitle → subject_id
    const subjectMap = new Map<string, string>();

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

      // ── 6a. Auto-create masterplan (week_number = 0) if none exists ──
      // Without a masterplan, WeeklyScheduleEditor marks every entry as "Endret".

      if (data.weekNumber > 0) {
        // Collect unique class_ids present in this import
        const classIdsInImport = [
          ...new Set(rows.map((r) => r.class_id).filter(Boolean)),
        ] as string[];

        if (classIdsInImport.length > 0) {
          // Check which of those classes already have a masterplan
          const { data: existingMasterplans } = await supabase
            .from("schedule_entries")
            .select("class_id")
            .in("class_id", classIdsInImport)
            .eq("week_number", 0);

          const classesWithMasterplan = new Set(
            (existingMasterplans ?? []).map((e) => e.class_id),
          );

          // Build masterplan rows for classes that lack week_number=0
          const masterplanRows = rows
            .filter((r) => r.class_id && !classesWithMasterplan.has(r.class_id))
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

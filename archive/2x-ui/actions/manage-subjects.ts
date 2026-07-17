"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

// ── Types ────────────────────────────────────────────

export type ManageSubjectResult =
  | { success: true }
  | { success: false; error: string };

// ── Update Subject ───────────────────────────────────

export async function updateSubject(
  id: string,
  data: { title: string; emoji: string; color_theme: string },
): Promise<ManageSubjectResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Ikke autentisert. Logg inn på nytt." };
  }

  const { error } = await supabase
    .from("subjects")
    .update({
      title: data.title.trim(),
      emoji: data.emoji,
      color_theme: data.color_theme,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        error: `Faget «${data.title}» finnes allerede.`,
      };
    }
    return { success: false, error: `Feil ved oppdatering: ${error.message}` };
  }

  revalidatePath("/teacher/tasks", "page");
  return { success: true };
}

// ── Delete Subject (with failsafe) ──────────────────

export async function deleteSubject(id: string): Promise<ManageSubjectResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Ikke autentisert. Logg inn på nytt." };
  }

  // Check tasks usage
  const { count: taskCount, error: taskError } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("subject_id", id);

  if (taskError) {
    return {
      success: false,
      error: `Feil ved sjekk av oppgaver: ${taskError.message}`,
    };
  }

  // Check schedule_entries usage
  const { count: scheduleCount, error: scheduleError } = await supabase
    .from("schedule_entries")
    .select("id", { count: "exact", head: true })
    .eq("subject_id", id);

  if (scheduleError) {
    return {
      success: false,
      error: `Feil ved sjekk av timeplaner: ${scheduleError.message}`,
    };
  }

  // Check task_library usage
  const { count: libraryCount, error: libraryError } = await supabase
    .from("task_library")
    .select("id", { count: "exact", head: true })
    .eq("subject_id", id);

  if (libraryError) {
    return {
      success: false,
      error: `Feil ved sjekk av oppgavebibliotek: ${libraryError.message}`,
    };
  }

  if (
    (taskCount ?? 0) > 0 ||
    (scheduleCount ?? 0) > 0 ||
    (libraryCount ?? 0) > 0
  ) {
    const parts: string[] = [];
    if ((taskCount ?? 0) > 0) parts.push(`${taskCount} oppgaver`);
    if ((scheduleCount ?? 0) > 0) parts.push(`${scheduleCount} timeplantimer`);
    if ((libraryCount ?? 0) > 0)
      parts.push(`${libraryCount} bibliotekoppgaver`);
    return {
      success: false,
      error: `Kan ikke slettes: Faget er i bruk av ${parts.join(", ")}.`,
    };
  }

  // Safe to delete
  const { error } = await supabase.from("subjects").delete().eq("id", id);

  if (error) {
    return { success: false, error: `Feil ved sletting: ${error.message}` };
  }

  revalidatePath("/teacher/tasks", "page");
  return { success: true };
}

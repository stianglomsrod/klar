import "server-only";

import { requireAnyStudentActor, requireClassRole } from "@/server/auth/authorize";
import { isUuid } from "@/server/auth/policy";
import { PrototypeDataError } from "@/server/data/errors";
import { getSupabaseAdminClient } from "@/server/supabase/admin";
import type { StudentTaskStatus } from "@/server/supabase/database.types";

export type StudentTodayTask = {
  assignmentId: string;
  title: string;
  description: string | null;
  subject: string | null;
  estimatedMinutes: number | null;
  supportLevel: number;
  status: StudentTaskStatus;
  dueAt: string | null;
};

export type StudentToday = {
  displayName: string;
  tasks: StudentTodayTask[];
};

export async function publishClassTask(input: {
  classId: string;
  title: string;
  description?: string;
  subject?: string;
  estimatedMinutes?: number;
  supportLevel?: number;
}): Promise<string> {
  const actor = await requireClassRole(input.classId, ["teacher"]);
  const title = input.title.trim().replace(/\s+/g, " ");
  if (title.length < 1 || title.length > 160) {
    throw new PrototypeDataError("Oppgavetittelen må være mellom 1 og 160 tegn.");
  }

  const description = input.description?.trim() || null;
  if (description && description.length > 4000) {
    throw new PrototypeDataError("Oppgavebeskrivelsen er for lang.");
  }

  const subject = input.subject?.trim() || null;
  if (subject && subject.length > 80) {
    throw new PrototypeDataError("Fagnavnet er for langt.");
  }

  const estimatedMinutes = input.estimatedMinutes ?? null;
  if (
    estimatedMinutes !== null &&
    (!Number.isInteger(estimatedMinutes) ||
      estimatedMinutes < 1 ||
      estimatedMinutes > 480)
  ) {
    throw new PrototypeDataError("Tidsestimatet må være mellom 1 og 480 minutter.");
  }

  const supportLevel = input.supportLevel ?? 2;
  if (![1, 2, 3].includes(supportLevel)) {
    throw new PrototypeDataError("Støttenivået må være 1, 2 eller 3.");
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("publish_task_to_class", {
    p_class_id: actor.classId,
    p_actor_id: actor.userId,
    p_title: title,
    p_description: description,
    p_subject: subject,
    p_estimated_minutes: estimatedMinutes,
    p_support_level: supportLevel,
  });
  if (error || !data) throw new PrototypeDataError("Kunne ikke publisere oppgaven.");
  return data;
}

export async function getStudentToday(): Promise<StudentToday> {
  const actor = await requireAnyStudentActor();
  const admin = getSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", actor.userId)
    .single();
  if (profileError || !profile) throw new PrototypeDataError();

  const { data: assignments, error: assignmentError } = await admin
    .from("task_assignments")
    .select("id, task_definition_id, due_at, visible_from")
    .eq("student_id", actor.userId)
    .lte("visible_from", new Date().toISOString())
    .order("visible_from");
  if (assignmentError) throw new PrototypeDataError();

  if (assignments.length === 0) {
    return { displayName: profile.display_name, tasks: [] };
  }

  const taskIds = assignments.map((assignment) => assignment.task_definition_id);
  const assignmentIds = assignments.map((assignment) => assignment.id);
  const [{ data: tasks, error: taskError }, { data: states, error: stateError }] =
    await Promise.all([
      admin
        .from("task_definitions")
        .select(
          "id, title, description, subject, estimated_minutes, support_level, position",
        )
        .in("id", taskIds)
        .eq("publication_status", "published"),
      admin
        .from("student_task_state")
        .select("assignment_id, status")
        .in("assignment_id", assignmentIds),
    ]);
  if (taskError || stateError) throw new PrototypeDataError();

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const stateByAssignment = new Map(
    states.map((state) => [state.assignment_id, state.status]),
  );

  return {
    displayName: profile.display_name,
    tasks: assignments
      .map((assignment) => {
        const task = taskById.get(assignment.task_definition_id);
        if (!task) return null;
        return {
          assignmentId: assignment.id,
          title: task.title,
          description: task.description,
          subject: task.subject,
          estimatedMinutes: task.estimated_minutes,
          supportLevel: task.support_level,
          status: stateByAssignment.get(assignment.id) ?? "not_started",
          dueAt: assignment.due_at,
          position: task.position,
        };
      })
      .filter((task): task is StudentTodayTask & { position: number } => Boolean(task))
      .sort((first, second) => first.position - second.position)
      .map((task) => ({
        assignmentId: task.assignmentId,
        title: task.title,
        description: task.description,
        subject: task.subject,
        estimatedMinutes: task.estimatedMinutes,
        supportLevel: task.supportLevel,
        status: task.status,
        dueAt: task.dueAt,
      })),
  };
}

export async function updateOwnTaskStatus(
  assignmentId: string,
  status: StudentTaskStatus,
): Promise<void> {
  if (!isUuid(assignmentId)) {
    throw new PrototypeDataError("Ugyldig oppgave-ID.");
  }
  if (!["not_started", "in_progress", "completed"].includes(status)) {
    throw new PrototypeDataError("Ugyldig oppgavestatus.");
  }

  const actor = await requireAnyStudentActor();
  const admin = getSupabaseAdminClient();
  const { error } = await admin.rpc("update_student_task_status", {
    p_assignment_id: assignmentId,
    p_student_id: actor.userId,
    p_status: status,
  });
  if (error) throw new PrototypeDataError("Kunne ikke oppdatere oppgaven.");
}

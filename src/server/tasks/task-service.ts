import "server-only";

import {
  requireAnyStudentActor,
  requireStaffCapability,
} from "@/server/auth/authorize";
import { isUuid } from "@/server/auth/policy";
import { PrototypeDataError } from "@/server/data/errors";
import { getSupabaseAdminClient } from "@/server/supabase/admin";
import type {
  Json,
  StudentTaskStatus,
  TaskReopenReason,
} from "@/server/supabase/database.types";

const TASK_REOPEN_REASONS = [
  "continue_working",
  "completed_by_mistake",
  "needs_review",
  "other",
] as const satisfies readonly TaskReopenReason[];

export type StudentTodayTask = {
  assignmentId: string;
  title: string;
  description: string | null;
  subject: string | null;
  estimatedMinutes: number | null;
  supportLevel: number;
  pointsValue: number;
  status: StudentTaskStatus;
  reopenMessage: string | null;
  dueAt: string | null;
};

export type StudentToday = {
  displayName: string;
  tasks: StudentTodayTask[];
  progress: StudentProgressSummary;
};

export type StudentProgressSummary = {
  xpBalance: number;
  currentLevel: number;
  highestLevel: number;
};

export type TaskProgressResult = StudentProgressSummary & {
  requestId: string;
  assignmentId: string;
  status: StudentTaskStatus;
  stateVersion: number;
  changed: boolean;
  completionAttemptId: string | null;
  ledgerEntryId: string | null;
  xpDelta: number;
  schemeVersion: "linear_1000_v1";
  newMilestoneLevels: number[];
  reactivatedLevels: number[];
  pendingLevels: number[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function parseLevelArray(value: unknown): number[] | null {
  if (!Array.isArray(value) || !value.every((level) => isInteger(level) && level >= 2)) {
    return null;
  }
  return value;
}

function parseTaskProgressResult(
  value: Json,
  expectedAssignmentId: string,
  expectedRequestId: string,
): TaskProgressResult {
  if (!isRecord(value)) throw new PrototypeDataError();

  const status = value.status;
  const newMilestoneLevels = parseLevelArray(value.new_milestone_levels);
  const reactivatedLevels = parseLevelArray(value.reactivated_levels);
  const pendingLevels = parseLevelArray(value.pending_levels);
  if (
    value.assignment_id !== expectedAssignmentId ||
    value.request_id !== expectedRequestId ||
    !["assigned", "completed", "reopened"].includes(String(status)) ||
    typeof value.changed !== "boolean" ||
    !isInteger(value.state_version) ||
    value.state_version < 1 ||
    !isInteger(value.xp_delta) ||
    !isInteger(value.xp_balance) ||
    value.xp_balance < 0 ||
    !isInteger(value.current_level) ||
    value.current_level < 1 ||
    !isInteger(value.highest_level) ||
    value.highest_level < value.current_level ||
    value.scheme_version !== "linear_1000_v1" ||
    !(
      value.completion_attempt_id === null ||
      isUuid(value.completion_attempt_id)
    ) ||
    !(value.ledger_entry_id === null || isUuid(value.ledger_entry_id)) ||
    !newMilestoneLevels ||
    !reactivatedLevels ||
    !pendingLevels
  ) {
    throw new PrototypeDataError();
  }

  return {
    requestId: expectedRequestId,
    assignmentId: expectedAssignmentId,
    status: status as StudentTaskStatus,
    stateVersion: value.state_version,
    changed: value.changed,
    completionAttemptId: value.completion_attempt_id,
    ledgerEntryId: value.ledger_entry_id,
    xpDelta: value.xp_delta,
    schemeVersion: "linear_1000_v1",
    xpBalance: value.xp_balance,
    currentLevel: value.current_level,
    highestLevel: value.highest_level,
    newMilestoneLevels,
    reactivatedLevels,
    pendingLevels,
  };
}

function assertCommandIds(assignmentId: string, requestId: string): void {
  if (!isUuid(assignmentId)) {
    throw new PrototypeDataError("Ugyldig oppgave-ID.");
  }
  if (!isUuid(requestId)) {
    throw new PrototypeDataError("Ugyldig forespørsels-ID.");
  }
}

function reopenReasonMessage(reasonCode: TaskReopenReason | null): string {
  switch (reasonCode) {
    case "continue_working":
      return "Jobb litt videre med oppgaven.";
    case "completed_by_mistake":
      return "Oppgaven ble markert ferdig ved en feil.";
    case "needs_review":
      return "Se på oppgaven én gang til.";
    default:
      return "Oppgaven er åpnet igjen. Du kan jobbe videre.";
  }
}

export async function publishClassTask(input: {
  classId: string;
  title: string;
  description?: string;
  subject?: string;
  estimatedMinutes?: number;
  supportLevel?: number;
}): Promise<string> {
  const actor = await requireStaffCapability(input.classId, "task.publish");
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
    p_staff_assignment_id: actor.staffAssignmentId,
    p_title: title,
    p_description: description,
    p_subject: subject,
    p_estimated_minutes: estimatedMinutes,
    p_support_level: supportLevel,
  });
  if (error || !data) {
    await requireStaffCapability(input.classId, "task.publish");
    throw new PrototypeDataError("Kunne ikke publisere oppgaven.");
  }
  return data;
}

export async function getStudentToday(): Promise<StudentToday> {
  const actor = await requireAnyStudentActor();
  const admin = getSupabaseAdminClient();
  const [profileResult, progressResult, classMembershipResult] = await Promise.all([
    admin.from("profiles").select("display_name").eq("id", actor.userId).single(),
    admin
      .from("student_progress")
      .select("xp_balance, current_level, highest_level")
      .eq("organization_id", actor.organizationId)
      .eq("student_id", actor.userId)
      .maybeSingle(),
    admin
      .from("class_memberships")
      .select("class_id")
      .eq("organization_id", actor.organizationId)
      .eq("user_id", actor.userId)
      .eq("role", "student"),
  ]);
  if (
    profileResult.error ||
    !profileResult.data ||
    progressResult.error ||
    classMembershipResult.error
  ) {
    throw new PrototypeDataError();
  }
  const profile = profileResult.data;
  const progress: StudentProgressSummary = progressResult.data
    ? {
        xpBalance: progressResult.data.xp_balance,
        currentLevel: progressResult.data.current_level,
        highestLevel: progressResult.data.highest_level,
      }
    : { xpBalance: 0, currentLevel: 1, highestLevel: 1 };

  const activeClassIds = classMembershipResult.data.map(
    (membership) => membership.class_id,
  );
  if (activeClassIds.length === 0) {
    return { displayName: profile.display_name, tasks: [], progress };
  }

  const { data: assignments, error: assignmentError } = await admin
    .from("task_assignments")
    .select(
      "id, task_definition_id, points_value_snapshot, due_at, visible_from",
    )
    .eq("organization_id", actor.organizationId)
    .eq("student_id", actor.userId)
    .in("class_id", activeClassIds)
    .lte("visible_from", new Date().toISOString())
    .order("visible_from");
  if (assignmentError) throw new PrototypeDataError();

  if (assignments.length === 0) {
    return { displayName: profile.display_name, tasks: [], progress };
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
        .select("assignment_id, status, last_transition_id")
        .in("assignment_id", assignmentIds),
    ]);
  if (taskError || stateError) throw new PrototypeDataError();

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const stateByAssignment = new Map(
    states.map((state) => [state.assignment_id, state.status]),
  );
  const reopenTransitionIds = states.flatMap((state) =>
    state.status === "reopened" && state.last_transition_id
      ? [state.last_transition_id]
      : [],
  );
  const reopenTransitions = reopenTransitionIds.length
    ? await admin
        .from("task_state_transitions")
        .select("id, reason_code, student_message")
        .eq("organization_id", actor.organizationId)
        .eq("student_id", actor.userId)
        .in("id", reopenTransitionIds)
    : { data: [], error: null };
  if (reopenTransitions.error) throw new PrototypeDataError();
  const reopenMessageByTransition = new Map(
    reopenTransitions.data.map((transition) => [
      transition.id,
      transition.student_message?.trim() ||
        reopenReasonMessage(transition.reason_code),
    ]),
  );
  const transitionByAssignment = new Map(
    states.map((state) => [state.assignment_id, state.last_transition_id]),
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
          pointsValue: assignment.points_value_snapshot,
          status: stateByAssignment.get(assignment.id) ?? "assigned",
          reopenMessage:
            reopenMessageByTransition.get(
              transitionByAssignment.get(assignment.id) ?? "",
            ) ?? null,
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
        pointsValue: task.pointsValue,
        status: task.status,
        reopenMessage: task.reopenMessage,
        dueAt: task.dueAt,
      })),
    progress,
  };
}

async function runOwnTaskCommand(
  command: "complete_student_task" | "undo_student_task_completion",
  assignmentId: string,
  requestId: string,
): Promise<TaskProgressResult> {
  assertCommandIds(assignmentId, requestId);
  const actor = await requireAnyStudentActor();
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc(command, {
    p_assignment_id: assignmentId,
    p_student_id: actor.userId,
    p_request_id: requestId,
  });
  if (error || data === null) {
    throw new PrototypeDataError("Kunne ikke oppdatere oppgaven.");
  }
  return parseTaskProgressResult(data, assignmentId, requestId);
}

export async function completeOwnTask(
  assignmentId: string,
  requestId: string,
): Promise<TaskProgressResult> {
  return runOwnTaskCommand("complete_student_task", assignmentId, requestId);
}

export async function undoOwnTaskCompletion(
  assignmentId: string,
  requestId: string,
): Promise<TaskProgressResult> {
  return runOwnTaskCommand(
    "undo_student_task_completion",
    assignmentId,
    requestId,
  );
}

export async function reopenStudentTaskForStaff(input: {
  classId: string;
  assignmentId: string;
  requestId: string;
  reasonCode: TaskReopenReason;
  studentMessage?: string;
}): Promise<TaskProgressResult> {
  assertCommandIds(input.assignmentId, input.requestId);
  if (!isUuid(input.classId)) {
    throw new PrototypeDataError("Ugyldig klasse-ID.");
  }
  if (!TASK_REOPEN_REASONS.includes(input.reasonCode)) {
    throw new PrototypeDataError("Velg en gyldig årsak.");
  }

  if (
    input.studentMessage !== undefined &&
    typeof input.studentMessage !== "string"
  ) {
    throw new PrototypeDataError("Forklaringen må være tekst.");
  }
  const studentMessage = input.studentMessage?.trim() || null;
  if (studentMessage && studentMessage.length > 240) {
    throw new PrototypeDataError("Forklaringen kan ikke være lengre enn 240 tegn.");
  }
  if (input.reasonCode === "other" && !studentMessage) {
    throw new PrototypeDataError("Skriv en kort forklaring.");
  }

  const actor = await requireStaffCapability(input.classId, "task.return");
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("reopen_student_task_for_staff", {
    p_assignment_id: input.assignmentId,
    p_actor_id: actor.userId,
    p_staff_assignment_id: actor.staffAssignmentId,
    p_request_id: input.requestId,
    p_reason_code: input.reasonCode,
    p_student_message: studentMessage,
  });
  if (error || data === null) {
    await requireStaffCapability(input.classId, "task.return");
    throw new PrototypeDataError("Kunne ikke åpne oppgaven igjen.");
  }
  return parseTaskProgressResult(data, input.assignmentId, input.requestId);
}

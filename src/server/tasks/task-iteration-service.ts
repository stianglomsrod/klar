import "server-only";

import { requireStaffCapability } from "@/server/auth/authorize";
import { AuthorizationError } from "@/server/auth/errors";
import { isUuid } from "@/server/auth/policy";
import { PrototypeDataError } from "@/server/data/errors";
import { getSupabaseAdminClient } from "@/server/supabase/admin";
import type {
  Json,
  StudentTaskStatus,
  TaskScheduleCommand,
} from "@/server/supabase/database.types";

export type ScheduledSessionSummary = {
  teachingSessionId: string;
  revisionSessionId: string;
  weeklyPlanId: string;
  title: string;
  subject: string | null;
  startsAt: string;
  endsAt: string;
};

export type TaskIterationRecipientSummary = {
  assignmentId: string;
  studentId: string;
  studentName: string;
  status: StudentTaskStatus;
  stateVersion: number;
  scheduleVersion: number;
  pointsValue: number;
  scheduledSession: ScheduledSessionSummary;
  blockedTargetTeachingSessionIds: string[];
};

export type TeacherTaskIterationSummary = {
  id: string;
  managementVersion: number;
  iterationNumber: number;
  reissuedFromIterationId: string | null;
  taskDefinitionId: string;
  planTaskId: string;
  title: string;
  description: string | null;
  subject: string | null;
  createdAt: string;
  recipients: TaskIterationRecipientSummary[];
};

export type TaskIterationTargetSession = ScheduledSessionSummary & {
  planLockVersion: number;
};

export type TeacherTaskIterationWorkspace = {
  iterations: TeacherTaskIterationSummary[];
  targetSessions: TaskIterationTargetSession[];
};

export type TaskScheduleRecipientInput = {
  assignmentId: string;
  expectedStateVersion: number;
  expectedScheduleVersion: number;
};

export type TaskScheduleInput = {
  classId: string;
  iterationId: string;
  targetRevisionSessionId: string;
  expectedIterationVersion: number;
  expectedTargetPlanLockVersion: number;
  recipients: TaskScheduleRecipientInput[];
  requestId: string;
};

export type TaskScheduleAssignmentResult = {
  sourceAssignmentId: string | null;
  assignmentId: string;
  studentId: string;
  status: StudentTaskStatus;
  stateVersion: number;
  scheduleVersion: number;
};

export type TaskScheduleResult = {
  requestId: string;
  command: TaskScheduleCommand;
  sourceIterationId: string;
  resultIterationId: string;
  sourceIterationVersion: number;
  resultIterationVersion: number;
  iterationNumber: number | null;
  targetTeachingSessionId: string;
  targetRevisionSessionId: string;
  assignments: TaskScheduleAssignmentResult[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 1;
}

function requireSchedulingCapabilities(capabilities: readonly string[]): void {
  if (
    !capabilities.includes("class.workspace.read") ||
    !capabilities.includes("plan.publish") ||
    !capabilities.includes("task.publish") ||
    !capabilities.includes("student_progress.read")
  ) {
    throw new AuthorizationError(
      "STAFF_ACCESS_ENDED",
      403,
      "Tilgangen til denne handlingen er avsluttet.",
    );
  }
}

async function requireTaskScheduleActor(classId: string) {
  const actor = await requireStaffCapability(classId, "plan.publish");
  requireSchedulingCapabilities(actor.capabilities);
  return actor;
}

function parseScheduleResult(
  value: Json,
  expectedCommand: TaskScheduleCommand,
  input: TaskScheduleInput,
  expectedRecipients: readonly TaskScheduleRecipientInput[],
): TaskScheduleResult {
  if (!isRecord(value) || !Array.isArray(value.assignments)) {
    throw new PrototypeDataError();
  }
  const command = value.command;
  const moveVersion = value.iteration_version;
  const sourceVersion =
    expectedCommand === "move" ? moveVersion : value.source_iteration_version;
  const resultVersion =
    expectedCommand === "move" ? moveVersion : value.result_iteration_version;
  if (
    command !== expectedCommand ||
    value.request_id !== input.requestId ||
    !isUuid(String(value.source_iteration_id)) ||
    !isUuid(String(value.result_iteration_id)) ||
    !isUuid(String(value.target_teaching_session_id)) ||
    !isUuid(String(value.target_revision_session_id)) ||
    !isPositiveInteger(sourceVersion) ||
    !isPositiveInteger(resultVersion) ||
    !(
      expectedCommand === "move" ||
      isPositiveInteger(value.iteration_number)
    )
  ) {
    throw new PrototypeDataError();
  }

  const sourceIterationId = String(value.source_iteration_id);
  const resultIterationId = String(value.result_iteration_id);
  if (
    sourceIterationId !== input.iterationId ||
    String(value.target_revision_session_id) !== input.targetRevisionSessionId ||
    Number(sourceVersion) !== input.expectedIterationVersion + 1 ||
    (expectedCommand === "move" && resultIterationId !== input.iterationId) ||
    (expectedCommand === "reissue" &&
      (resultIterationId === input.iterationId || Number(resultVersion) !== 1))
  ) {
    throw new PrototypeDataError();
  }

  const assignments = value.assignments.map(
    (assignment): TaskScheduleAssignmentResult => {
      if (!isRecord(assignment)) throw new PrototypeDataError();
      const status = String(assignment.status) as StudentTaskStatus;
      const sourceAssignmentId = assignment.source_assignment_id ?? null;
      if (
        !isUuid(String(assignment.assignment_id)) ||
        !isUuid(String(assignment.student_id)) ||
        !(sourceAssignmentId === null || isUuid(String(sourceAssignmentId))) ||
        !["assigned", "completed", "reopened"].includes(status) ||
        !isPositiveInteger(assignment.state_version) ||
        !isPositiveInteger(assignment.schedule_version)
      ) {
        throw new PrototypeDataError();
      }
      return {
        sourceAssignmentId:
          sourceAssignmentId === null ? null : String(sourceAssignmentId),
        assignmentId: String(assignment.assignment_id),
        studentId: String(assignment.student_id),
        status,
        stateVersion: Number(assignment.state_version),
        scheduleVersion: Number(assignment.schedule_version),
      };
    },
  );

  if (assignments.length !== expectedRecipients.length) {
    throw new PrototypeDataError();
  }
  const expectedByAssignment = new Map(
    expectedRecipients.map((recipient) => [recipient.assignmentId, recipient]),
  );
  const sourceIds = assignments.map((assignment) =>
    expectedCommand === "move"
      ? assignment.assignmentId
      : assignment.sourceAssignmentId,
  );
  const resultIds = new Set(assignments.map((assignment) => assignment.assignmentId));
  const studentIds = new Set(assignments.map((assignment) => assignment.studentId));
  if (
    sourceIds.some((sourceId) => sourceId === null) ||
    new Set(sourceIds).size !== expectedRecipients.length ||
    resultIds.size !== expectedRecipients.length ||
    studentIds.size !== expectedRecipients.length
  ) {
    throw new PrototypeDataError();
  }
  for (const assignment of assignments) {
    const sourceAssignmentId =
      expectedCommand === "move"
        ? assignment.assignmentId
        : assignment.sourceAssignmentId;
    const expected = sourceAssignmentId
      ? expectedByAssignment.get(sourceAssignmentId)
      : undefined;
    if (
      !expected ||
      (expectedCommand === "move" &&
        (assignment.sourceAssignmentId !== null ||
          assignment.stateVersion !== expected.expectedStateVersion ||
          assignment.scheduleVersion !== expected.expectedScheduleVersion + 1)) ||
      (expectedCommand === "reissue" &&
        (assignment.assignmentId === sourceAssignmentId ||
          assignment.status !== "assigned" ||
          assignment.stateVersion !== 1 ||
          assignment.scheduleVersion !== 1))
    ) {
      throw new PrototypeDataError();
    }
  }
  return {
    requestId: input.requestId,
    command: expectedCommand,
    sourceIterationId,
    resultIterationId,
    sourceIterationVersion: Number(sourceVersion),
    resultIterationVersion: Number(resultVersion),
    iterationNumber:
      expectedCommand === "reissue" ? Number(value.iteration_number) : null,
    targetTeachingSessionId: String(value.target_teaching_session_id),
    targetRevisionSessionId: String(value.target_revision_session_id),
    assignments,
  };
}

function assertScheduleInput(input: TaskScheduleInput): TaskScheduleRecipientInput[] {
  if (
    !isUuid(input.classId) ||
    !isUuid(input.iterationId) ||
    !isUuid(input.targetRevisionSessionId) ||
    !isUuid(input.requestId)
  ) {
    throw new PrototypeDataError("Ugyldig identitet i planleggingsvalget.");
  }
  if (
    !isPositiveInteger(input.expectedIterationVersion) ||
    !isPositiveInteger(input.expectedTargetPlanLockVersion) ||
    !Array.isArray(input.recipients) ||
    input.recipients.length < 1 ||
    input.recipients.length > 200
  ) {
    throw new PrototypeDataError("Velg minst én elev og last siden på nytt.");
  }

  const sorted = [...input.recipients].sort((left, right) =>
    left.assignmentId.localeCompare(right.assignmentId),
  );
  const seen = new Set<string>();
  for (const recipient of sorted) {
    if (
      !isUuid(recipient.assignmentId) ||
      !isPositiveInteger(recipient.expectedStateVersion) ||
      !isPositiveInteger(recipient.expectedScheduleVersion) ||
      seen.has(recipient.assignmentId)
    ) {
      throw new PrototypeDataError("Mottakerlisten er ikke gyldig.");
    }
    seen.add(recipient.assignmentId);
  }
  return sorted;
}

function scheduleFailureMessage(message: string | undefined): string {
  if (
    message?.includes("changed after preview") ||
    message?.includes("changed after it was opened")
  ) {
    return "Oppgaven eller ukeplanen er endret. Last siden på nytt og prøv igjen.";
  }
  if (
    message?.includes("Target teaching session") ||
    message?.includes("active published plan")
  ) {
    return "Den valgte undervisningsøkten er ikke lenger tilgjengelig.";
  }
  if (message?.includes("Only unfinished")) {
    return "En ferdig oppgave kan ikke flyttes. Velg «Send ut på nytt» i stedet.";
  }
  if (message?.includes("already has this plan task")) {
    return "En av elevene har allerede denne oppgaven i den valgte økten.";
  }
  if (message?.includes("Request ID was already used")) {
    return "Valget er endret under lagring. Prøv på nytt.";
  }
  return "Kunne ikke lagre planleggingsvalget.";
}

export async function getTeacherTaskIterationWorkspace(
  classId: string,
): Promise<TeacherTaskIterationWorkspace> {
  const actor = await requireTaskScheduleActor(classId);
  const admin = getSupabaseAdminClient();
  const { data: iterations, error: iterationError } = await admin
    .from("task_iterations")
    .select(
      "id, task_definition_id, plan_task_id, iteration_number, reissued_from_iteration_id, management_version, created_at",
    )
    .eq("organization_id", actor.organizationId)
    .eq("class_id", actor.classId)
    .order("created_at", { ascending: false });
  if (iterationError) throw new PrototypeDataError();

  const iterationIds = iterations.map((iteration) => iteration.id);
  const taskDefinitionIds = [
    ...new Set(iterations.map((iteration) => iteration.task_definition_id)),
  ];
  const assignmentsResult = iterationIds.length
    ? await admin
        .from("task_assignments")
        .select(
          "id, iteration_id, plan_task_id, student_id, points_value_snapshot, scheduled_teaching_session_id, scheduled_from_revision_session_id, schedule_version",
        )
        .eq("organization_id", actor.organizationId)
        .eq("class_id", actor.classId)
        .in("iteration_id", iterationIds)
    : { data: [], error: null };
  if (assignmentsResult.error) throw new PrototypeDataError();
  const candidateStudentIds = [
    ...new Set(assignmentsResult.data.map((assignment) => assignment.student_id)),
  ];
  const [classMembershipsResult, organizationMembershipsResult] =
    candidateStudentIds.length
      ? await Promise.all([
          admin
            .from("class_memberships")
            .select("user_id")
            .eq("organization_id", actor.organizationId)
            .eq("class_id", actor.classId)
            .eq("role", "student")
            .in("user_id", candidateStudentIds),
          admin
            .from("memberships")
            .select("user_id")
            .eq("organization_id", actor.organizationId)
            .eq("role", "student")
            .in("user_id", candidateStudentIds),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];
  if (classMembershipsResult.error || organizationMembershipsResult.error) {
    throw new PrototypeDataError();
  }
  const organizationStudentIds = new Set(
    organizationMembershipsResult.data.map((membership) => membership.user_id),
  );
  const currentStudentIds = new Set(
    classMembershipsResult.data
      .map((membership) => membership.user_id)
      .filter((studentId) => organizationStudentIds.has(studentId)),
  );
  const assignments = assignmentsResult.data.filter((assignment) =>
    currentStudentIds.has(assignment.student_id),
  );
  const assignmentIds = assignments.map((assignment) => assignment.id);
  const studentIds = [...new Set(assignments.map((assignment) => assignment.student_id))];
  const revisionSessionIds = [
    ...new Set(
      assignments.flatMap((assignment) =>
        assignment.scheduled_from_revision_session_id
          ? [assignment.scheduled_from_revision_session_id]
          : [],
      ),
    ),
  ];

  const [definitionsResult, statesResult, profilesResult, sessionsResult, plansResult] =
    await Promise.all([
      taskDefinitionIds.length
        ? admin
            .from("task_definitions")
            .select("id, title, description, subject")
            .eq("organization_id", actor.organizationId)
            .eq("class_id", actor.classId)
            .in("id", taskDefinitionIds)
        : Promise.resolve({ data: [], error: null }),
      assignmentIds.length
        ? admin
            .from("student_task_state")
            .select("assignment_id, status, state_version")
            .eq("organization_id", actor.organizationId)
            .in("assignment_id", assignmentIds)
        : Promise.resolve({ data: [], error: null }),
      studentIds.length
        ? admin.from("profiles").select("id, display_name").in("id", studentIds)
        : Promise.resolve({ data: [], error: null }),
      revisionSessionIds.length
        ? admin
            .from("plan_revision_sessions")
            .select(
              "id, teaching_session_id, weekly_plan_id, title, subject, starts_at, ends_at",
            )
            .eq("organization_id", actor.organizationId)
            .eq("class_id", actor.classId)
            .in("id", revisionSessionIds)
        : Promise.resolve({ data: [], error: null }),
      admin
        .from("weekly_plans")
        .select("id, active_revision_id, lock_version")
        .eq("organization_id", actor.organizationId)
        .eq("class_id", actor.classId)
        .not("active_revision_id", "is", null),
    ]);
  if (
    definitionsResult.error ||
    statesResult.error ||
    profilesResult.error ||
    sessionsResult.error ||
    plansResult.error
  ) {
    throw new PrototypeDataError();
  }

  const activeRevisionIds = plansResult.data.flatMap((plan) =>
    plan.active_revision_id ? [plan.active_revision_id] : [],
  );
  const targetResult = activeRevisionIds.length
    ? await admin
        .from("plan_revision_sessions")
        .select(
          "id, teaching_session_id, weekly_plan_id, revision_id, title, subject, starts_at, ends_at",
        )
        .eq("organization_id", actor.organizationId)
        .eq("class_id", actor.classId)
        .in("revision_id", activeRevisionIds)
        .gt("starts_at", new Date().toISOString())
        .order("starts_at")
    : { data: [], error: null };
  if (targetResult.error) throw new PrototypeDataError();

  const confirmed = await requireTaskScheduleActor(classId);
  if (confirmed.staffAssignmentId !== actor.staffAssignmentId) {
    throw new AuthorizationError(
      "STAFF_ACCESS_ENDED",
      403,
      "Tilgangen ble endret mens siden ble lastet.",
    );
  }

  const definitionById = new Map(
    definitionsResult.data.map((definition) => [definition.id, definition]),
  );
  const stateByAssignment = new Map(
    statesResult.data.map((state) => [state.assignment_id, state]),
  );
  const nameByStudent = new Map(
    profilesResult.data.map((profile) => [profile.id, profile.display_name]),
  );
  const sessionById = new Map(
    sessionsResult.data.map((session) => [session.id, session]),
  );
  const planByRevision = new Map(
    plansResult.data.flatMap((plan) =>
      plan.active_revision_id ? [[plan.active_revision_id, plan] as const] : [],
    ),
  );
  const blockedTargets = new Map<string, Set<string>>();
  for (const assignment of assignments) {
    if (!assignment.plan_task_id || !assignment.scheduled_teaching_session_id) continue;
    const key = `${assignment.plan_task_id}:${assignment.student_id}`;
    const values = blockedTargets.get(key) ?? new Set<string>();
    values.add(assignment.scheduled_teaching_session_id);
    blockedTargets.set(key, values);
  }

  const workspaceIterations = iterations.flatMap((iteration) => {
    const definition = definitionById.get(iteration.task_definition_id);
    if (!definition) throw new PrototypeDataError();
    const recipients = assignments
      .filter((assignment) => assignment.iteration_id === iteration.id)
      .map((assignment): TaskIterationRecipientSummary => {
        const state = stateByAssignment.get(assignment.id);
        const studentName = nameByStudent.get(assignment.student_id);
        const session = assignment.scheduled_from_revision_session_id
          ? sessionById.get(assignment.scheduled_from_revision_session_id)
          : null;
        if (
          !state ||
          !studentName ||
          !session ||
          !assignment.scheduled_teaching_session_id ||
          !assignment.plan_task_id
        ) {
          throw new PrototypeDataError();
        }
        return {
          assignmentId: assignment.id,
          studentId: assignment.student_id,
          studentName,
          status: state.status,
          stateVersion: state.state_version,
          scheduleVersion: assignment.schedule_version,
          pointsValue: assignment.points_value_snapshot,
          scheduledSession: {
            teachingSessionId: assignment.scheduled_teaching_session_id,
            revisionSessionId: session.id,
            weeklyPlanId: session.weekly_plan_id,
            title: session.title,
            subject: session.subject,
            startsAt: session.starts_at,
            endsAt: session.ends_at,
          },
          blockedTargetTeachingSessionIds: [
            ...(blockedTargets.get(
              `${assignment.plan_task_id}:${assignment.student_id}`,
            ) ?? []),
          ],
        };
      })
      .sort((left, right) => left.studentName.localeCompare(right.studentName, "nb"));
    if (recipients.length === 0) return [];
    return [{
      id: iteration.id,
      managementVersion: iteration.management_version,
      iterationNumber: iteration.iteration_number,
      reissuedFromIterationId: iteration.reissued_from_iteration_id,
      taskDefinitionId: iteration.task_definition_id,
      planTaskId: iteration.plan_task_id,
      title: definition.title,
      description: definition.description,
      subject: definition.subject,
      createdAt: iteration.created_at,
      recipients,
    }];
  });

  return {
    iterations: workspaceIterations.sort((left, right) => {
      const leftStart = left.recipients[0]?.scheduledSession.startsAt ?? left.createdAt;
      const rightStart = right.recipients[0]?.scheduledSession.startsAt ?? right.createdAt;
      return rightStart.localeCompare(leftStart);
    }),
    targetSessions: targetResult.data.map((session) => {
      const plan = planByRevision.get(session.revision_id);
      if (!plan) throw new PrototypeDataError();
      return {
        teachingSessionId: session.teaching_session_id,
        revisionSessionId: session.id,
        weeklyPlanId: session.weekly_plan_id,
        planLockVersion: plan.lock_version,
        title: session.title,
        subject: session.subject,
        startsAt: session.starts_at,
        endsAt: session.ends_at,
      };
    }),
  };
}

async function runScheduleCommand(
  command: TaskScheduleCommand,
  input: TaskScheduleInput,
): Promise<TaskScheduleResult> {
  const recipients = assertScheduleInput(input);
  const actor = await requireTaskScheduleActor(input.classId);
  const rpcInput = {
    p_class_id: actor.classId,
    p_iteration_id: input.iterationId,
    p_assignment_ids: recipients.map((recipient) => recipient.assignmentId),
    p_expected_state_versions: recipients.map(
      (recipient) => recipient.expectedStateVersion,
    ),
    p_expected_schedule_versions: recipients.map(
      (recipient) => recipient.expectedScheduleVersion,
    ),
    p_target_revision_session_id: input.targetRevisionSessionId,
    p_expected_iteration_version: input.expectedIterationVersion,
    p_expected_target_plan_lock_version: input.expectedTargetPlanLockVersion,
    p_actor_id: actor.userId,
    p_staff_assignment_id: actor.staffAssignmentId,
    p_request_id: input.requestId,
  };
  const admin = getSupabaseAdminClient();
  const result =
    command === "move"
      ? await admin.rpc("move_task_iteration_v1", rpcInput)
      : await admin.rpc("reissue_task_iteration_v1", rpcInput);
  if (result.error || result.data === null) {
    await requireTaskScheduleActor(input.classId);
    throw new PrototypeDataError(scheduleFailureMessage(result.error?.message));
  }
  return parseScheduleResult(result.data, command, input, recipients);
}

export async function moveTaskIteration(
  input: TaskScheduleInput,
): Promise<TaskScheduleResult> {
  return runScheduleCommand("move", input);
}

export async function reissueTaskIteration(
  input: TaskScheduleInput,
): Promise<TaskScheduleResult> {
  return runScheduleCommand("reissue", input);
}

import "server-only";

import {
  requireAnyStudentActor,
  requireStaffCapability,
} from "@/server/auth/authorize";
import { isUuid } from "@/server/auth/policy";
import { PrototypeDataError } from "@/server/data/errors";
import { getSupabaseAdminClient } from "@/server/supabase/admin";
import type {
  HelpQueueSessionStatus,
  Json,
} from "@/server/supabase/database.types";

export type StudentHelpQueue = {
  id: string;
  classId: string;
  revisionSessionId: string;
  status: "open" | "closing";
};

export type StudentHelpState = {
  classId: string | null;
  queue: StudentHelpQueue | null;
  activeRequest: {
    id: string;
    taskAssignmentId: string | null;
  } | null;
};

export type ActiveStudentHelpRequest = NonNullable<
  StudentHelpState["activeRequest"]
>;

export type TeacherHelpSession = {
  id: string;
  title: string;
  subject: string | null;
  startsAt: string;
  endsAt: string;
};

export type TeacherHelpQueueItem = {
  id: string;
  studentName: string;
  status: "waiting" | "claimed";
  requestedAt: string;
  taskTitle: string | null;
  taskSubject: string | null;
  claimedByName: string | null;
  claimedByCurrentTeacher: boolean;
};

export type TeacherHelpQueueState = {
  currentSession: TeacherHelpSession | null;
  nextTransitionAt: string | null;
  queue: {
    id: string;
    status: "open" | "closing" | "closed";
    lockVersion: number;
    activityVersion: number;
  } | null;
  requests: TeacherHelpQueueItem[];
};

export type HelpQueueCommandResult = {
  queueSessionId: string;
  status: HelpQueueSessionStatus;
  lockVersion: number;
  activityVersion: number;
  changed: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function parseHelpQueueCommand(value: Json): HelpQueueCommandResult {
  if (
    !isRecord(value) ||
    typeof value.queue_session_id !== "string" ||
    !["open", "closing", "closed"].includes(String(value.status)) ||
    !isInteger(value.lock_version) ||
    value.lock_version < 1 ||
    !isInteger(value.activity_version) ||
    value.activity_version < 0 ||
    typeof value.changed !== "boolean"
  ) {
    throw new PrototypeDataError();
  }
  return {
    queueSessionId: value.queue_session_id,
    status: value.status as HelpQueueSessionStatus,
    lockVersion: value.lock_version,
    activityVersion: value.activity_version,
    changed: value.changed,
  };
}

function parseStudentHelpRequest(value: Json): ActiveStudentHelpRequest {
  if (
    !isRecord(value) ||
    typeof value.request_id !== "string" ||
    !["waiting", "claimed"].includes(String(value.status)) ||
    !(
      value.task_assignment_id === null ||
      typeof value.task_assignment_id === "string"
    )
  ) {
    throw new PrototypeDataError();
  }
  return {
    id: value.request_id,
    taskAssignmentId: value.task_assignment_id,
  };
}

function assertUuid(value: string, message: string): void {
  if (!isUuid(value)) throw new PrototypeDataError(message);
}

async function reconcileHelpQueues(classId?: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.rpc("reconcile_help_queue_sessions", {
    p_class_id: classId ?? null,
  });
  if (error) throw new PrototypeDataError();
}

export async function getStudentHelpState(
  currentRevisionSessionId: string | null,
  currentClassId: string | null,
): Promise<StudentHelpState> {
  if (currentRevisionSessionId !== null) {
    assertUuid(currentRevisionSessionId, "Ugyldig undervisningsøkt.");
  }
  if (currentClassId !== null) {
    assertUuid(currentClassId, "Ugyldig klasse.");
  }
  const actor = await requireAnyStudentActor();
  const admin = getSupabaseAdminClient();
  const readActiveRequest = async () => {
    const query = admin
      .from("help_requests")
      .select("id, class_id, queue_session_id, task_assignment_id")
      .eq("organization_id", actor.organizationId)
      .eq("student_id", actor.userId)
      .in("status", ["waiting", "claimed"])
      .not("queue_session_id", "is", null);
    return query
      .order("requested_at", { ascending: true })
      .limit(1)
      .maybeSingle();
  };
  const candidateRequest = await readActiveRequest();
  if (candidateRequest.error) throw new PrototypeDataError();
  const reconcileClassIds = [
    candidateRequest.data?.class_id ?? null,
    currentClassId,
  ].filter((classId, index, values): classId is string =>
    Boolean(classId) && values.indexOf(classId) === index,
  );
  for (const classId of reconcileClassIds) {
    await reconcileHelpQueues(classId);
  }
  const { data: activeRequest, error: requestError } =
    await readActiveRequest();
  if (requestError) throw new PrototypeDataError();

  const queueId = activeRequest?.queue_session_id ?? null;
  let queueQuery = admin
    .from("help_queue_sessions")
    .select(
      "id, organization_id, class_id, revision_session_id, status",
    )
    .eq("organization_id", actor.organizationId);
  if (queueId) {
    queueQuery = queueQuery
      .eq("id", queueId)
      .in("status", ["open", "closing"]);
  } else if (currentRevisionSessionId) {
    queueQuery = queueQuery
      .eq("revision_session_id", currentRevisionSessionId)
      .eq("class_id", currentClassId ?? "")
      .eq("status", "open");
  } else {
    return { classId: currentClassId, queue: null, activeRequest: null };
  }

  const { data: queue, error: queueError } = await queueQuery
    .limit(1)
    .maybeSingle();
  if (queueError) throw new PrototypeDataError();
  if (!queue) {
    // En samtidig resolve kan terminalisere forespørselen mellom de to lesingene.
    // Den autoritative slutt-tilstanden for eleven er da at hånden er borte.
    return { classId: currentClassId, queue: null, activeRequest: null };
  }

  const { data: membership, error: membershipError } = await admin
    .from("class_memberships")
    .select("class_id")
    .eq("organization_id", actor.organizationId)
    .eq("class_id", queue.class_id)
    .eq("user_id", actor.userId)
    .eq("role", "student")
    .maybeSingle();
  if (membershipError) throw new PrototypeDataError();
  if (!membership) {
    return { classId: currentClassId, queue: null, activeRequest: null };
  }

  return {
    classId: queue.class_id,
    queue: {
      id: queue.id,
      classId: queue.class_id,
      revisionSessionId: queue.revision_session_id,
      status: queue.status as "open" | "closing",
    },
    activeRequest: activeRequest
      ? {
          id: activeRequest.id,
          taskAssignmentId: activeRequest.task_assignment_id,
        }
      : null,
  };
}

export async function requestOwnHelp(
  queueSessionId: string,
  requestId: string,
  taskAssignmentId?: string,
): Promise<ActiveStudentHelpRequest> {
  assertUuid(queueSessionId, "Ugyldig hjelpekø.");
  assertUuid(requestId, "Ugyldig forespørsels-ID.");
  if (taskAssignmentId) {
    assertUuid(taskAssignmentId, "Ugyldig oppgave-ID.");
  }
  const actor = await requireAnyStudentActor();
  const admin = getSupabaseAdminClient();
  const { data: queueScope, error: queueScopeError } = await admin
    .from("help_queue_sessions")
    .select("organization_id, class_id")
    .eq("id", queueSessionId)
    .eq("organization_id", actor.organizationId)
    .single();
  if (queueScopeError || !queueScope) {
    throw new PrototypeDataError("Hjelpekøen er ikke tilgjengelig.");
  }
  await reconcileHelpQueues(queueScope.class_id);
  const { data, error } = await admin.rpc("request_student_help_v2", {
    p_queue_session_id: queueSessionId,
    p_student_id: actor.userId,
    p_request_id: requestId,
    p_task_assignment_id: taskAssignmentId ?? null,
  });
  if (error || data === null) {
    throw new PrototypeDataError("Hjelpekøen er ikke åpen lenger.");
  }
  return parseStudentHelpRequest(data);
}

export async function cancelOwnHelp(
  requestId: string,
  commandRequestId: string,
): Promise<void> {
  assertUuid(requestId, "Ugyldig køforespørsel.");
  assertUuid(commandRequestId, "Ugyldig forespørsels-ID.");
  const actor = await requireAnyStudentActor();
  const admin = getSupabaseAdminClient();
  const { data: requestScope, error: requestScopeError } = await admin
    .from("help_requests")
    .select("organization_id, class_id, student_id")
    .eq("id", requestId)
    .eq("organization_id", actor.organizationId)
    .eq("student_id", actor.userId)
    .single();
  if (requestScopeError || !requestScope) {
    throw new PrototypeDataError("Fant ikke hjelpeforespørselen.");
  }
  await reconcileHelpQueues(requestScope.class_id);
  const { error } = await admin.rpc("cancel_student_help_v2", {
    p_request_id: requestId,
    p_student_id: actor.userId,
    p_command_request_id: commandRequestId,
  });
  if (error) {
    throw new PrototypeDataError("Kunne ikke gå ut av hjelpekøen.");
  }
}

export async function getTeacherHelpQueue(
  classId: string,
): Promise<TeacherHelpQueueState> {
  const actor = await requireStaffCapability(classId, "help_queue.manage");
  const admin = getSupabaseAdminClient();
  await reconcileHelpQueues(actor.classId);

  const { data: liveQueue, error: queueError } = await admin
    .from("help_queue_sessions")
    .select(
      "id, revision_session_id, status, lock_version, activity_version",
    )
    .eq("organization_id", actor.organizationId)
    .eq("class_id", actor.classId)
    .in("status", ["open", "closing"])
    .limit(1)
    .maybeSingle();
  if (queueError) throw new PrototypeDataError();

  let sessionId = liveQueue?.revision_session_id ?? null;
  let nextTransitionAt: string | null = null;
  let lastClosedQueue: typeof liveQueue = null;
  if (!sessionId) {
    const { data: plans, error: planError } = await admin
      .from("weekly_plans")
      .select("active_revision_id")
      .eq("organization_id", actor.organizationId)
      .eq("class_id", actor.classId)
      .not("active_revision_id", "is", null);
    if (planError) throw new PrototypeDataError();
    const revisionIds = plans.flatMap((plan) =>
      plan.active_revision_id ? [plan.active_revision_id] : [],
    );
    if (revisionIds.length > 0) {
      const now = new Date().toISOString();
      const { data: currentSession, error: currentError } = await admin
        .from("plan_revision_sessions")
        .select("id")
        .eq("organization_id", actor.organizationId)
        .eq("class_id", actor.classId)
        .in("revision_id", revisionIds)
        .lte("starts_at", now)
        .gt("ends_at", now)
        .order("starts_at")
        .limit(1)
        .maybeSingle();
      if (currentError) throw new PrototypeDataError();
      sessionId = currentSession?.id ?? null;
      if (!sessionId) {
        const { data: nextSession, error: nextSessionError } = await admin
          .from("plan_revision_sessions")
          .select("starts_at")
          .eq("organization_id", actor.organizationId)
          .eq("class_id", actor.classId)
          .in("revision_id", revisionIds)
          .gt("starts_at", now)
          .order("starts_at")
          .limit(1)
          .maybeSingle();
        if (nextSessionError) throw new PrototypeDataError();
        nextTransitionAt = nextSession?.starts_at ?? null;
      }
    }
  }

  if (!liveQueue && !sessionId) {
    const { data: closedQueue, error: closedQueueError } = await admin
      .from("help_queue_sessions")
      .select(
        "id, revision_session_id, status, lock_version, activity_version",
      )
      .eq("organization_id", actor.organizationId)
      .eq("class_id", actor.classId)
      .eq("status", "closed")
      .order("closed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (closedQueueError) throw new PrototypeDataError();
    lastClosedQueue = closedQueue;
    sessionId = closedQueue?.revision_session_id ?? null;
  }

  const sessionResult = sessionId
    ? await admin
        .from("plan_revision_sessions")
        .select("id, title, subject, starts_at, ends_at")
        .eq("id", sessionId)
        .eq("organization_id", actor.organizationId)
        .eq("class_id", actor.classId)
        .single()
    : { data: null, error: null };
  if (sessionResult.error) throw new PrototypeDataError();

  let visibleQueue = liveQueue ?? lastClosedQueue;
  if (!visibleQueue && sessionId) {
    const { data: existingQueue, error: existingQueueError } = await admin
      .from("help_queue_sessions")
      .select(
        "id, revision_session_id, status, lock_version, activity_version",
      )
      .eq("organization_id", actor.organizationId)
      .eq("class_id", actor.classId)
      .eq("revision_session_id", sessionId)
      .maybeSingle();
    if (existingQueueError) throw new PrototypeDataError();
    visibleQueue = existingQueue;
  }

  const requestResult =
    visibleQueue && visibleQueue.status !== "closed"
    ? await admin
        .from("help_requests")
        .select(
          "id, student_id, status, requested_at, claimed_by, task_assignment_id",
        )
        .eq("organization_id", actor.organizationId)
        .eq("class_id", actor.classId)
        .eq("queue_session_id", visibleQueue.id)
        .in("status", ["waiting", "claimed"])
        .order("requested_at")
        .order("id")
    : { data: [], error: null };
  if (requestResult.error) throw new PrototypeDataError();

  const profileIds = [
    ...new Set(
      requestResult.data.flatMap((request) => [
        request.student_id,
        ...(request.claimed_by ? [request.claimed_by] : []),
      ]),
    ),
  ];
  const profileResult = profileIds.length
    ? await admin.from("profiles").select("id, display_name").in("id", profileIds)
    : { data: [], error: null };
  if (profileResult.error) throw new PrototypeDataError();
  const nameById = new Map(
    profileResult.data.map((profile) => [profile.id, profile.display_name]),
  );

  const assignmentIds = requestResult.data.flatMap((request) =>
    request.task_assignment_id ? [request.task_assignment_id] : [],
  );
  const assignmentResult = assignmentIds.length
    ? await admin
        .from("task_assignments")
        .select("id, task_definition_id")
        .in("id", assignmentIds)
        .eq("organization_id", actor.organizationId)
        .eq("class_id", actor.classId)
    : { data: [], error: null };
  if (assignmentResult.error) throw new PrototypeDataError();
  const definitionIds = [
    ...new Set(
      assignmentResult.data.map((assignment) => assignment.task_definition_id),
    ),
  ];
  const definitionResult = definitionIds.length
    ? await admin
        .from("task_definitions")
        .select("id, title, subject")
        .in("id", definitionIds)
        .eq("organization_id", actor.organizationId)
        .eq("class_id", actor.classId)
    : { data: [], error: null };
  if (definitionResult.error) throw new PrototypeDataError();
  const definitionById = new Map(
    definitionResult.data.map((definition) => [definition.id, definition]),
  );
  const taskByAssignmentId = new Map(
    assignmentResult.data.map((assignment) => [
      assignment.id,
      definitionById.get(assignment.task_definition_id),
    ]),
  );

  await requireStaffCapability(classId, "help_queue.manage");
  const currentSession = sessionResult.data
    ? {
        id: sessionResult.data.id,
        title: sessionResult.data.title,
        subject: sessionResult.data.subject,
        startsAt: sessionResult.data.starts_at,
        endsAt: sessionResult.data.ends_at,
      }
    : null;
  return {
    currentSession,
    nextTransitionAt,
    queue: visibleQueue
      ? {
          id: visibleQueue.id,
          status: visibleQueue.status as "open" | "closing" | "closed",
          lockVersion: visibleQueue.lock_version,
          activityVersion: visibleQueue.activity_version,
        }
      : null,
    requests: requestResult.data.map((request) => {
      const task = request.task_assignment_id
        ? taskByAssignmentId.get(request.task_assignment_id)
        : undefined;
      return {
        id: request.id,
        studentName: nameById.get(request.student_id) ?? "Elev",
        status: request.status as "waiting" | "claimed",
        requestedAt: request.requested_at,
        taskTitle: task?.title ?? null,
        taskSubject: task?.subject ?? null,
        claimedByName: request.claimed_by
          ? nameById.get(request.claimed_by) ?? "Ansatt"
          : null,
        claimedByCurrentTeacher: request.claimed_by === actor.userId,
      };
    }),
  };
}

export async function openTeacherHelpQueue(
  classId: string,
  revisionSessionId: string,
  requestId: string,
): Promise<HelpQueueCommandResult> {
  assertUuid(revisionSessionId, "Ugyldig undervisningsøkt.");
  assertUuid(requestId, "Ugyldig forespørsels-ID.");
  const actor = await requireStaffCapability(classId, "help_queue.manage");
  const admin = getSupabaseAdminClient();
  await reconcileHelpQueues(actor.classId);
  const { data, error } = await admin.rpc("open_help_queue_session", {
    p_class_id: actor.classId,
    p_revision_session_id: revisionSessionId,
    p_actor_id: actor.userId,
    p_staff_assignment_id: actor.staffAssignmentId,
    p_request_id: requestId,
  });
  if (error || data === null) {
    await requireStaffCapability(classId, "help_queue.manage");
    throw new PrototypeDataError("Kunne ikke åpne hjelpekøen.");
  }
  return parseHelpQueueCommand(data);
}

export async function closeTeacherHelpQueue(
  classId: string,
  queueSessionId: string,
  expectedVersion: number,
  requestId: string,
): Promise<HelpQueueCommandResult> {
  assertUuid(queueSessionId, "Ugyldig hjelpekø.");
  assertUuid(requestId, "Ugyldig forespørsels-ID.");
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
    throw new PrototypeDataError("Ugyldig køversjon.");
  }
  const actor = await requireStaffCapability(classId, "help_queue.manage");
  const admin = getSupabaseAdminClient();
  await reconcileHelpQueues(actor.classId);
  const { data, error } = await admin.rpc("begin_close_help_queue_session", {
    p_queue_session_id: queueSessionId,
    p_expected_version: expectedVersion,
    p_actor_id: actor.userId,
    p_staff_assignment_id: actor.staffAssignmentId,
    p_request_id: requestId,
  });
  if (error || data === null) {
    await requireStaffCapability(classId, "help_queue.manage");
    throw new PrototypeDataError("Køen ble endret. Oppdater og prøv igjen.");
  }
  return parseHelpQueueCommand(data);
}

async function requireStaffForSessionRequest(
  classId: string,
  requestId: string,
) {
  assertUuid(requestId, "Ugyldig køforespørsel.");
  const actor = await requireStaffCapability(classId, "help_queue.manage");
  const admin = getSupabaseAdminClient();
  const { data: request, error } = await admin
    .from("help_requests")
    .select("class_id, organization_id, queue_session_id")
    .eq("id", requestId)
    .eq("class_id", actor.classId)
    .eq("organization_id", actor.organizationId)
    .not("queue_session_id", "is", null)
    .single();
  if (error || !request) throw new PrototypeDataError("Fant ikke køforespørselen.");
  return actor;
}

export async function claimStudentHelp(
  classId: string,
  requestId: string,
  commandRequestId: string,
): Promise<void> {
  assertUuid(commandRequestId, "Ugyldig forespørsels-ID.");
  const actor = await requireStaffForSessionRequest(classId, requestId);
  const admin = getSupabaseAdminClient();
  await reconcileHelpQueues(actor.classId);
  const { error } = await admin.rpc("claim_student_help_v2", {
    p_request_id: requestId,
    p_actor_id: actor.userId,
    p_staff_assignment_id: actor.staffAssignmentId,
    p_command_request_id: commandRequestId,
  });
  if (error) {
    await requireStaffCapability(classId, "help_queue.manage");
    throw new PrototypeDataError("Forespørselen ble tatt av en annen ansatt.");
  }
}

export async function resolveStudentHelp(
  classId: string,
  requestId: string,
  commandRequestId: string,
): Promise<void> {
  assertUuid(commandRequestId, "Ugyldig forespørsels-ID.");
  const actor = await requireStaffForSessionRequest(classId, requestId);
  const admin = getSupabaseAdminClient();
  await reconcileHelpQueues(actor.classId);
  const { error } = await admin.rpc("resolve_student_help_v2", {
    p_request_id: requestId,
    p_actor_id: actor.userId,
    p_staff_assignment_id: actor.staffAssignmentId,
    p_command_request_id: commandRequestId,
  });
  if (error) {
    await requireStaffCapability(classId, "help_queue.manage");
    throw new PrototypeDataError("Kunne ikke markere eleven som ferdig hjulpet.");
  }
}

import "server-only";

import {
  requireAnyStudentActor,
  requireStaffCapability,
} from "@/server/auth/authorize";
import { isUuid } from "@/server/auth/policy";
import { PrototypeDataError } from "@/server/data/errors";
import { getSupabaseAdminClient } from "@/server/supabase/admin";
import type {
  HelpQueuePriorityReason,
  HelpQueueSessionStatus,
  Json,
} from "@/server/supabase/database.types";

export type HelpQueueMoveDirection = "first" | "up" | "down";
export type { HelpQueuePriorityReason };

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
  position: number;
  studentName: string;
  status: "waiting" | "claimed";
  requestedAt: string;
  ownershipVersion: number;
  taskTitle: string | null;
  taskSubject: string | null;
  claimedByName: string | null;
  claimedByCurrentTeacher: boolean;
  priority: {
    changedByName: string;
    changedAt: string;
    reasonCode: HelpQueuePriorityReason;
  } | null;
};

export type TeacherHelpTransferTarget = {
  staffAssignmentId: string;
  displayName: string;
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
  transferTargets: TeacherHelpTransferTarget[];
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

function isHelpQueuePriorityReason(
  value: unknown,
): value is HelpQueuePriorityReason {
  return [
    "support_needed_now",
    "short_clarification",
    "staff_coordination",
  ].includes(String(value));
}

type TeacherHelpQueueSnapshot = {
  queue: {
    id: string;
    organization_id: string;
    class_id: string;
    revision_session_id: string;
    status: "open" | "closing" | "closed";
    lock_version: number;
    activity_version: number;
  };
  orderRows: Array<{
    request_id: string;
    position: number;
    last_changed_by: string | null;
    last_changed_at: string | null;
    last_reason_code: HelpQueuePriorityReason | null;
  }>;
  requestRows: Array<{
    id: string;
    student_id: string;
    status: "waiting" | "claimed";
    requested_at: string;
    claimed_by: string | null;
    task_assignment_id: string | null;
    ownership_version: number;
  }>;
};

function isNullableUuid(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && isUuid(value));
}

function parseTeacherHelpQueueSnapshot(
  value: Json,
  organizationId: string,
  classId: string,
): TeacherHelpQueueSnapshot | null {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    !isRecord(value.queue) ||
    !Array.isArray(value.order_rows) ||
    !Array.isArray(value.request_rows)
  ) {
    throw new PrototypeDataError();
  }
  const queue = value.queue;
  if (
    typeof queue.id !== "string" ||
    !isUuid(queue.id) ||
    queue.organization_id !== organizationId ||
    queue.class_id !== classId ||
    typeof queue.revision_session_id !== "string" ||
    !isUuid(queue.revision_session_id) ||
    !["open", "closing", "closed"].includes(String(queue.status)) ||
    !isInteger(queue.lock_version) ||
    queue.lock_version < 1 ||
    !isInteger(queue.activity_version) ||
    queue.activity_version < 0
  ) {
    throw new PrototypeDataError();
  }

  const orderRows = value.order_rows.map((row, index) => {
    if (
      !isRecord(row) ||
      typeof row.request_id !== "string" ||
      !isUuid(row.request_id) ||
      !isInteger(row.position) ||
      row.position !== index + 1 ||
      !isNullableUuid(row.last_changed_by) ||
      !(
        row.last_changed_at === null ||
        typeof row.last_changed_at === "string"
      ) ||
      !(
        row.last_reason_code === null ||
        isHelpQueuePriorityReason(row.last_reason_code)
      )
    ) {
      throw new PrototypeDataError();
    }
    return {
      request_id: row.request_id,
      position: row.position,
      last_changed_by: row.last_changed_by,
      last_changed_at: row.last_changed_at,
      last_reason_code: row.last_reason_code,
    };
  });
  const requestRows = value.request_rows.map((row) => {
    if (
      !isRecord(row) ||
      typeof row.id !== "string" ||
      !isUuid(row.id) ||
      typeof row.student_id !== "string" ||
      !isUuid(row.student_id) ||
      !["waiting", "claimed"].includes(String(row.status)) ||
      typeof row.requested_at !== "string" ||
      !isNullableUuid(row.claimed_by) ||
      !isNullableUuid(row.task_assignment_id) ||
      !isInteger(row.ownership_version) ||
      row.ownership_version < 1
    ) {
      throw new PrototypeDataError();
    }
    return {
      id: row.id,
      student_id: row.student_id,
      status: row.status as "waiting" | "claimed",
      requested_at: row.requested_at,
      claimed_by: row.claimed_by,
      task_assignment_id: row.task_assignment_id,
      ownership_version: row.ownership_version,
    };
  });
  const requestIds = new Set(requestRows.map((request) => request.id));
  const orderedRequestIds = new Set(
    orderRows.map((orderRow) => orderRow.request_id),
  );
  if (
    requestIds.size !== requestRows.length ||
    orderedRequestIds.size !== orderRows.length ||
    orderRows.length !== requestRows.length ||
    orderRows.some((orderRow) => !requestIds.has(orderRow.request_id)) ||
    (queue.status === "closed" && orderRows.length > 0)
  ) {
    throw new PrototypeDataError();
  }
  return {
    queue: {
      id: queue.id,
      organization_id: organizationId,
      class_id: classId,
      revision_session_id: queue.revision_session_id,
      status: queue.status as "open" | "closing" | "closed",
      lock_version: queue.lock_version,
      activity_version: queue.activity_version,
    },
    orderRows,
    requestRows,
  };
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

function assertPositiveVersion(value: number, message: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new PrototypeDataError(message);
  }
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

  async function readAtomicActiveQueue(queueId: string) {
    const { data, error } = await admin.rpc(
      "read_help_queue_staff_snapshot_v1",
      {
        p_organization_id: actor.organizationId,
        p_class_id: actor.classId,
        p_queue_session_id: queueId,
      },
    );
    if (error) throw new PrototypeDataError();
    const snapshot = parseTeacherHelpQueueSnapshot(
      data,
      actor.organizationId,
      actor.classId,
    );
    return (
      snapshot ?? {
        queue: null,
        orderRows: [],
        requestRows: [],
      }
    );
  }

  const queueSnapshot =
    visibleQueue && visibleQueue.status !== "closed"
      ? await readAtomicActiveQueue(visibleQueue.id)
      : { queue: visibleQueue, orderRows: [], requestRows: [] };
  visibleQueue = queueSnapshot.queue;
  const orderRows = queueSnapshot.orderRows;
  const requestRows = queueSnapshot.requestRows;
  const requestById = new Map(
    requestRows.map((request) => [request.id, request]),
  );

  const nowIso = new Date().toISOString();
  const { data: targetScopes, error: targetScopeError } = await admin
    .from("staff_assignment_class_scopes")
    .select("assignment_id")
    .eq("organization_id", actor.organizationId)
    .eq("class_id", actor.classId);
  if (targetScopeError) throw new PrototypeDataError();
  const scopedAssignmentIds = targetScopes.map((scope) => scope.assignment_id);
  const targetAssignmentResult = scopedAssignmentIds.length
    ? await admin
        .from("staff_assignments")
        .select("id, user_id, profile_version, starts_at")
        .eq("organization_id", actor.organizationId)
        .in("id", scopedAssignmentIds)
        .is("revoked_at", null)
        .lte("starts_at", nowIso)
        .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
        .order("starts_at", { ascending: false })
        .order("id")
    : { data: [], error: null };
  if (targetAssignmentResult.error) throw new PrototypeDataError();
  const activeAssignmentIds = targetAssignmentResult.data.map(
    (assignment) => assignment.id,
  );
  const targetCapabilityResult = activeAssignmentIds.length
    ? await admin
        .from("staff_assignment_capabilities")
        .select("assignment_id, profile_version")
        .in("assignment_id", activeAssignmentIds)
        .eq("capability", "help_queue.manage")
    : { data: [], error: null };
  if (targetCapabilityResult.error) throw new PrototypeDataError();
  const targetUserIds = [
    ...new Set(targetAssignmentResult.data.map((assignment) => assignment.user_id)),
  ];
  const targetMembershipResult = targetUserIds.length
    ? await admin
        .from("memberships")
        .select("user_id")
        .eq("organization_id", actor.organizationId)
        .in("user_id", targetUserIds)
        .in("role", ["owner", "teacher"])
    : { data: [], error: null };
  if (targetMembershipResult.error) throw new PrototypeDataError();
  const activeCapabilityKeys = new Set(
    targetCapabilityResult.data.map(
      (capability) =>
        `${capability.assignment_id}:${capability.profile_version}`,
    ),
  );
  const adultUserIds = new Set(
    targetMembershipResult.data.map((membership) => membership.user_id),
  );
  const targetAssignmentByUser = new Map<
    string,
    (typeof targetAssignmentResult.data)[number]
  >();
  for (const assignment of targetAssignmentResult.data) {
    if (
      assignment.user_id === actor.userId ||
      !adultUserIds.has(assignment.user_id) ||
      !activeCapabilityKeys.has(
        `${assignment.id}:${assignment.profile_version}`,
      ) ||
      targetAssignmentByUser.has(assignment.user_id)
    ) {
      continue;
    }
    targetAssignmentByUser.set(assignment.user_id, assignment);
  }

  const profileIds = [
    ...new Set(
      requestRows.flatMap((request) => [
        request.student_id,
        ...(request.claimed_by ? [request.claimed_by] : []),
      ]),
    ),
    ...orderRows.flatMap((orderRow) =>
      orderRow.last_changed_by ? [orderRow.last_changed_by] : [],
    ),
    ...targetAssignmentByUser.keys(),
  ];
  const profileResult = profileIds.length
    ? await admin.from("profiles").select("id, display_name").in("id", profileIds)
    : { data: [], error: null };
  if (profileResult.error) throw new PrototypeDataError();
  const nameById = new Map(
    profileResult.data.map((profile) => [profile.id, profile.display_name]),
  );

  const assignmentIds = requestRows.flatMap((request) =>
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
    requests: orderRows.map((orderRow) => {
      const request = requestById.get(orderRow.request_id);
      if (!request || orderRow.position === null) throw new PrototypeDataError();
      const task = request.task_assignment_id
        ? taskByAssignmentId.get(request.task_assignment_id)
        : undefined;
      const hasPriorityMetadata =
        orderRow.last_changed_at !== null ||
        orderRow.last_reason_code !== null ||
        orderRow.last_changed_by !== null;
      if (
        hasPriorityMetadata &&
        (orderRow.last_changed_at === null ||
          !isHelpQueuePriorityReason(orderRow.last_reason_code))
      ) {
        throw new PrototypeDataError();
      }
      return {
        id: request.id,
        position: orderRow.position,
        studentName: nameById.get(request.student_id) ?? "Elev",
        status: request.status as "waiting" | "claimed",
        requestedAt: request.requested_at,
        ownershipVersion: request.ownership_version,
        taskTitle: task?.title ?? null,
        taskSubject: task?.subject ?? null,
        claimedByName: request.claimed_by
          ? nameById.get(request.claimed_by) ?? "Ansatt"
          : null,
        claimedByCurrentTeacher: request.claimed_by === actor.userId,
        priority: hasPriorityMetadata
          ? {
              changedByName: orderRow.last_changed_by
                ? nameById.get(orderRow.last_changed_by) ?? "Ansatt"
                : "Tidligere ansatt",
              changedAt: orderRow.last_changed_at!,
              reasonCode: orderRow.last_reason_code as HelpQueuePriorityReason,
            }
          : null,
      };
    }),
    transferTargets: [...targetAssignmentByUser.entries()]
      .map(([userId, assignment]) => ({
        staffAssignmentId: assignment.id,
        displayName: nameById.get(userId) ?? "Ansatt",
      }))
      .sort((first, second) =>
        first.displayName.localeCompare(second.displayName, "nb"),
      ),
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
  expectedOwnershipVersion: number,
  commandRequestId: string,
): Promise<void> {
  assertPositiveVersion(expectedOwnershipVersion, "Ugyldig forespørselsversjon.");
  assertUuid(commandRequestId, "Ugyldig forespørsels-ID.");
  const actor = await requireStaffForSessionRequest(classId, requestId);
  const admin = getSupabaseAdminClient();
  await reconcileHelpQueues(actor.classId);
  const { error } = await admin.rpc("claim_student_help_v3", {
    p_request_id: requestId,
    p_expected_ownership_version: expectedOwnershipVersion,
    p_actor_id: actor.userId,
    p_staff_assignment_id: actor.staffAssignmentId,
    p_command_request_id: commandRequestId,
  });
  if (error) {
    await requireStaffCapability(classId, "help_queue.manage");
    if (error.message.includes("ownership version is stale")) {
      throw new PrototypeDataError("Køen ble endret. Prøv igjen.");
    }
    throw new PrototypeDataError("Forespørselen ble tatt av en annen ansatt.");
  }
}

export async function resolveStudentHelp(
  classId: string,
  requestId: string,
  expectedOwnershipVersion: number,
  commandRequestId: string,
): Promise<void> {
  assertPositiveVersion(expectedOwnershipVersion, "Ugyldig forespørselsversjon.");
  assertUuid(commandRequestId, "Ugyldig forespørsels-ID.");
  const actor = await requireStaffForSessionRequest(classId, requestId);
  const admin = getSupabaseAdminClient();
  await reconcileHelpQueues(actor.classId);
  const { error } = await admin.rpc("resolve_student_help_v3", {
    p_request_id: requestId,
    p_expected_ownership_version: expectedOwnershipVersion,
    p_actor_id: actor.userId,
    p_staff_assignment_id: actor.staffAssignmentId,
    p_command_request_id: commandRequestId,
  });
  if (error) {
    await requireStaffCapability(classId, "help_queue.manage");
    if (error.message.includes("ownership version is stale")) {
      throw new PrototypeDataError("Køen ble endret. Prøv igjen.");
    }
    throw new PrototypeDataError("Kunne ikke markere eleven som ferdig hjulpet.");
  }
}

export async function reorderStudentHelp(
  classId: string,
  queueSessionId: string,
  requestId: string,
  direction: HelpQueueMoveDirection,
  reasonCode: HelpQueuePriorityReason,
  expectedActivityVersion: number,
  commandRequestId: string,
): Promise<void> {
  assertUuid(queueSessionId, "Ugyldig hjelpekø.");
  assertUuid(commandRequestId, "Ugyldig forespørsels-ID.");
  if (!["first", "up", "down"].includes(direction)) {
    throw new PrototypeDataError("Ugyldig flytteretning.");
  }
  if (!isHelpQueuePriorityReason(reasonCode)) {
    throw new PrototypeDataError("Velg en gyldig grunn.");
  }
  if (!Number.isSafeInteger(expectedActivityVersion) || expectedActivityVersion < 0) {
    throw new PrototypeDataError("Ugyldig køversjon.");
  }
  const actor = await requireStaffForSessionRequest(classId, requestId);
  const admin = getSupabaseAdminClient();
  await reconcileHelpQueues(actor.classId);
  const { error } = await admin.rpc("reorder_student_help_v1", {
    p_queue_session_id: queueSessionId,
    p_request_id: requestId,
    p_direction: direction,
    p_reason_code: reasonCode,
    p_expected_activity_version: expectedActivityVersion,
    p_actor_id: actor.userId,
    p_staff_assignment_id: actor.staffAssignmentId,
    p_command_request_id: commandRequestId,
  });
  if (error) {
    await requireStaffCapability(classId, "help_queue.manage");
    throw new PrototypeDataError("Køen ble endret. Prøv igjen.");
  }
}

export async function releaseStudentHelp(
  classId: string,
  requestId: string,
  expectedOwnershipVersion: number,
  commandRequestId: string,
): Promise<void> {
  assertPositiveVersion(expectedOwnershipVersion, "Ugyldig forespørselsversjon.");
  assertUuid(commandRequestId, "Ugyldig forespørsels-ID.");
  const actor = await requireStaffForSessionRequest(classId, requestId);
  const admin = getSupabaseAdminClient();
  await reconcileHelpQueues(actor.classId);
  const { error } = await admin.rpc("release_student_help_v1", {
    p_request_id: requestId,
    p_expected_ownership_version: expectedOwnershipVersion,
    p_actor_id: actor.userId,
    p_staff_assignment_id: actor.staffAssignmentId,
    p_command_request_id: commandRequestId,
  });
  if (error) {
    await requireStaffCapability(classId, "help_queue.manage");
    throw new PrototypeDataError(
      error.message.includes("ownership version is stale")
        ? "Køen ble endret. Prøv igjen."
        : "Du hjelper ikke lenger denne eleven.",
    );
  }
}

export async function transferStudentHelp(
  classId: string,
  requestId: string,
  expectedOwnershipVersion: number,
  targetStaffAssignmentId: string,
  commandRequestId: string,
): Promise<void> {
  assertPositiveVersion(expectedOwnershipVersion, "Ugyldig forespørselsversjon.");
  assertUuid(targetStaffAssignmentId, "Ugyldig ansattoppdrag.");
  assertUuid(commandRequestId, "Ugyldig forespørsels-ID.");
  const actor = await requireStaffForSessionRequest(classId, requestId);
  const admin = getSupabaseAdminClient();
  await reconcileHelpQueues(actor.classId);
  const { error } = await admin.rpc("transfer_student_help_v1", {
    p_request_id: requestId,
    p_expected_ownership_version: expectedOwnershipVersion,
    p_actor_id: actor.userId,
    p_staff_assignment_id: actor.staffAssignmentId,
    p_target_staff_assignment_id: targetStaffAssignmentId,
    p_command_request_id: commandRequestId,
  });
  if (error) {
    await requireStaffCapability(classId, "help_queue.manage");
    if (error.message.includes("ownership version is stale")) {
      throw new PrototypeDataError("Køen ble endret. Prøv igjen.");
    }
    if (error.message.includes("assignments do not authorize")) {
      throw new PrototypeDataError(
        "Den ansatte har ikke lenger tilgang. Velg en annen.",
      );
    }
    throw new PrototypeDataError("Du hjelper ikke lenger denne eleven.");
  }
}

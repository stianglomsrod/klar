import "server-only";

import { requireAnyStudentActor, requireClassRole } from "@/server/auth/authorize";
import { isUuid } from "@/server/auth/policy";
import { PrototypeDataError } from "@/server/data/errors";
import { getSupabaseAdminClient } from "@/server/supabase/admin";
import type { HelpRequestStatus } from "@/server/supabase/database.types";

export type StudentHelpState = {
  classId: string | null;
  activeRequest: {
    id: string;
    status: "waiting" | "claimed";
  } | null;
};

export type TeacherHelpQueueItem = {
  id: string;
  studentName: string;
  status: "waiting" | "claimed";
  requestedAt: string;
  claimedByCurrentTeacher: boolean;
};

function isActiveStatus(status: HelpRequestStatus): status is "waiting" | "claimed" {
  return status === "waiting" || status === "claimed";
}

export async function getStudentHelpState(): Promise<StudentHelpState> {
  const actor = await requireAnyStudentActor();
  const admin = getSupabaseAdminClient();
  await admin.rpc("expire_help_requests");

  const { data: classMembership, error: classError } = await admin
    .from("class_memberships")
    .select("class_id")
    .eq("user_id", actor.userId)
    .eq("role", "student")
    .limit(1)
    .maybeSingle();
  if (classError) throw new PrototypeDataError();
  if (!classMembership) return { classId: null, activeRequest: null };

  const { data: request, error: requestError } = await admin
    .from("help_requests")
    .select("id, status")
    .eq("student_id", actor.userId)
    .in("status", ["waiting", "claimed"])
    .gt("expires_at", new Date().toISOString())
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (requestError) throw new PrototypeDataError();

  return {
    classId: classMembership.class_id,
    activeRequest:
      request && isActiveStatus(request.status)
        ? { id: request.id, status: request.status }
        : null,
  };
}

export async function requestOwnHelp(
  classId: string,
  taskAssignmentId?: string,
): Promise<void> {
  const actor = await requireClassRole(classId, ["student"]);
  if (taskAssignmentId && !isUuid(taskAssignmentId)) {
    throw new PrototypeDataError("Ugyldig oppgave-ID.");
  }

  const admin = getSupabaseAdminClient();
  const { error } = await admin.rpc("request_student_help", {
    p_class_id: actor.classId,
    p_student_id: actor.userId,
    p_task_assignment_id: taskAssignmentId ?? null,
  });
  if (error) throw new PrototypeDataError("Kunne ikke be om hjelp.");
}

export async function cancelOwnHelp(requestId: string): Promise<void> {
  if (!isUuid(requestId)) throw new PrototypeDataError("Ugyldig kø-ID.");
  const actor = await requireAnyStudentActor();
  const admin = getSupabaseAdminClient();
  const { error } = await admin.rpc("cancel_student_help", {
    p_request_id: requestId,
    p_student_id: actor.userId,
  });
  if (error) throw new PrototypeDataError("Kunne ikke avbryte hjelpeforespørselen.");
}

export async function getTeacherHelpQueue(
  classId: string,
): Promise<TeacherHelpQueueItem[]> {
  const actor = await requireClassRole(classId, ["teacher"]);
  const admin = getSupabaseAdminClient();
  await admin.rpc("expire_help_requests");
  const { data: requests, error } = await admin
    .from("help_requests")
    .select("id, student_id, status, requested_at, claimed_by")
    .eq("class_id", actor.classId)
    .in("status", ["waiting", "claimed"])
    .gt("expires_at", new Date().toISOString())
    .order("requested_at");
  if (error) throw new PrototypeDataError();

  const studentIds = [...new Set(requests.map((request) => request.student_id))];
  const profiles = studentIds.length
    ? await admin.from("profiles").select("id, display_name").in("id", studentIds)
    : { data: [], error: null };
  if (profiles.error) throw new PrototypeDataError();
  const nameById = new Map(
    profiles.data.map((profile) => [profile.id, profile.display_name]),
  );

  return requests
    .filter((request) => isActiveStatus(request.status))
    .map((request) => ({
      id: request.id,
      studentName: nameById.get(request.student_id) ?? "Elev",
      status: request.status as "waiting" | "claimed",
      requestedAt: request.requested_at,
      claimedByCurrentTeacher: request.claimed_by === actor.userId,
    }));
}

async function requireTeacherForRequest(requestId: string) {
  if (!isUuid(requestId)) throw new PrototypeDataError("Ugyldig kø-ID.");
  const admin = getSupabaseAdminClient();
  const { data: request, error } = await admin
    .from("help_requests")
    .select("class_id")
    .eq("id", requestId)
    .single();
  if (error || !request) throw new PrototypeDataError("Fant ikke køplassen.");
  return requireClassRole(request.class_id, ["teacher"]);
}

export async function claimStudentHelp(requestId: string): Promise<void> {
  const actor = await requireTeacherForRequest(requestId);
  const admin = getSupabaseAdminClient();
  const { error } = await admin.rpc("claim_student_help", {
    p_request_id: requestId,
    p_teacher_id: actor.userId,
  });
  if (error) throw new PrototypeDataError("Kunne ikke ta køplassen.");
}

export async function resolveStudentHelp(requestId: string): Promise<void> {
  const actor = await requireTeacherForRequest(requestId);
  const admin = getSupabaseAdminClient();
  const { error } = await admin.rpc("resolve_student_help", {
    p_request_id: requestId,
    p_teacher_id: actor.userId,
  });
  if (error) throw new PrototypeDataError("Kunne ikke fullføre køplassen.");
}

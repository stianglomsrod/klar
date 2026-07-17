"use server";

import { revalidatePath } from "next/cache";
import { isPrototypeDataError } from "@/server/data/errors";
import {
  cancelOwnHelp,
  claimStudentHelp,
  closeTeacherHelpQueue,
  openTeacherHelpQueue,
  requestOwnHelp,
  resolveStudentHelp,
} from "@/server/help/help-service";
import type { ActiveStudentHelpRequest } from "@/server/help/help-service";
import { authorizationFailure, type ActionFailure } from "./action-errors";

type MutationResult = { success: true } | ActionFailure;
type StudentHelpMutationResult =
  | { success: true; activeRequest: ActiveStudentHelpRequest | null }
  | { success: false; error: string };

function resultFromError(
  error: unknown,
  fallback: string,
): ActionFailure {
  const authorization = authorizationFailure(error);
  if (authorization) return authorization;
  if (isPrototypeDataError(error)) return { success: false, error: error.message };
  return { success: false, error: fallback };
}

export async function requestOwnHelpAction(
  queueSessionId: string,
  requestId: string,
  taskAssignmentId?: string,
): Promise<StudentHelpMutationResult> {
  try {
    const activeRequest = await requestOwnHelp(
      queueSessionId,
      requestId,
      taskAssignmentId,
    );
    revalidatePath("/v3/student");
    return { success: true, activeRequest };
  } catch (error) {
    return resultFromError(error, "Kunne ikke be om hjelp.");
  }
}

export async function cancelOwnHelpAction(
  requestId: string,
  commandRequestId: string,
): Promise<StudentHelpMutationResult> {
  try {
    await cancelOwnHelp(requestId, commandRequestId);
    revalidatePath("/v3/student");
    return { success: true, activeRequest: null };
  } catch (error) {
    return resultFromError(error, "Kunne ikke avbryte hjelpeforespørselen.");
  }
}

export async function openTeacherHelpQueueAction(
  classId: string,
  revisionSessionId: string,
  requestId: string,
): Promise<MutationResult> {
  try {
    await openTeacherHelpQueue(classId, revisionSessionId, requestId);
    revalidatePath(`/v3/teacher/classes/${classId}`);
    revalidatePath("/v3/student");
    return { success: true };
  } catch (error) {
    return resultFromError(error, "Kunne ikke åpne hjelpekøen.");
  }
}

export async function closeTeacherHelpQueueAction(
  classId: string,
  queueSessionId: string,
  expectedVersion: number,
  requestId: string,
): Promise<MutationResult> {
  try {
    await closeTeacherHelpQueue(
      classId,
      queueSessionId,
      expectedVersion,
      requestId,
    );
    revalidatePath(`/v3/teacher/classes/${classId}`);
    revalidatePath("/v3/student");
    return { success: true };
  } catch (error) {
    return resultFromError(error, "Kunne ikke stenge hjelpekøen.");
  }
}

export async function claimStudentHelpAction(
  classId: string,
  requestId: string,
  commandRequestId: string,
): Promise<MutationResult> {
  try {
    await claimStudentHelp(classId, requestId, commandRequestId);
    revalidatePath(`/v3/teacher/classes/${classId}`);
    return { success: true };
  } catch (error) {
    return resultFromError(error, "Kunne ikke ta køplassen.");
  }
}

export async function resolveStudentHelpAction(
  classId: string,
  requestId: string,
  commandRequestId: string,
): Promise<MutationResult> {
  try {
    await resolveStudentHelp(classId, requestId, commandRequestId);
    revalidatePath(`/v3/teacher/classes/${classId}`);
    return { success: true };
  } catch (error) {
    return resultFromError(error, "Kunne ikke fullføre køplassen.");
  }
}

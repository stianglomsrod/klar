"use server";

import { revalidatePath } from "next/cache";
import { isAuthorizationError } from "@/server/auth/errors";
import { isPrototypeDataError } from "@/server/data/errors";
import {
  cancelOwnHelp,
  claimStudentHelp,
  requestOwnHelp,
  resolveStudentHelp,
} from "@/server/help/help-service";
import type { ActiveStudentHelpRequest } from "@/server/help/help-service";

type MutationResult = { success: true } | { success: false; error: string };
type StudentHelpMutationResult =
  | { success: true; activeRequest: ActiveStudentHelpRequest | null }
  | { success: false; error: string };

function resultFromError(
  error: unknown,
  fallback: string,
): { success: false; error: string } {
  if (isAuthorizationError(error) || isPrototypeDataError(error)) {
    return { success: false, error: error.message };
  }
  return { success: false, error: fallback };
}

export async function requestOwnHelpAction(
  classId: string,
  taskAssignmentId?: string,
): Promise<StudentHelpMutationResult> {
  try {
    const activeRequest = await requestOwnHelp(classId, taskAssignmentId);
    revalidatePath("/v3/student");
    return { success: true, activeRequest };
  } catch (error) {
    return resultFromError(error, "Kunne ikke be om hjelp.");
  }
}

export async function cancelOwnHelpAction(
  requestId: string,
): Promise<StudentHelpMutationResult> {
  try {
    await cancelOwnHelp(requestId);
    revalidatePath("/v3/student");
    return { success: true, activeRequest: null };
  } catch (error) {
    return resultFromError(error, "Kunne ikke avbryte hjelpeforespørselen.");
  }
}

export async function claimStudentHelpAction(
  classId: string,
  requestId: string,
): Promise<MutationResult> {
  try {
    await claimStudentHelp(requestId);
    revalidatePath(`/v3/teacher/classes/${classId}`);
    return { success: true };
  } catch (error) {
    return resultFromError(error, "Kunne ikke ta køplassen.");
  }
}

export async function resolveStudentHelpAction(
  classId: string,
  requestId: string,
): Promise<MutationResult> {
  try {
    await resolveStudentHelp(requestId);
    revalidatePath(`/v3/teacher/classes/${classId}`);
    return { success: true };
  } catch (error) {
    return resultFromError(error, "Kunne ikke fullføre køplassen.");
  }
}

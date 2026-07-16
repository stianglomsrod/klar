"use server";

import { revalidatePath } from "next/cache";
import { isAuthorizationError } from "@/server/auth/errors";
import { isPrototypeDataError } from "@/server/data/errors";
import {
  completeOwnTask,
  publishClassTask,
  reopenStudentTaskForStaff,
  type TaskProgressResult,
  undoOwnTaskCompletion,
} from "@/server/tasks/task-service";
import type { TaskReopenReason } from "@/server/supabase/database.types";
import { authorizationFailure, type ActionFailure } from "./action-errors";

type MutationResult = { success: true } | ActionFailure;
export type TaskProgressMutationResult =
  | { success: true; progress: TaskProgressResult }
  | ActionFailure;

export async function publishClassTaskAction(input: {
  classId: string;
  title: string;
  description?: string;
  subject?: string;
  estimatedMinutes?: number;
  supportLevel?: number;
}): Promise<MutationResult> {
  try {
    await publishClassTask(input);
    revalidatePath(`/v3/teacher/classes/${input.classId}`);
    return { success: true };
  } catch (error) {
    const authorization = authorizationFailure(error);
    if (authorization) return authorization;
    if (isPrototypeDataError(error)) return { success: false, error: error.message };
    return { success: false, error: "Kunne ikke publisere oppgaven." };
  }
}

export async function completeOwnTaskAction(
  assignmentId: string,
  requestId: string,
): Promise<TaskProgressMutationResult> {
  try {
    const progress = await completeOwnTask(assignmentId, requestId);
    revalidatePath("/v3/student");
    return { success: true, progress };
  } catch (error) {
    if (isAuthorizationError(error) || isPrototypeDataError(error)) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Kunne ikke fullføre oppgaven." };
  }
}

export async function undoOwnTaskCompletionAction(
  assignmentId: string,
  requestId: string,
): Promise<TaskProgressMutationResult> {
  try {
    const progress = await undoOwnTaskCompletion(assignmentId, requestId);
    revalidatePath("/v3/student");
    return { success: true, progress };
  } catch (error) {
    if (isAuthorizationError(error) || isPrototypeDataError(error)) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Kunne ikke angre fullføringen." };
  }
}

export async function reopenStudentTaskAction(input: {
  classId: string;
  assignmentId: string;
  requestId: string;
  reasonCode: TaskReopenReason;
  studentMessage?: string;
}): Promise<TaskProgressMutationResult> {
  try {
    const progress = await reopenStudentTaskForStaff(input);
    revalidatePath(`/v3/teacher/classes/${input.classId}`);
    revalidatePath("/v3/student");
    return { success: true, progress };
  } catch (error) {
    const authorization = authorizationFailure(error);
    if (authorization) return authorization;
    if (isPrototypeDataError(error)) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Kunne ikke åpne oppgaven igjen." };
  }
}

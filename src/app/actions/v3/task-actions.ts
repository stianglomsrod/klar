"use server";

import { revalidatePath } from "next/cache";
import { isAuthorizationError } from "@/server/auth/errors";
import { isPrototypeDataError } from "@/server/data/errors";
import {
  publishClassTask,
  updateOwnTaskStatus,
} from "@/server/tasks/task-service";
import type { StudentTaskStatus } from "@/server/supabase/database.types";

type MutationResult = { success: true } | { success: false; error: string };

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
    if (isAuthorizationError(error) || isPrototypeDataError(error)) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Kunne ikke publisere oppgaven." };
  }
}

export async function updateOwnTaskStatusAction(
  assignmentId: string,
  status: StudentTaskStatus,
): Promise<MutationResult> {
  try {
    await updateOwnTaskStatus(assignmentId, status);
    revalidatePath("/v3/student");
    return { success: true };
  } catch (error) {
    if (isAuthorizationError(error) || isPrototypeDataError(error)) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Kunne ikke oppdatere oppgaven." };
  }
}

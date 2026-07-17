"use server";

import { revalidatePath } from "next/cache";
import { isPrototypeDataError } from "@/server/data/errors";
import {
  moveTaskIteration,
  reissueTaskIteration,
  type TaskScheduleInput,
  type TaskScheduleResult,
} from "@/server/tasks/task-iteration-service";
import { authorizationFailure, type ActionFailure } from "./action-errors";

export type TaskScheduleMutationResult =
  | { success: true; schedule: TaskScheduleResult }
  | ActionFailure;

async function runTaskScheduleAction(
  command: "move" | "reissue",
  input: TaskScheduleInput,
): Promise<TaskScheduleMutationResult> {
  try {
    const schedule =
      command === "move"
        ? await moveTaskIteration(input)
        : await reissueTaskIteration(input);
    revalidatePath(`/v3/teacher/classes/${input.classId}`);
    revalidatePath("/v3/student");
    return { success: true, schedule };
  } catch (error) {
    const authorization = authorizationFailure(error);
    if (authorization) return authorization;
    if (isPrototypeDataError(error)) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Kunne ikke lagre planleggingsvalget." };
  }
}

export async function moveTaskIterationAction(
  input: TaskScheduleInput,
): Promise<TaskScheduleMutationResult> {
  return runTaskScheduleAction("move", input);
}

export async function reissueTaskIterationAction(
  input: TaskScheduleInput,
): Promise<TaskScheduleMutationResult> {
  return runTaskScheduleAction("reissue", input);
}

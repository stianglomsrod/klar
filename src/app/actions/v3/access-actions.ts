"use server";

import { revalidatePath } from "next/cache";
import { authorizationFailure, type ActionFailure } from "./action-errors";
import {
  createStaffAssignment,
  revokeStaffAssignment,
} from "@/server/staff/staff-service";
import type { AssignableStaffJobLabel } from "@/server/auth/policy";
import { isPrototypeDataError } from "@/server/data/errors";

type AccessMutationResult = { success: true } | ActionFailure;

function failure(error: unknown, fallback: string): ActionFailure {
  const authorization = authorizationFailure(error);
  if (authorization) return authorization;
  if (isPrototypeDataError(error)) return { success: false, error: error.message };
  return { success: false, error: fallback };
}

export async function createStaffAssignmentAction(input: {
  organizationId: string;
  targetUserId: string;
  classId: string;
  jobLabel: AssignableStaffJobLabel;
  startsAt: string;
  endsAt: string;
  idempotencyKey: string;
}): Promise<AccessMutationResult> {
  try {
    await createStaffAssignment(input);
    revalidatePath("/v3/teacher");
    revalidatePath("/v3/teacher/access");
    return { success: true };
  } catch (error) {
    return failure(error, "Kunne ikke opprette oppdraget.");
  }
}

export async function revokeStaffAssignmentAction(input: {
  organizationId: string;
  assignmentId: string;
}): Promise<AccessMutationResult> {
  try {
    await revokeStaffAssignment(input);
    revalidatePath("/v3/teacher");
    revalidatePath("/v3/teacher/access");
    return { success: true };
  } catch (error) {
    return failure(error, "Kunne ikke trekke tilbake oppdraget.");
  }
}

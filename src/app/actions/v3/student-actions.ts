"use server";

import { isAuthorizationError } from "@/server/auth/errors";
import {
  createPrototypeStudent,
  StudentProvisioningError,
  type CreatedPrototypeStudent,
} from "@/server/students/create-student";

export type CreatePrototypeStudentResult =
  | { success: true; student: CreatedPrototypeStudent }
  | { success: false; error: string };

export async function createPrototypeStudentAction(
  classId: string,
  displayName: string,
): Promise<CreatePrototypeStudentResult> {
  try {
    const student = await createPrototypeStudent(classId, displayName);
    return { success: true, student };
  } catch (error) {
    if (isAuthorizationError(error) || error instanceof StudentProvisioningError) {
      return { success: false, error: error.message };
    }

    return { success: false, error: "Kunne ikke opprette prototypeeleven." };
  }
}

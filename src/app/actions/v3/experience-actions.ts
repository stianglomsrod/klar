"use server";

import { revalidatePath } from "next/cache";
import { isAuthorizationError } from "@/server/auth/errors";
import { isPrototypeDataError } from "@/server/data/errors";
import {
  updateClassStudentExperience,
  updateOwnStudentExperience,
  type StudentExperience,
} from "@/server/students/experience-service";

type ExperienceResult =
  | { success: true; experience: StudentExperience }
  | { success: false; error: string };

function failure(error: unknown): ExperienceResult {
  if (isAuthorizationError(error) || isPrototypeDataError(error)) {
    return { success: false, error: error.message };
  }
  return { success: false, error: "Kunne ikke lagre visningsvalgene." };
}

export async function updateOwnStudentExperienceAction(
  input: StudentExperience,
): Promise<ExperienceResult> {
  try {
    const experience = await updateOwnStudentExperience(input);
    revalidatePath("/v3/student");
    return { success: true, experience };
  } catch (error) {
    return failure(error);
  }
}

export async function updateClassStudentExperienceAction(
  classId: string,
  studentId: string,
  input: StudentExperience,
): Promise<ExperienceResult> {
  try {
    const experience = await updateClassStudentExperience(classId, studentId, input);
    revalidatePath(`/v3/teacher/classes/${classId}`);
    return { success: true, experience };
  } catch (error) {
    return failure(error);
  }
}

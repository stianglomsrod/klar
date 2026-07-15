"use server";

import { revalidatePath } from "next/cache";
import { isPrototypeDataError } from "@/server/data/errors";
import {
  updateClassStudentExperience,
  updateOwnStudentExperience,
  type StudentExperience,
} from "@/server/students/experience-service";
import { authorizationFailure, type ActionFailure } from "./action-errors";

type ExperienceResult =
  | { success: true; experience: StudentExperience }
  | ActionFailure;

function failure(error: unknown): ExperienceResult {
  const authorization = authorizationFailure(error);
  if (authorization) return authorization;
  if (isPrototypeDataError(error)) return { success: false, error: error.message };
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

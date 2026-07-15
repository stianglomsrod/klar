"use server";

import { revalidatePath } from "next/cache";
import { isAuthorizationError } from "@/server/auth/errors";
import {
  createTeacherClass,
  type TeacherClassSummary,
} from "@/server/classes/class-service";
import { isPrototypeDataError } from "@/server/data/errors";

type CreateClassResult =
  | { success: true; classId: TeacherClassSummary["id"] }
  | { success: false; error: string };

export async function createTeacherClassAction(input: {
  organizationId: string;
  name: string;
  academicYear?: string;
}): Promise<CreateClassResult> {
  try {
    const classId = await createTeacherClass(input);
    revalidatePath("/v3/teacher");
    return { success: true, classId };
  } catch (error) {
    if (isAuthorizationError(error) || isPrototypeDataError(error)) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Kunne ikke opprette klassen." };
  }
}

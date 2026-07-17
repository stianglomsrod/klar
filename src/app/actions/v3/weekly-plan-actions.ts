"use server";

import { revalidatePath } from "next/cache";
import { isAuthorizationError } from "@/server/auth/errors";
import { isPrototypeDataError } from "@/server/data/errors";
import {
  publishInitialWeeklyPlan,
  type InitialWeeklyPlanInput,
  type WeeklyPlanPublishResult,
} from "@/server/plans/weekly-plan-service";
import { authorizationFailure, type ActionFailure } from "./action-errors";

type PublishInitialWeeklyPlanActionResult =
  | { success: true; publication: WeeklyPlanPublishResult }
  | ActionFailure;

export async function publishInitialWeeklyPlanAction(
  classId: string,
  requestId: string,
  plan: InitialWeeklyPlanInput,
): Promise<PublishInitialWeeklyPlanActionResult> {
  try {
    const publication = await publishInitialWeeklyPlan({
      classId,
      requestId,
      expectedLockVersion: 0,
      plan,
    });
    revalidatePath(`/v3/teacher/classes/${classId}`);
    revalidatePath("/v3/student");
    return { success: true, publication };
  } catch (error) {
    const authorization = authorizationFailure(error);
    if (authorization) return authorization;
    if (isAuthorizationError(error) || isPrototypeDataError(error)) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Ukeplanen kunne ikke publiseres." };
  }
}

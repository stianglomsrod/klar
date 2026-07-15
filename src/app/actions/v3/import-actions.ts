"use server";

import { revalidatePath } from "next/cache";
import { isAuthorizationError } from "@/server/auth/errors";
import { isPrototypeDataError } from "@/server/data/errors";
import {
  previewImportedPlan,
  publishImportedPlan,
} from "@/server/import/import-service";
import {
  isPlanImportError,
  type ImportedPlanPreview,
  type ImportedTask,
} from "@/server/import/types";
import { MAX_PLAN_FILE_BYTES } from "@/server/import/docx-safety";
import { authorizationFailure, type ActionFailure } from "./action-errors";

type PreviewResult =
  | { success: true; preview: ImportedPlanPreview }
  | ActionFailure;

type PublishResult =
  | { success: true; publishedCount: number }
  | ActionFailure;

function knownError(error: unknown): string | null {
  if (
    isAuthorizationError(error) ||
    isPrototypeDataError(error) ||
    isPlanImportError(error)
  ) {
    return error.message;
  }
  return null;
}

function failure(error: unknown, fallback: string): ActionFailure {
  const authorization = authorizationFailure(error);
  if (authorization) return authorization;
  return { success: false, error: knownError(error) ?? fallback };
}

export async function previewImportedPlanAction(
  classId: string,
  formData: FormData,
): Promise<PreviewResult> {
  try {
    const file = formData.get("plan");
    if (!(file instanceof File)) {
      return { success: false, error: "Velg en DOCX-fil." };
    }
    if (file.size < 1 || file.size > MAX_PLAN_FILE_BYTES) {
      return { success: false, error: "DOCX-filen må være mellom 1 byte og 2 MB." };
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const preview = await previewImportedPlan(classId, {
      fileName: file.name,
      mimeType: file.type,
      bytes,
    });
    return { success: true, preview };
  } catch (error) {
    return failure(error, "Dokumentet kunne ikke tolkes.");
  }
}

export async function publishImportedPlanAction(
  classId: string,
  tasks: ImportedTask[],
): Promise<PublishResult> {
  try {
    const publishedCount = await publishImportedPlan(classId, tasks);
    revalidatePath(`/v3/teacher/classes/${classId}`);
    return { success: true, publishedCount };
  } catch (error) {
    return failure(error, "Planen kunne ikke publiseres.");
  }
}

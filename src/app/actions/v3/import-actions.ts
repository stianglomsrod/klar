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

type PreviewResult =
  | { success: true; preview: ImportedPlanPreview }
  | { success: false; error: string };

type PublishResult =
  | { success: true; publishedCount: number }
  | { success: false; error: string };

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

export async function previewImportedPlanAction(
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
    const preview = await previewImportedPlan({
      fileName: file.name,
      mimeType: file.type,
      bytes,
    });
    return { success: true, preview };
  } catch (error) {
    return {
      success: false,
      error: knownError(error) ?? "Dokumentet kunne ikke tolkes.",
    };
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
    return {
      success: false,
      error: knownError(error) ?? "Planen kunne ikke publiseres.",
    };
  }
}

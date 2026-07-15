import "server-only";

import { requireStaffCapability } from "@/server/auth/authorize";
import { PrototypeDataError } from "@/server/data/errors";
import { getSupabaseAdminClient } from "@/server/supabase/admin";
import type { Json } from "@/server/supabase/database.types";
import { RuleBasedDocxImporter } from "./rule-based-docx";
import type { ImportedPlanPreview, ImportedTask, PlanImportInput } from "./types";
import { PlanImportError } from "./types";

export async function previewImportedPlan(
  classId: string,
  input: PlanImportInput,
): Promise<ImportedPlanPreview> {
  await requireStaffCapability(classId, "plan.preview");
  const importer = new RuleBasedDocxImporter();
  const preview = await importer.parse(input);
  await requireStaffCapability(classId, "plan.preview");
  return preview;
}

export async function publishImportedPlan(
  classId: string,
  tasks: ImportedTask[],
): Promise<number> {
  const actor = await requireStaffCapability(classId, "plan.publish");
  if (tasks.length < 1 || tasks.length > 50) {
    throw new PlanImportError("Planen må inneholde mellom 1 og 50 oppgaver.");
  }

  const payload: Json[] = tasks.map((task) => {
    const title = task.title.trim().replace(/\s+/g, " ");
    if (title.length < 1 || title.length > 160) {
      throw new PlanImportError("Alle oppgaver må ha en gyldig tittel.");
    }
    if (![1, 2, 3].includes(task.supportLevel)) {
      throw new PlanImportError("Alle oppgaver må ha et gyldig støttenivå.");
    }
    return {
      title,
      description: task.description?.trim() || null,
      subject: task.subject?.trim() || null,
      estimated_minutes: task.estimatedMinutes,
      support_level: task.supportLevel,
    };
  });

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("publish_plan_to_class", {
    p_class_id: actor.classId,
    p_actor_id: actor.userId,
    p_staff_assignment_id: actor.staffAssignmentId,
    p_tasks: payload,
  });
  if (error || !data) {
    await requireStaffCapability(classId, "plan.publish");
    throw new PrototypeDataError("Kunne ikke publisere planen.");
  }
  return data.length;
}

import "server-only";

import { requireAnyStudentActor, requireClassRole } from "@/server/auth/authorize";
import { isUuid } from "@/server/auth/policy";
import { PrototypeDataError } from "@/server/data/errors";
import { getSupabaseAdminClient } from "@/server/supabase/admin";

export type SupportLevel = 1 | 2 | 3;

export type StudentExperience = {
  supportLevel: SupportLevel;
  progressEnabled: boolean;
};

const DEFAULT_EXPERIENCE: StudentExperience = {
  supportLevel: 2,
  progressEnabled: false,
};

function validateExperience(input: StudentExperience): StudentExperience {
  if (![1, 2, 3].includes(input.supportLevel)) {
    throw new PrototypeDataError("Støttenivået må være 1, 2 eller 3.");
  }
  if (typeof input.progressEnabled !== "boolean") {
    throw new PrototypeDataError("Fremdriftsvisningen må være av eller på.");
  }
  return input;
}

export async function getOwnStudentExperience(): Promise<StudentExperience> {
  const actor = await requireAnyStudentActor();
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("student_experience_settings")
    .select("support_level, progress_enabled")
    .eq("organization_id", actor.organizationId)
    .eq("student_id", actor.userId)
    .maybeSingle();
  if (error) throw new PrototypeDataError();
  if (!data) return DEFAULT_EXPERIENCE;
  return {
    supportLevel: data.support_level as SupportLevel,
    progressEnabled: data.progress_enabled,
  };
}

export async function updateOwnStudentExperience(
  input: StudentExperience,
): Promise<StudentExperience> {
  const actor = await requireAnyStudentActor();
  return persistExperience(
    actor.organizationId,
    actor.userId,
    actor.userId,
    validateExperience(input),
  );
}

export async function updateClassStudentExperience(
  classId: string,
  studentId: string,
  input: StudentExperience,
): Promise<StudentExperience> {
  if (!isUuid(studentId)) throw new PrototypeDataError("Ugyldig elev-ID.");
  const actor = await requireClassRole(classId, ["teacher"]);
  return persistExperience(
    actor.organizationId,
    studentId,
    actor.userId,
    validateExperience(input),
  );
}

async function persistExperience(
  organizationId: string,
  studentId: string,
  actorId: string,
  input: StudentExperience,
): Promise<StudentExperience> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("update_student_experience", {
    p_organization_id: organizationId,
    p_student_id: studentId,
    p_actor_id: actorId,
    p_support_level: input.supportLevel,
    p_progress_enabled: input.progressEnabled,
  });
  if (error || !data) {
    throw new PrototypeDataError("Kunne ikke lagre elevens visningsvalg.");
  }
  return {
    supportLevel: data.support_level as SupportLevel,
    progressEnabled: data.progress_enabled,
  };
}

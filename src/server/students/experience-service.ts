import "server-only";

import {
  requireAnyStudentActor,
  requireStaffCapability,
} from "@/server/auth/authorize";
import { isUuid } from "@/server/auth/policy";
import { PrototypeDataError } from "@/server/data/errors";
import { getSupabaseAdminClient } from "@/server/supabase/admin";

export type SupportLevel = 1 | 2 | 3;

export type StudentExperience = {
  supportLevel: SupportLevel;
  progressEnabled: boolean;
  flowerRewardsAllowed: boolean;
  flowerRewardsVisible: boolean;
};

export type StudentExperiencePreferences = Pick<
  StudentExperience,
  "supportLevel" | "progressEnabled" | "flowerRewardsVisible"
>;

export type StaffStudentExperienceUpdate = Pick<
  StudentExperience,
  "supportLevel" | "flowerRewardsAllowed"
>;

const DEFAULT_EXPERIENCE: StudentExperience = {
  supportLevel: 2,
  progressEnabled: false,
  flowerRewardsAllowed: false,
  flowerRewardsVisible: true,
};

function validateExperience(
  input: StudentExperiencePreferences,
): StudentExperiencePreferences {
  if (![1, 2, 3].includes(input.supportLevel)) {
    throw new PrototypeDataError("Støttenivået må være 1, 2 eller 3.");
  }
  if (typeof input.progressEnabled !== "boolean") {
    throw new PrototypeDataError("Fremdriftsvisningen må være av eller på.");
  }
  if (typeof input.flowerRewardsVisible !== "boolean") {
    throw new PrototypeDataError("Blomsterhagen må være synlig eller skjult.");
  }
  return input;
}

export async function getOwnStudentExperience(): Promise<StudentExperience> {
  const actor = await requireAnyStudentActor();
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("student_experience_settings")
    .select(
      "support_level, progress_enabled, flower_rewards_allowed, flower_rewards_visible",
    )
    .eq("organization_id", actor.organizationId)
    .eq("student_id", actor.userId)
    .maybeSingle();
  if (error) throw new PrototypeDataError();
  if (!data) return DEFAULT_EXPERIENCE;
  return {
    supportLevel: data.support_level as SupportLevel,
    progressEnabled: data.progress_enabled,
    flowerRewardsAllowed: data.flower_rewards_allowed,
    flowerRewardsVisible: data.flower_rewards_visible,
  };
}

export async function updateOwnStudentExperience(
  input: StudentExperiencePreferences,
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
  input: StaffStudentExperienceUpdate,
): Promise<StudentExperience> {
  if (!isUuid(studentId)) throw new PrototypeDataError("Ugyldig elev-ID.");
  const actor = await requireStaffCapability(
    classId,
    "student_support.update",
  );
  if (![1, 2, 3].includes(input.supportLevel)) {
    throw new PrototypeDataError("Støttenivået må være 1, 2 eller 3.");
  }
  if (typeof input.flowerRewardsAllowed !== "boolean") {
    throw new PrototypeDataError("Blomsterhagerrammen må være av eller på.");
  }
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc(
    "update_student_experience_for_staff_v2",
    {
      p_organization_id: actor.organizationId,
      p_class_id: actor.classId,
      p_student_id: studentId,
      p_actor_id: actor.userId,
      p_staff_assignment_id: actor.staffAssignmentId,
      p_support_level: input.supportLevel,
      p_flower_rewards_allowed: input.flowerRewardsAllowed,
    },
  );
  if (error || !data) {
    await requireStaffCapability(classId, "student_support.update");
    throw new PrototypeDataError("Kunne ikke lagre elevens visningsvalg.");
  }
  return {
    supportLevel: data.support_level as SupportLevel,
    progressEnabled: data.progress_enabled,
    flowerRewardsAllowed: data.flower_rewards_allowed,
    flowerRewardsVisible: data.flower_rewards_visible,
  };
}

async function persistExperience(
  organizationId: string,
  studentId: string,
  actorId: string,
  input: StudentExperiencePreferences,
): Promise<StudentExperience> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("update_student_experience_v2", {
    p_organization_id: organizationId,
    p_student_id: studentId,
    p_actor_id: actorId,
    p_support_level: input.supportLevel,
    p_progress_enabled: input.progressEnabled,
    p_flower_rewards_visible: input.flowerRewardsVisible,
  });
  if (error || !data) {
    throw new PrototypeDataError("Kunne ikke lagre elevens visningsvalg.");
  }
  return {
    supportLevel: data.support_level as SupportLevel,
    progressEnabled: data.progress_enabled,
    flowerRewardsAllowed: data.flower_rewards_allowed,
    flowerRewardsVisible: data.flower_rewards_visible,
  };
}

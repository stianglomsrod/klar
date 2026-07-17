import "server-only";

import {
  isFlowerRewardColor,
  parseFlowerRewardClaimResult,
  parseFlowerRewardProjection,
  type FlowerRewardClaimResult,
  type FlowerRewardProjection,
} from "@/lib/flower-rewards";
import { requireAnyStudentActor } from "@/server/auth/authorize";
import { isUuid } from "@/server/auth/policy";
import { PrototypeDataError } from "@/server/data/errors";
import { getSupabaseAdminClient } from "@/server/supabase/admin";
import type { FlowerRewardColor } from "@/server/supabase/database.types";
import { createClient as createSessionClient } from "@/utils/supabase/server";

export async function getOwnFlowerRewards(): Promise<FlowerRewardProjection> {
  const actor = await requireAnyStudentActor();
  const sessionClient = await createSessionClient();
  const { data, error } = await sessionClient.rpc("get_my_flower_rewards_v1", {
    p_organization_id: actor.organizationId,
  });
  if (error || data === null) throw new PrototypeDataError();
  return parseFlowerRewardProjection(data);
}

export async function claimOwnFlowerReward(input: {
  entitlementId: string;
  requestId: string;
  flowerColor: FlowerRewardColor;
}): Promise<FlowerRewardClaimResult> {
  if (!isUuid(input.entitlementId)) {
    throw new PrototypeDataError("Ugyldig belønningstildeling.");
  }
  if (!isUuid(input.requestId)) {
    throw new PrototypeDataError("Ugyldig forespørsels-ID.");
  }
  if (!isFlowerRewardColor(input.flowerColor)) {
    throw new PrototypeDataError("Velg en gyldig farge.");
  }

  const actor = await requireAnyStudentActor();
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("claim_student_flower_reward_v1", {
    p_organization_id: actor.organizationId,
    p_entitlement_id: input.entitlementId,
    p_student_id: actor.userId,
    p_actor_id: actor.userId,
    p_request_id: input.requestId,
    p_flower_color: input.flowerColor,
  });
  if (error || data === null) {
    throw new PrototypeDataError("Kunne ikke lagre kronbladet.");
  }
  return parseFlowerRewardClaimResult(
    data,
    input.entitlementId,
    input.requestId,
  );
}

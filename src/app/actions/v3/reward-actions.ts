"use server";

import { revalidatePath } from "next/cache";
import { isAuthorizationError } from "@/server/auth/errors";
import { isPrototypeDataError } from "@/server/data/errors";
import {
  claimOwnFlowerReward,
} from "@/server/rewards/flower-reward-service";
import type { FlowerRewardClaimResult } from "@/lib/flower-rewards";
import type { FlowerRewardColor } from "@/server/supabase/database.types";

export type FlowerRewardMutationResult =
  | { success: true; claim: FlowerRewardClaimResult }
  | { success: false; error: string };

export async function claimOwnFlowerRewardAction(input: {
  entitlementId: string;
  requestId: string;
  flowerColor: FlowerRewardColor;
}): Promise<FlowerRewardMutationResult> {
  try {
    const claim = await claimOwnFlowerReward(input);
    revalidatePath("/v3/student", "layout");
    revalidatePath("/v3/student/rewards");
    return { success: true, claim };
  } catch (error) {
    if (isAuthorizationError(error) || isPrototypeDataError(error)) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Kunne ikke lagre kronbladet." };
  }
}

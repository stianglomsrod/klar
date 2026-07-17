import { isUuid } from "../server/auth/policy.ts";
import { PrototypeDataError } from "../server/data/errors.ts";
import type {
  FlowerRewardColor,
  Json,
  RewardClaimType,
} from "../server/supabase/database.types.ts";

export const FLOWER_REWARD_COLORS = [
  "red",
  "turquoise",
  "green",
  "pink",
  "purple",
  "orange",
  "yellow",
  "blue",
] as const satisfies readonly FlowerRewardColor[];

export const FLOWER_REWARD_PRESENTATION: Record<
  FlowerRewardColor,
  { label: string; color: string }
> = {
  red: { label: "Rød", color: "#dc5b70" },
  turquoise: { label: "Turkis", color: "#269c99" },
  green: { label: "Grønn", color: "#5b9f55" },
  pink: { label: "Rosa", color: "#dc78ad" },
  purple: { label: "Lilla", color: "#8065c9" },
  orange: { label: "Oransje", color: "#df7d38" },
  yellow: { label: "Gul", color: "#e9bd3f" },
  blue: { label: "Blå", color: "#477ac4" },
};

export type FlowerRewardEntitlement = {
  entitlementId: string;
  level: number;
  availableAt: string;
};

export type FlowerRewardClaim = {
  claimId: string;
  entitlementId: string;
  level: number;
  rewardType: RewardClaimType;
  flowerColor: FlowerRewardColor;
  collectionSequence: number;
  flowerNumber: number;
  petalNumber: number;
  claimedAt: string;
};

export type FlowerRewardProjection = {
  rewardsAllowed: boolean;
  rewardsVisible: boolean;
  progressEnabled: boolean;
  availableEntitlements: FlowerRewardEntitlement[];
  claims: FlowerRewardClaim[];
};

export type FlowerRewardClaimResult = FlowerRewardClaim & {
  requestId: string;
  changed: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

export function isFlowerRewardColor(value: unknown): value is FlowerRewardColor {
  return (
    typeof value === "string" &&
    FLOWER_REWARD_COLORS.includes(value as FlowerRewardColor)
  );
}

export function getFlowerPlacement(collectionSequence: number): {
  flowerNumber: number;
  petalNumber: number;
} {
  if (!Number.isSafeInteger(collectionSequence) || collectionSequence < 1) {
    throw new PrototypeDataError("Ugyldig plassering i blomsterhagen.");
  }
  return {
    flowerNumber: Math.floor((collectionSequence - 1) / 5) + 1,
    petalNumber: ((collectionSequence - 1) % 5) + 1,
  };
}

export function getPendingFlowerRewardLabel(count: number): string {
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new PrototypeDataError("Ugyldig antall ventende kronblader.");
  }
  return count === 1
    ? "Et kronblad venter i blomsterhagen"
    : `${count} kronblader venter i blomsterhagen`;
}

function parseEntitlement(value: unknown): FlowerRewardEntitlement {
  if (
    !isRecord(value) ||
    !isUuid(String(value.entitlement_id)) ||
    !isInteger(value.level) ||
    value.level < 2 ||
    typeof value.available_at !== "string"
  ) {
    throw new PrototypeDataError();
  }
  return {
    entitlementId: String(value.entitlement_id),
    level: value.level,
    availableAt: value.available_at,
  };
}

function parseClaim(value: unknown): FlowerRewardClaim {
  if (
    !isRecord(value) ||
    !isUuid(String(value.claim_id)) ||
    !isUuid(String(value.entitlement_id)) ||
    !isInteger(value.level) ||
    value.level < 2 ||
    value.reward_type !== "flower_petal_v1" ||
    !isFlowerRewardColor(value.flower_color) ||
    !isInteger(value.collection_sequence) ||
    !isInteger(value.flower_number) ||
    !isInteger(value.petal_number) ||
    typeof value.claimed_at !== "string"
  ) {
    throw new PrototypeDataError();
  }
  const placement = getFlowerPlacement(value.collection_sequence);
  if (
    placement.flowerNumber !== value.flower_number ||
    placement.petalNumber !== value.petal_number
  ) {
    throw new PrototypeDataError();
  }
  return {
    claimId: String(value.claim_id),
    entitlementId: String(value.entitlement_id),
    level: value.level,
    rewardType: value.reward_type,
    flowerColor: value.flower_color,
    collectionSequence: value.collection_sequence,
    flowerNumber: value.flower_number,
    petalNumber: value.petal_number,
    claimedAt: value.claimed_at,
  };
}

export function parseFlowerRewardProjection(
  value: Json,
): FlowerRewardProjection {
  if (
    !isRecord(value) ||
    typeof value.rewards_allowed !== "boolean" ||
    typeof value.rewards_visible !== "boolean" ||
    typeof value.progress_enabled !== "boolean" ||
    !Array.isArray(value.available_entitlements) ||
    !Array.isArray(value.claims)
  ) {
    throw new PrototypeDataError();
  }

  const availableEntitlements = value.available_entitlements.map(parseEntitlement);
  const claims = value.claims.map(parseClaim);
  if (
    availableEntitlements.some(
      (entitlement, index) =>
        index > 0 &&
        availableEntitlements[index - 1].level >= entitlement.level,
    ) ||
    claims.some(
      (claim, index) =>
        index > 0 && claims[index - 1].collectionSequence >= claim.collectionSequence,
    )
  ) {
    throw new PrototypeDataError();
  }

  return {
    rewardsAllowed: value.rewards_allowed,
    rewardsVisible: value.rewards_visible,
    progressEnabled: value.progress_enabled,
    availableEntitlements,
    claims,
  };
}

export function parseFlowerRewardClaimResult(
  value: Json,
  expectedEntitlementId: string,
  expectedRequestId: string,
): FlowerRewardClaimResult {
  if (
    !isRecord(value) ||
    typeof value.changed !== "boolean" ||
    value.entitlement_id !== expectedEntitlementId ||
    value.request_id !== expectedRequestId
  ) {
    throw new PrototypeDataError();
  }
  return {
    ...parseClaim(value),
    requestId: expectedRequestId,
    changed: value.changed,
  };
}

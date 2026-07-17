import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  FLOWER_REWARD_COLORS,
  FLOWER_REWARD_PRESENTATION,
  getFlowerPlacement,
  getPendingFlowerRewardLabel,
  isFlowerRewardColor,
  parseFlowerRewardClaimResult,
  parseFlowerRewardProjection,
} from "../src/lib/flower-rewards.ts";

const entitlementId = "10000000-0000-4000-8000-000000000001";
const claimId = "20000000-0000-4000-8000-000000000001";
const requestId = "30000000-0000-4000-8000-000000000001";

function claim(overrides = {}) {
  return {
    claim_id: claimId,
    entitlement_id: entitlementId,
    level: 2,
    reward_type: "flower_petal_v1",
    flower_color: "turquoise",
    collection_sequence: 1,
    flower_number: 1,
    petal_number: 1,
    claimed_at: "2026-07-17T10:00:00.000Z",
    ...overrides,
  };
}

describe("flower reward contract", () => {
  test("uses eight stable, named color tokens", () => {
    assert.equal(FLOWER_REWARD_COLORS.length, 8);
    assert.equal(new Set(FLOWER_REWARD_COLORS).size, 8);
    for (const color of FLOWER_REWARD_COLORS) {
      assert.equal(isFlowerRewardColor(color), true);
      assert.match(FLOWER_REWARD_PRESENTATION[color].label, /\S/);
      assert.match(FLOWER_REWARD_PRESENTATION[color].color, /^#[0-9a-f]{6}$/i);
    }
    assert.equal(isFlowerRewardColor("#ffffff"), false);
    assert.equal(isFlowerRewardColor("rainbow"), false);
  });

  test("places five immutable petals in each flower", () => {
    assert.deepEqual(getFlowerPlacement(1), { flowerNumber: 1, petalNumber: 1 });
    assert.deepEqual(getFlowerPlacement(5), { flowerNumber: 1, petalNumber: 5 });
    assert.deepEqual(getFlowerPlacement(6), { flowerNumber: 2, petalNumber: 1 });
    assert.deepEqual(getFlowerPlacement(11), { flowerNumber: 3, petalNumber: 1 });
    assert.throws(() => getFlowerPlacement(0));
    assert.throws(() => getFlowerPlacement(1.5));
  });

  test("names one and several pending petals without exposing a queue number", () => {
    assert.equal(
      getPendingFlowerRewardLabel(1),
      "Et kronblad venter i blomsterhagen",
    );
    assert.equal(
      getPendingFlowerRewardLabel(3),
      "3 kronblader venter i blomsterhagen",
    );
    assert.throws(() => getPendingFlowerRewardLabel(0));
  });

  test("parses a strict, ordered caller-bound projection", () => {
    const parsed = parseFlowerRewardProjection({
      rewards_allowed: true,
      rewards_visible: true,
      progress_enabled: true,
      available_entitlements: [
        {
          entitlement_id: "10000000-0000-4000-8000-000000000002",
          level: 3,
          available_at: "2026-07-17T10:01:00.000Z",
        },
      ],
      claims: [claim()],
    });
    assert.equal(parsed.rewardsAllowed, true);
    assert.equal(parsed.rewardsVisible, true);
    assert.equal(parsed.availableEntitlements[0].level, 3);
    assert.deepEqual(parsed.claims[0], {
      claimId,
      entitlementId,
      level: 2,
      rewardType: "flower_petal_v1",
      flowerColor: "turquoise",
      collectionSequence: 1,
      flowerNumber: 1,
      petalNumber: 1,
      claimedAt: "2026-07-17T10:00:00.000Z",
    });
  });

  test("rejects forged color, placement and ordering", () => {
    assert.throws(() =>
      parseFlowerRewardProjection({
        rewards_allowed: true,
        rewards_visible: true,
        progress_enabled: true,
        available_entitlements: [],
        claims: [claim({ flower_color: "#ffffff" })],
      }),
    );
    assert.throws(() =>
      parseFlowerRewardProjection({
        rewards_allowed: true,
        rewards_visible: true,
        progress_enabled: true,
        available_entitlements: [],
        claims: [claim({ flower_number: 7 })],
      }),
    );
    assert.throws(() =>
      parseFlowerRewardProjection({
        rewards_allowed: true,
        rewards_visible: true,
        progress_enabled: true,
        available_entitlements: [
          {
            entitlement_id: "10000000-0000-4000-8000-000000000002",
            level: 3,
            available_at: "2026-07-17T10:01:00.000Z",
          },
          {
            entitlement_id: "10000000-0000-4000-8000-000000000003",
            level: 3,
            available_at: "2026-07-17T10:02:00.000Z",
          },
        ],
        claims: [],
      }),
    );
  });

  test("binds a claim response to entitlement and request", () => {
    const parsed = parseFlowerRewardClaimResult(
      { ...claim(), request_id: requestId, changed: true },
      entitlementId,
      requestId,
    );
    assert.equal(parsed.requestId, requestId);
    assert.equal(parsed.changed, true);
    assert.throws(() =>
      parseFlowerRewardClaimResult(
        { ...claim(), request_id: requestId, changed: true },
        "10000000-0000-4000-8000-000000000099",
        requestId,
      ),
    );
  });
});

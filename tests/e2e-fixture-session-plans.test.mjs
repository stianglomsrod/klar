import assert from "node:assert/strict";
import { describe, test } from "node:test";

process.env.TZ = "Europe/Oslo";

const {
  addLocalDays,
  fixtureSessionPlans,
  localDateValue,
  startOfLocalDay,
} = await import("../scripts/e2e/fixture-session-plans.mjs");

function rolloverWindow(plans) {
  return plans.flatMap((plan) => plan.windows).find((window) =>
    window.key === "rollover"
  );
}

describe("local E2E weekly-plan fixture", () => {
  test("keeps today and tomorrow in one plan during an ordinary week", () => {
    const plans = fixtureSessionPlans(
      new Date("2026-07-15T12:00:00+02:00"),
    );
    assert.equal(plans.length, 1);
    assert.equal(plans[0].weekStartDate, "2026-07-13");
    assert.equal(rolloverWindow(plans).presentationKey, "current");
  });

  test("creates a separate Monday plan when Sunday crosses midnight", () => {
    const plans = fixtureSessionPlans(
      new Date("2026-07-19T23:30:00+02:00"),
    );
    assert.deepEqual(
      plans.map((plan) => plan.weekStartDate),
      ["2026-07-13", "2026-07-20"],
    );
    assert.equal(plans[1].windows[0].key, "rollover");
  });

  for (const [label, value, expectedHours] of [
    ["spring DST", "2026-03-28T12:00:00+01:00", 23],
    ["autumn DST", "2026-10-24T12:00:00+02:00", 25],
  ]) {
    test(`uses a complete local day across ${label}`, () => {
      const window = rolloverWindow(fixtureSessionPlans(new Date(value)));
      const startsAt = new Date(window.startsAt);
      const endsAt = new Date(window.endsAt);
      assert.equal(localDateValue(startsAt), localDateValue(endsAt));
      assert.equal(
        endsAt.getTime() - startsAt.getTime(),
        expectedHours * 60 * 60_000 - 1,
      );
      assert.equal(
        localDateValue(addLocalDays(startOfLocalDay(new Date(value)), 1)),
        localDateValue(startsAt),
      );
    });
  }
});

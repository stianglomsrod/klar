import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getHelpQueueTransitionAt } from "../src/lib/help-queue-transition.ts";

describe("teacher help queue transition timer", () => {
  it("arms the next teaching session after showing a closed queue", () => {
    const closedSessionEnd = "2026-07-17T08:30:00.000Z";
    const nextSessionStart = "2026-07-17T10:00:00.000Z";

    assert.equal(
      getHelpQueueTransitionAt(nextSessionStart, closedSessionEnd),
      nextSessionStart,
    );
  });

  it("falls back to the current session end when there is no later transition", () => {
    const currentSessionEnd = "2026-07-17T09:00:00.000Z";

    assert.equal(
      getHelpQueueTransitionAt(null, currentSessionEnd),
      currentSessionEnd,
    );
    assert.equal(getHelpQueueTransitionAt(null, null), null);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getHelpQueueReplicationState } from "../src/lib/help-queue-realtime.ts";

describe("help queue replication readiness", () => {
  it("accepts both documented and locally observed successful payloads", () => {
    assert.equal(getHelpQueueReplicationState("system", "ok"), "ready");
    assert.equal(
      getHelpQueueReplicationState("postgres_changes", "ok"),
      "ready",
    );
  });

  it("keeps the fallback armed for errors and unrelated system events", () => {
    assert.equal(getHelpQueueReplicationState("system", "error"), "error");
    assert.equal(
      getHelpQueueReplicationState("postgres_changes", "error"),
      "error",
    );
    assert.equal(getHelpQueueReplicationState("presence", "ok"), "other");
    assert.equal(getHelpQueueReplicationState("system", "pending"), "other");
  });
});

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  getManualTestScenario,
  manualTestScenarios,
  manualTestStateFiles,
  resolveManualScenarioChoice,
} from "../scripts/e2e/manual-test-scenarios.mjs";

describe("local manual test scenarios", () => {
  test("keeps ids unique and every session inside the fixed v3/auth boundary", () => {
    assert.equal(
      new Set(manualTestScenarios.map((scenario) => scenario.id)).size,
      manualTestScenarios.length,
    );
    for (const scenario of manualTestScenarios) {
      assert.match(scenario.id, /^[a-z][a-z-]*$/);
      assert.ok(scenario.sessions.length >= 1);
      assert.equal(
        new Set(scenario.sessions.map((session) => session.state)).size,
        scenario.sessions.length,
      );
      for (const session of scenario.sessions) {
        assert.match(session.route, /^\/v3\//);
        assert.equal(session.state, session.state.split(/[\\/]/).at(-1));
        assert.match(session.state, /^[a-z0-9-]+\.json$/);
        assert.match(session.actorId, /^[0-9a-f-]{36}$/);
        assert.ok(session.heading.length > 0);
      }
    }
  });

  test("resolves both friendly numbers and stable scenario ids", () => {
    assert.equal(resolveManualScenarioChoice("1").id, "day");
    assert.equal(resolveManualScenarioChoice(" HELP ").id, "help");
    assert.equal(getManualTestScenario("rewards").label, "Blomsterhage og poeng");
    assert.throws(() => resolveManualScenarioChoice("999"));
    assert.throws(() => getManualTestScenario("../other"));
  });

  test("derives the complete allowlist of ignored browser states", () => {
    const referenced = new Set(
      manualTestScenarios.flatMap((scenario) =>
        scenario.sessions.map((session) => session.state),
      ),
    );
    assert.deepEqual(new Set(manualTestStateFiles), referenced);
  });
});

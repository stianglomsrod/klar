import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  createLocalRunnerSelectors,
  createLocalWebServerCommand,
  parseLocalRunnerOptions,
} from "../scripts/e2e/local-runner-options.mjs";

describe("local E2E runner options", () => {
  test("creates an isolated hot-reload role session only in manual Chromium mode", () => {
    assert.deepEqual(parseLocalRunnerOptions(["--mode=manual", "--dev"]), {
      mode: "manual",
      browser: "chromium",
      spec: null,
      roleDev: true,
      reuse: false,
      listScenarios: false,
      labCheck: false,
      scenario: null,
    });
    assert.throws(() => parseLocalRunnerOptions(["--mode=smoke", "--dev"]));
    assert.throws(() =>
      parseLocalRunnerOptions([
        "--mode=manual",
        "--browser=webkit",
        "--dev",
      ]),
    );
  });

  test("binds both development and QA servers to the canonical loopback host", () => {
    assert.equal(
      createLocalWebServerCommand({ roleDev: true, port: 3100 }),
      "npm run dev -- --hostname 127.0.0.1 --port 3100 --webpack",
    );
    assert.equal(
      createLocalWebServerCommand({ roleDev: false, port: 3100 }),
      "npm run start -- --hostname 127.0.0.1 --port 3100",
    );
    assert.throws(() => createLocalWebServerCommand({ roleDev: true, port: 0 }));
  });

  test("overrides stale ambient mode selectors for every runner invocation", () => {
    assert.deepEqual(
      createLocalRunnerSelectors({ mode: "manual", roleDev: false }),
      {
        KLAR_MANUAL_QA: "1",
        KLAR_ROLE_DEV: "0",
        KLAR_MANUAL_REUSE: "0",
      },
    );
    assert.deepEqual(
      createLocalRunnerSelectors({ mode: "smoke", roleDev: false }),
      {
        KLAR_MANUAL_QA: "0",
        KLAR_ROLE_DEV: "0",
        KLAR_MANUAL_REUSE: "0",
      },
    );
  });

  test("accepts only allowlisted local exploration scenarios and explicit reuse", () => {
    assert.deepEqual(
      parseLocalRunnerOptions([
        "--mode=manual",
        "--dev",
        "--reuse",
        "--scenario=help",
      ]),
      {
        mode: "manual",
        browser: "chromium",
        spec: null,
        roleDev: true,
        reuse: true,
        listScenarios: false,
        labCheck: false,
        scenario: "help",
      },
    );
    assert.throws(() =>
      parseLocalRunnerOptions([
        "--mode=manual",
        "--dev",
        "--scenario=unknown",
      ]),
    );
    assert.throws(() =>
      parseLocalRunnerOptions(["--mode=manual", "--reuse"]),
    );
    assert.throws(() =>
      parseLocalRunnerOptions(["--mode=manual", "--dev", "--mystery"]),
    );
    assert.equal(
      parseLocalRunnerOptions([
        "--mode=manual",
        "--dev",
        "--lab-check",
        "--scenario=day",
      ]).labCheck,
      true,
    );
  });

  test("keeps targeted specs inside the E2E tree", () => {
    assert.equal(
      parseLocalRunnerOptions([
        "--mode=smoke",
        "--spec=tests\\e2e\\authenticated\\teacher.spec.ts",
      ]).spec,
      "tests/e2e/authenticated/teacher.spec.ts",
    );
    assert.throws(() =>
      parseLocalRunnerOptions(["--spec=tests/e2e/../secret.spec.ts"]),
    );
    assert.throws(() =>
      parseLocalRunnerOptions(["--mode=smoke", "--mode=staff"]),
    );
  });
});

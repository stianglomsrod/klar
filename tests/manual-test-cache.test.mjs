import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, test } from "node:test";
import {
  acquireLocalRunnerLock,
  adoptInterruptedManualTestRun,
  createFixtureFingerprint,
  getManualTestCachePaths,
  MANUAL_TEST_CACHE_VERSION,
  markManualTestCacheDirty,
  readManualTestCache,
  refreshManualTestCacheStateHashes,
  writeManualTestCache,
} from "../scripts/e2e/manual-test-cache.mjs";
import { manualTestStateFiles } from "../scripts/e2e/manual-test-scenarios.mjs";

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function createFixtureRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "klar-manual-cache-"));
  roots.push(root);
  const fixtureFiles = [
    "package-lock.json",
    "scripts/e2e/fixture-session-plans.mjs",
    "scripts/e2e/manual-test-scenarios.mjs",
    "scripts/e2e/seed-local.mjs",
    "supabase/config.toml",
    "supabase/seed.sql",
    "supabase/migrations/001.sql",
    "tests/e2e/auth.setup.ts",
    "tests/e2e/support/env.ts",
    "tests/e2e/support/totp.ts",
  ];
  for (const relative of fixtureFiles) {
    const file = path.join(root, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `fixture:${relative}\n`, "utf8");
  }
  const paths = getManualTestCachePaths(root);
  mkdirSync(paths.directory, { recursive: true });
  for (const state of manualTestStateFiles) {
    writeFileSync(
      path.join(paths.directory, state),
      JSON.stringify({ cookies: [], origins: [] }),
      "utf8",
    );
  }
  return { root, paths };
}

function cacheInput(root) {
  return {
    root,
    projectId: "klar-3-0",
    apiUrl: "http://127.0.0.1:54321",
    databaseUrl: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    anonKey: "local-anon-value",
    serviceRoleKey: "local-service-role-value",
    ownerCreatedAt: "2026-07-17T10:00:00.000Z",
    studentCodePepper: "a".repeat(64),
  };
}

function observeChildProcess(child) {
  const messages = [];
  const waiters = [];
  let stdoutBuffer = "";
  let stderrBuffer = "";

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderrBuffer += chunk;
  });
  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk;
    const lines = stdoutBuffer.split(String.fromCharCode(10));
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      const message = JSON.parse(line);
      const waiter = waiters.shift();
      if (waiter) waiter(message);
      else messages.push(message);
    }
  });

  return {
    nextMessage() {
      if (messages.length > 0) return Promise.resolve(messages.shift());
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Barnelåsen svarte ikke innen fem sekunder.")),
          5_000,
        );
        waiters.push((message) => {
          clearTimeout(timeout);
          resolve(message);
        });
      });
    },
    exit: new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => {
        if (code === 0) resolve();
        else {
          reject(
            new Error(
              "Barnelåsen stoppet med kode " + code + ": " + stderrBuffer,
            ),
          );
        }
      });
    }),
  };
}

describe("manual test cache", () => {
  test("writes a secret-free manifest and validates the matching local generation", () => {
    const { root, paths } = createFixtureRoot();
    const input = cacheInput(root);
    writeManualTestCache(input);
    const result = readManualTestCache(input);
    assert.equal(result.studentCodePepper, "a".repeat(64));
    const manifest = readFileSync(paths.manifest, "utf8");
    assert.doesNotMatch(manifest, /local-anon-value|local-service-role-value/);
    assert.doesNotMatch(manifest, /studentCodePepper|"a{32}/);
    if (process.platform !== "win32") {
      assert.equal(statSync(paths.directory).mode & 0o777, 0o700);
      assert.equal(statSync(paths.manifest).mode & 0o777, 0o600);
      assert.equal(statSync(paths.secret).mode & 0o777, 0o600);
      assert.equal(
        statSync(path.join(paths.directory, manualTestStateFiles[0])).mode & 0o777,
        0o600,
      );
    }
  });

  test("invalidates fixture changes, altered states and unclean exits", () => {
    const { root, paths } = createFixtureRoot();
    const input = cacheInput(root);
    writeManualTestCache(input);

    markManualTestCacheDirty(root, "day", "1".repeat(32));
    assert.throws(() => readManualTestCache(input), /ikke avsluttet ryddig/);
    refreshManualTestCacheStateHashes(root, true, "1".repeat(32));
    assert.doesNotThrow(() => readManualTestCache(input));

    const state = path.join(paths.directory, manualTestStateFiles[0]);
    writeFileSync(state, JSON.stringify({ cookies: [{ changed: true }], origins: [] }));
    assert.throws(() => readManualTestCache(input), /endret uten en ryddig lagring/);
    refreshManualTestCacheStateHashes(root, true);
    assert.doesNotThrow(() => readManualTestCache(input));

    writeFileSync(path.join(root, "supabase", "seed.sql"), "changed\n", "utf8");
    assert.throws(() => readManualTestCache(input), /matcher ikke forventet fixture/);
  });

  test("keeps a valid stateful cache across local calendar days", () => {
    const { root, paths } = createFixtureRoot();
    const input = cacheInput(root);
    writeManualTestCache(input);
    const manifest = JSON.parse(readFileSync(paths.manifest, "utf8"));
    manifest.fixtureLocalDate = "2000-01-01";
    writeFileSync(paths.manifest, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const result = readManualTestCache(input);
    assert.equal(result.manifest.fixtureLocalDate, "2000-01-01");
  });

  test("keeps every integrity guard active for an older cache", async (t) => {
    const cases = [
      {
        name: "fixture fingerprint",
        mutate: ({ root }) =>
          writeFileSync(path.join(root, "supabase", "seed.sql"), "changed\n"),
        input: (value) => value,
        error: /matcher ikke forventet fixture/,
      },
      {
        name: "database generation",
        mutate: () => undefined,
        input: (value) => ({
          ...value,
          ownerCreatedAt: "2026-07-18T10:00:00.000Z",
        }),
        error: /matcher ikke forventet fixture/,
      },
      {
        name: "dirty state",
        mutate: ({ root }) =>
          markManualTestCacheDirty(root, "day", "1".repeat(32)),
        input: (value) => value,
        error: /ikke avsluttet ryddig/,
      },
      {
        name: "state hash",
        mutate: ({ paths }) =>
          writeFileSync(
            path.join(paths.directory, manualTestStateFiles[0]),
            JSON.stringify({ cookies: [{ changed: true }], origins: [] }),
          ),
        input: (value) => value,
        error: /endret uten en ryddig lagring/,
      },
    ];

    for (const testCase of cases) {
      await t.test(testCase.name, () => {
        const fixture = createFixtureRoot();
        const input = cacheInput(fixture.root);
        writeManualTestCache(input);
        const manifest = JSON.parse(readFileSync(fixture.paths.manifest, "utf8"));
        manifest.fixtureLocalDate = "2000-01-01";
        writeFileSync(
          fixture.paths.manifest,
          `${JSON.stringify(manifest, null, 2)}\n`,
          "utf8",
        );
        testCase.mutate(fixture);
        assert.throws(() => readManualTestCache(testCase.input(input)), testCase.error);
      });
    }
  });

  test("rejects malformed fixture-date metadata", () => {
    const { root, paths } = createFixtureRoot();
    const input = cacheInput(root);
    writeManualTestCache(input);
    const manifest = JSON.parse(readFileSync(paths.manifest, "utf8"));
    manifest.fixtureLocalDate = "2026-02-31";
    writeFileSync(paths.manifest, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    assert.throws(() => readManualTestCache(input), /ugyldig metadata/);
  });

  test("fingerprints fixture inputs deterministically", () => {
    const { root } = createFixtureRoot();
    const first = createFixtureFingerprint(root);
    assert.equal(createFixtureFingerprint(root), first);
    writeFileSync(path.join(root, "supabase", "migrations", "001.sql"), "changed");
    assert.notEqual(createFixtureFingerprint(root), first);
  });

  test("binds the runtime pepper to the secret-free manifest", () => {
    const { root, paths } = createFixtureRoot();
    const input = cacheInput(root);
    writeManualTestCache(input);
    writeFileSync(
      paths.secret,
      `${JSON.stringify({ formatVersion: MANUAL_TEST_CACHE_VERSION, studentCodePepper: "b".repeat(64) })}\n`,
      "utf8",
    );
    assert.throws(() => readManualTestCache(input), /matcher ikke manifestet/);
  });

  test("rejects a lab directory redirected through a symlink or junction", () => {
    const { root, paths } = createFixtureRoot();
    const external = mkdtempSync(path.join(tmpdir(), "klar-manual-external-"));
    roots.push(external);
    rmSync(paths.directory, { recursive: true, force: true });
    symlinkSync(
      external,
      paths.directory,
      process.platform === "win32" ? "junction" : "dir",
    );
    assert.throws(
      () => writeManualTestCache(cacheInput(root)),
      /symlink eller junction/,
    );
  });

  test("allows only one local runner without terminating the owner", () => {
    const { root } = createFixtureRoot();
    const release = acquireLocalRunnerLock(root);
    assert.throws(() => acquireLocalRunnerLock(root), /allerede aktiv/);
    release();
    const releaseAgain = acquireLocalRunnerLock(root);
    releaseAgain();
  });

  test("serializes the runner lock across separate processes", async (t) => {
    const { root } = createFixtureRoot();
    const moduleUrl = new URL(
      "../scripts/e2e/manual-test-cache.mjs",
      import.meta.url,
    ).href;
    const child = spawn(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `
          import { acquireLocalRunnerLock } from ${JSON.stringify(moduleUrl)};
          const release = acquireLocalRunnerLock(${JSON.stringify(root)});
          process.stdout.write("locked\\n");
          process.stdin.resume();
          process.stdin.once("end", () => {
            release();
            process.exit(0);
          });
        `,
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    t.after(() => {
      if (child.exitCode === null) child.kill();
    });

    await new Promise((resolve, reject) => {
      let output = "";
      let errorOutput = "";
      const timeout = setTimeout(
        () => reject(new Error(`Barnelåsen startet ikke: ${errorOutput}`)),
        5_000,
      );
      child.stderr.on("data", (chunk) => {
        errorOutput += chunk.toString();
      });
      child.stdout.on("data", (chunk) => {
        output += chunk.toString();
        if (output.includes("locked\n")) {
          clearTimeout(timeout);
          resolve();
        }
      });
      child.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once("exit", (code) => {
        if (!output.includes("locked\n")) {
          clearTimeout(timeout);
          reject(new Error(`Barnelåsen stoppet med kode ${code}: ${errorOutput}`));
        }
      });
    });

    assert.throws(() => acquireLocalRunnerLock(root), /allerede aktiv/);
    const childExit = new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Barnelåsen stoppet med kode ${code}`));
      });
    });
    child.stdin.end();
    await childExit;
    const release = acquireLocalRunnerLock(root);
    assert.equal(release.recoveredStaleLock, false);
    release();
  });

  test("allows only one simultaneous stale-lock recovery process", async (t) => {
    const { root, paths } = createFixtureRoot();
    const moduleUrl = new URL(
      "../scripts/e2e/manual-test-cache.mjs",
      import.meta.url,
    ).href;
    const staleOwner = "a".repeat(32);
    mkdirSync(paths.authRoot, { recursive: true });
    writeFileSync(
      paths.runnerLock,
      JSON.stringify({
        pid: 2147483647,
        owner: staleOwner,
        startedAt: "2026-07-18T01:00:00.000Z",
      }) + String.fromCharCode(10),
      "utf8",
    );

    const source = [
      "import { acquireLocalRunnerLock } from " + JSON.stringify(moduleUrl) + ";",
      "let release = null;",
      "const send = (value) => console.log(JSON.stringify(value));",
      "send({ type: 'ready' });",
      "process.stdin.setEncoding('utf8');",
      "process.stdin.on('data', (chunk) => {",
      "  const command = chunk.trim();",
      "  if (command === 'go') {",
      "    try {",
      "      release = acquireLocalRunnerLock(" + JSON.stringify(root) + ");",
      "      send({ type: 'result', ok: true, pid: process.pid, owner: release.owner, recoveredStaleLock: release.recoveredStaleLock, recoveredStaleLockOwner: release.recoveredStaleLockOwner });",
      "    } catch (error) {",
      "      send({ type: 'result', ok: false, message: error.message });",
      "      process.exit(0);",
      "    }",
      "  } else if (command === 'release' && release) {",
      "    release();",
      "    process.exit(0);",
      "  }",
      "});",
    ].join(String.fromCharCode(10));

    const children = Array.from({ length: 2 }, () =>
      spawn(
        process.execPath,
        ["--input-type=module", "--eval", source],
        { stdio: ["pipe", "pipe", "pipe"] },
      ),
    );
    const observed = children.map(observeChildProcess);
    t.after(() => {
      for (const child of children) {
        if (child.exitCode === null) child.kill();
      }
    });

    const ready = await Promise.all(observed.map((child) => child.nextMessage()));
    assert.deepEqual(
      ready.map((message) => message.type),
      ["ready", "ready"],
    );
    for (const child of children) child.stdin.write("go\n");
    const outcomes = await Promise.all(
      observed.map((child) => child.nextMessage()),
    );
    const winners = outcomes
      .map((outcome, index) => ({ ...outcome, index }))
      .filter((outcome) => outcome.ok);
    const losers = outcomes.filter((outcome) => !outcome.ok);

    assert.equal(winners.length, 1);
    assert.equal(losers.length, 1);
    assert.match(losers[0].message, /kontrollerer låsetilstanden|allerede aktiv/);
    assert.equal(winners[0].recoveredStaleLock, true);
    assert.equal(winners[0].recoveredStaleLockOwner, staleOwner);
    const currentLock = JSON.parse(readFileSync(paths.runnerLock, "utf8"));
    assert.equal(currentLock.pid, winners[0].pid);
    assert.equal(currentLock.owner, winners[0].owner);

    children[winners[0].index].stdin.write("release\n");
    await Promise.all(observed.map((child) => child.exit));
    assert.equal(existsSync(paths.runnerLock), false);
  });

  test("recovers only a runner lock whose recorded process is dead", () => {
    const { root, paths } = createFixtureRoot();
    mkdirSync(paths.authRoot, { recursive: true });
    writeFileSync(
      paths.runnerLock,
      `${JSON.stringify({
        pid: 2147483647,
        owner: "a".repeat(32),
        startedAt: "2026-07-18T01:00:00.000Z",
      })}\n`,
      "utf8",
    );

    const release = acquireLocalRunnerLock(root);
    assert.equal(release.recoveredStaleLock, true);
    assert.equal(release.recoveredStaleLockOwner, "a".repeat(32));
    const currentLock = JSON.parse(readFileSync(paths.runnerLock, "utf8"));
    assert.equal(currentLock.owner, release.owner);
    release();
  });

  test("never bypasses the atomic runner operation gate", () => {
    const { root, paths } = createFixtureRoot();
    mkdirSync(paths.runnerGate, { mode: 0o700 });
    assert.throws(
      () => acquireLocalRunnerLock(root),
      /kontrollerer låsetilstanden/,
    );
    assert.equal(statSync(paths.runnerGate).isDirectory(), true);
  });

  test("records and resumes only the same interrupted scenario", () => {
    const { root, paths } = createFixtureRoot();
    const input = cacheInput(root);
    writeManualTestCache(input);
    markManualTestCacheDirty(root, "iterations", "1".repeat(32));
    markManualTestCacheDirty(root, "iterations", "1".repeat(32));
    assert.throws(
      () => markManualTestCacheDirty(root, "day", "1".repeat(32)),
      /annet aktivt scenario/,
    );
    const dirty = readManualTestCache(input, { allowDirty: true });
    assert.equal(dirty.manifest.activeScenarioId, "iterations");
    assert.equal(dirty.manifest.activeRunId, "1".repeat(32));
    assert.throws(
      () => refreshManualTestCacheStateHashes(root, true, "2".repeat(32)),
      /eier ikke dirty-markeringen/,
    );
    refreshManualTestCacheStateHashes(root, true, "1".repeat(32));
    const clean = readManualTestCache(input);
    assert.equal(clean.manifest.activeScenarioId, null);
    assert.equal(JSON.parse(readFileSync(paths.manifest, "utf8")).dirtySince, null);
  });

  test("adopts an interrupted run only from its matching stale lock owner", () => {
    const { root } = createFixtureRoot();
    const input = cacheInput(root);
    writeManualTestCache(input);
    markManualTestCacheDirty(root, "iterations", "1".repeat(32));
    assert.throws(
      () =>
        adoptInterruptedManualTestRun(
          root,
          "iterations",
          "2".repeat(32),
          "3".repeat(32),
        ),
      /tilhører ikke den foreldreløse runner-låsen/,
    );
    adoptInterruptedManualTestRun(
      root,
      "iterations",
      "1".repeat(32),
      "3".repeat(32),
    );
    const adopted = readManualTestCache(input, { allowDirty: true });
    assert.equal(adopted.manifest.activeRunId, "3".repeat(32));
    refreshManualTestCacheStateHashes(root, true, "3".repeat(32));
    assert.doesNotThrow(() => readManualTestCache(input));
  });
});

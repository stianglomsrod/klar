import assert from "node:assert/strict";
import {
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

    markManualTestCacheDirty(root);
    assert.throws(() => readManualTestCache(input), /ikke avsluttet ryddig/);
    refreshManualTestCacheStateHashes(root, true);
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
        mutate: ({ root }) => markManualTestCacheDirty(root),
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
    assert.throws(() => acquireLocalRunnerLock(root), /finnes allerede/);
    release();
    const releaseAgain = acquireLocalRunnerLock(root);
    releaseAgain();
  });
});

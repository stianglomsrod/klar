import { createHash, randomBytes } from "node:crypto";
import {
  chmodSync,
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { manualTestStateFiles } from "./manual-test-scenarios.mjs";

export const MANUAL_TEST_CACHE_VERSION = 2;
const OWNER_ID = "10000000-0000-4000-8000-000000000001";
const MAX_JSON_BYTES = 4 * 1024 * 1024;
const fingerprintFiles = [
  "package-lock.json",
  "scripts/e2e/fixture-session-plans.mjs",
  "scripts/e2e/manual-test-scenarios.mjs",
  "scripts/e2e/seed-local.mjs",
  "supabase/config.toml",
  "supabase/seed.sql",
  "tests/e2e/auth.setup.ts",
  "tests/e2e/support/env.ts",
  "tests/e2e/support/totp.ts",
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(file) {
  return sha256(readFileSync(file));
}

function readSmallJson(file, label) {
  const bytes = readFileSync(file);
  if (bytes.length > MAX_JSON_BYTES) {
    throw new Error(`${label} er uventet stor og blir ikke brukt.`);
  }
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error(`${label} er ugyldig JSON.`);
  }
}

function assertRegularFile(file, label) {
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${label} må være en vanlig lokal fil.`);
  }
}

function assertContainedPath(root, target, label) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const lexicalRelative = path.relative(resolvedRoot, resolvedTarget);
  if (lexicalRelative.startsWith("..") || path.isAbsolute(lexicalRelative)) {
    throw new Error(`${label} ligger utenfor den autoritative arbeidskopien.`);
  }

  let current = resolvedRoot;
  for (const segment of lexicalRelative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (!existsSync(current)) continue;
    if (lstatSync(current).isSymbolicLink()) {
      throw new Error(`${label} kan ikke ligge under en symlink eller junction.`);
    }
  }

  if (existsSync(resolvedTarget)) {
    const realRoot = realpathSync(resolvedRoot);
    const realTarget = realpathSync(resolvedTarget);
    const realRelative = path.relative(realRoot, realTarget);
    if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
      throw new Error(`${label} peker utenfor den autoritative arbeidskopien.`);
    }
  }
}

function ensureSafeDirectory(root, directory, mode, label) {
  assertContainedPath(root, directory, label);
  mkdirSync(directory, { recursive: true, mode });
  chmodSync(directory, mode);
  assertContainedPath(root, directory, label);
}

function writeJsonAtomically(file, value, mode) {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      mode,
      flag: "wx",
    });
    renameSync(temporary, file);
  } catch (error) {
    if (existsSync(temporary)) unlinkSync(temporary);
    throw error;
  }
}

function databaseTarget(databaseUrl) {
  const url = new URL(databaseUrl);
  return `${url.hostname}:${url.port}${url.pathname}`;
}

export function getManualTestCachePaths(root) {
  const authRoot = path.resolve(root, "playwright", ".auth");
  const directory = path.join(authRoot, "lab");
  return {
    authRoot,
    directory,
    manifest: path.join(directory, "manifest.json"),
    secret: path.join(directory, "runtime.secret.json"),
    runnerLock: path.join(authRoot, "local-runner.lock"),
  };
}

export function ensureManualTestCacheDirectory(root) {
  const paths = getManualTestCachePaths(root);
  ensureSafeDirectory(
    root,
    paths.authRoot,
    0o700,
    "Rotmappen for lokale browserøkter",
  );
  ensureSafeDirectory(
    root,
    paths.directory,
    0o700,
    "Mappen for det lokale testverkstedet",
  );
  return paths;
}

export function acquireLocalRunnerLock(root) {
  const { authRoot, runnerLock } = getManualTestCachePaths(root);
  ensureSafeDirectory(
    root,
    authRoot,
    0o700,
    "Rotmappen for lokale browserøkter",
  );
  const owner = randomBytes(16).toString("hex");
  let descriptor;
  try {
    descriptor = openSync(runnerLock, "wx", 0o600);
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(
        "En lokal lab-, QA- eller E2E-lås finnes allerede. Avslutt pågående kjøring. Etter et krasj må `playwright/.auth/local-runner.lock` fjernes manuelt først når du har kontrollert at ingen lokal runner kjører.",
      );
    }
    throw error;
  }
  try {
    writeFileSync(
      descriptor,
      `${JSON.stringify({ pid: process.pid, owner, startedAt: new Date().toISOString() })}\n`,
      "utf8",
    );
  } finally {
    closeSync(descriptor);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    try {
      const current = readSmallJson(runnerLock, "Låsen for lokal testkjøring");
      if (current.pid === process.pid && current.owner === owner) {
        unlinkSync(runnerLock);
      }
    } catch {
      // Never delete a lock we cannot prove this process owns.
    }
  };
}

export function localFixtureDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function createFixtureFingerprint(root) {
  const files = [...fingerprintFiles];
  const migrations = readdirSync(path.join(root, "supabase", "migrations"), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => path.join("supabase", "migrations", entry.name))
    .sort();
  files.push(...migrations);

  const hash = createHash("sha256");
  for (const relativeFile of files.sort()) {
    const absoluteFile = path.resolve(root, relativeFile);
    hash.update(relativeFile.replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(readFileSync(absoluteFile));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function writeManualTestCache(input) {
  const paths = ensureManualTestCacheDirectory(input.root);
  const stateHashes = Object.fromEntries(
    manualTestStateFiles.map((state) => {
      const file = path.join(paths.directory, state);
      assertRegularFile(file, `Sesjonen ${state}`);
      chmodSync(file, 0o600);
      return [state, sha256File(file)];
    }),
  );
  const createdAt = new Date().toISOString();
  const manifest = {
    formatVersion: MANUAL_TEST_CACHE_VERSION,
    projectId: input.projectId,
    apiUrl: input.apiUrl,
    databaseTarget: databaseTarget(input.databaseUrl),
    fixtureFingerprint: createFixtureFingerprint(input.root),
    fixtureLocalDate: localFixtureDate(),
    owner: { id: OWNER_ID, createdAt: input.ownerCreatedAt },
    credentialFingerprints: {
      anon: sha256(input.anonKey),
      serviceRole: sha256(input.serviceRoleKey),
      runtimePepper: sha256(input.studentCodePepper),
    },
    stateHashes,
    createdAt,
    lastCleanClose: null,
    dirtySince: null,
  };
  const secret = {
    formatVersion: MANUAL_TEST_CACHE_VERSION,
    studentCodePepper: input.studentCodePepper,
  };
  writeJsonAtomically(paths.secret, secret, 0o600);
  writeJsonAtomically(paths.manifest, manifest, 0o600);
  return manifest;
}

export function readManualTestCache(input) {
  const paths = ensureManualTestCacheDirectory(input.root);
  assertRegularFile(paths.manifest, "Manifestet for det lokale testverkstedet");
  assertRegularFile(paths.secret, "Hemmelighetsfilen for det lokale testverkstedet");
  const manifest = readSmallJson(
    paths.manifest,
    "Manifestet for det lokale testverkstedet",
  );
  const secret = readSmallJson(
    paths.secret,
    "Hemmelighetsfilen for det lokale testverkstedet",
  );
  const expected = {
    formatVersion: MANUAL_TEST_CACHE_VERSION,
    projectId: input.projectId,
    apiUrl: input.apiUrl,
    databaseTarget: databaseTarget(input.databaseUrl),
    fixtureFingerprint: createFixtureFingerprint(input.root),
    fixtureLocalDate: localFixtureDate(),
    ownerId: OWNER_ID,
    ownerCreatedAt: input.ownerCreatedAt,
    anonFingerprint: sha256(input.anonKey),
    serviceRoleFingerprint: sha256(input.serviceRoleKey),
  };
  const actual = {
    formatVersion: manifest.formatVersion,
    projectId: manifest.projectId,
    apiUrl: manifest.apiUrl,
    databaseTarget: manifest.databaseTarget,
    fixtureFingerprint: manifest.fixtureFingerprint,
    fixtureLocalDate: manifest.fixtureLocalDate,
    ownerId: manifest.owner?.id,
    ownerCreatedAt: manifest.owner?.createdAt,
    anonFingerprint: manifest.credentialFingerprints?.anon,
    serviceRoleFingerprint: manifest.credentialFingerprints?.serviceRole,
  };
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      "Det lokale testverkstedet matcher ikke dagens fixture, database eller Auth-oppsett.",
    );
  }
  if (
    secret.formatVersion !== MANUAL_TEST_CACHE_VERSION ||
    typeof secret.studentCodePepper !== "string" ||
    !/^[a-f0-9]{64}$/.test(secret.studentCodePepper)
  ) {
    throw new Error("Hemmelighetsfilen for det lokale testverkstedet er ugyldig.");
  }
  if (
    manifest.credentialFingerprints?.runtimePepper !==
    sha256(secret.studentCodePepper)
  ) {
    throw new Error("Labens runtime-hemmelighet matcher ikke manifestet.");
  }
  const expectedStates = [...manualTestStateFiles].sort();
  const actualStates = Object.keys(manifest.stateHashes ?? {}).sort();
  if (JSON.stringify(actualStates) !== JSON.stringify(expectedStates)) {
    throw new Error("Manifestet mangler en eller flere isolerte testøkter.");
  }
  if (manifest.dirtySince !== null) {
    throw new Error(
      "Forrige utforskingsøkt ble ikke avsluttet ryddig, så øktene gjenbrukes ikke automatisk.",
    );
  }
  for (const state of expectedStates) {
    const file = path.join(paths.directory, state);
    assertRegularFile(file, `Sesjonen ${state}`);
    if (manifest.stateHashes[state] !== sha256File(file)) {
      throw new Error(`Sesjonen ${state} er endret uten en ryddig lagring.`);
    }
    const storageState = readSmallJson(file, `Sesjonen ${state}`);
    if (!Array.isArray(storageState.cookies) || !Array.isArray(storageState.origins)) {
      throw new Error(`Sesjonen ${state} har ukjent format.`);
    }
  }
  return { manifest, studentCodePepper: secret.studentCodePepper, paths };
}

export function writeManualTestStorageState(root, state, storageState) {
  if (!manualTestStateFiles.includes(state)) {
    throw new Error(`Sesjonsfilen ${state} er ikke tillatt i testverkstedet.`);
  }
  const { directory } = ensureManualTestCacheDirectory(root);
  writeJsonAtomically(path.join(directory, state), storageState, 0o600);
}

export function refreshManualTestCacheStateHashes(root, cleanClose = false) {
  const paths = ensureManualTestCacheDirectory(root);
  const manifest = readSmallJson(
    paths.manifest,
    "Manifestet for det lokale testverkstedet",
  );
  manifest.stateHashes = Object.fromEntries(
    manualTestStateFiles.map((state) => [
      state,
      sha256File(path.join(paths.directory, state)),
    ]),
  );
  if (cleanClose) {
    manifest.lastCleanClose = new Date().toISOString();
    manifest.dirtySince = null;
  }
  writeJsonAtomically(paths.manifest, manifest, 0o600);
}

export function markManualTestCacheDirty(root) {
  const paths = ensureManualTestCacheDirectory(root);
  const manifest = readSmallJson(
    paths.manifest,
    "Manifestet for det lokale testverkstedet",
  );
  if (manifest.dirtySince !== null) {
    throw new Error("Det lokale testverkstedet er allerede markert som aktivt.");
  }
  manifest.dirtySince = new Date().toISOString();
  writeJsonAtomically(paths.manifest, manifest, 0o600);
}

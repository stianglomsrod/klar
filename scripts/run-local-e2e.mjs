import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createConnection } from "node:net";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import {
  acquireLocalRunnerLock,
  adoptInterruptedManualTestRun,
  ensureManualTestCacheDirectory,
  getManualTestCachePaths,
  readManualTestCache,
  writeManualTestCache,
} from "./e2e/manual-test-cache.mjs";
import {
  formatManualTestScenarios,
  getManualTestScenario,
  resolveManualScenarioChoice,
} from "./e2e/manual-test-scenarios.mjs";
import {
  assertLocalDatabaseUrl,
  assertLocalSupabaseUrl,
  parseSupabaseEnv,
} from "./e2e/local-safety.mjs";
import {
  createLocalRunnerSelectors,
  parseLocalRunnerOptions,
} from "./e2e/local-runner-options.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const supabase = path.join(root, "node_modules", "supabase", "dist", "supabase.js");
const playwright = path.join(
  root,
  "node_modules",
  "@playwright",
  "test",
  "cli.js",
);
const npm = process.env.npm_execpath;
const OWNER_ID = "10000000-0000-4000-8000-000000000001";

function getLocalProjectId() {
  const config = readFileSync(path.join(root, "supabase", "config.toml"), "utf8");
  const projectId = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
  if (!projectId || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(projectId)) {
    throw new Error("Fant ikke et trygt lokalt project_id i Supabase-konfigurasjonen.");
  }
  return projectId;
}

function getLocalContainer(service) {
  return `supabase_${service}_${getLocalProjectId()}`;
}

const {
  mode,
  browser,
  spec,
  roleDev,
  reuse,
  listScenarios,
  labCheck,
  scenario: requestedScenario,
} = parseLocalRunnerOptions(process.argv.slice(2));

if (listScenarios) {
  console.log("Klar – lokale utforskingsscenarioer\n");
  console.log(formatManualTestScenarios());
  process.exit(0);
}

function isPortOpen(host, port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const finish = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(1_000);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
}

if (mode === "manual") {
  if (
    !labCheck &&
    (process.env.CI || !process.stdin.isTTY || !process.stdout.isTTY)
  ) {
    throw new Error(
      "Manuell A1-desktop-QA og lokal utforsking må startes av en person i en interaktiv terminal.",
    );
  }
  if (await isPortOpen("127.0.0.1", 3100)) {
    throw new Error(
      "Port 3100 er i bruk. Stopp den eksisterende Klar-serveren først; en ukjent server blir aldri gjenbrukt eller stoppet automatisk.",
    );
  }
}

function run(command, args, options = {}) {
  const stdio = options.capture
    ? ["ignore", "pipe", "pipe"]
    : options.suppressStdout
      ? ["ignore", "ignore", "inherit"]
      : "inherit";
  const result = spawnSync(command, args, {
    cwd: root,
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio,
    shell: false,
  });
  if (result.error || result.status !== 0) {
    if (options.capture && result.stderr) process.stderr.write(result.stderr);
    throw result.error ?? new Error(`${command} avsluttet med kode ${result.status}.`);
  }
  return result.stdout ?? "";
}

async function waitForLocalAuth(apiUrl, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${apiUrl}/auth/v1/health`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) return;
    } catch {
      // A local start/reset can briefly restart Auth. Retry loopback only.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Lokal Supabase Auth ble ikke klar innen 45 sekunder.");
}

async function getOwnerCreatedAt(databaseUrl) {
  const database = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5_000,
  });
  await database.connect();
  try {
    const result = await database.query(
      "select created_at from auth.users where id = $1::uuid",
      [OWNER_ID],
    );
    const createdAt = result.rows[0]?.created_at;
    if (!(createdAt instanceof Date)) {
      throw new Error("Den lokale syntetiske eieren mangler.");
    }
    return createdAt.toISOString();
  } finally {
    await database.end();
  }
}

async function assertScenarioFixtureReady(databaseUrl, scenarioId) {
  const currentSessionClasses = new Map([
    ["day", "30000000-0000-4000-8000-000000000002"],
    ["subjects", "30000000-0000-4000-8000-000000000002"],
    ["help", "30000000-0000-4000-8000-000000000005"],
    ["help-team", "30000000-0000-4000-8000-000000000005"],
  ]);
  const currentClassId = currentSessionClasses.get(scenarioId);
  const futureClassId =
    scenarioId === "iterations"
      ? "30000000-0000-4000-8000-000000000006"
      : null;
  if (!currentClassId && !futureClassId) return;
  const database = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5_000,
  });
  await database.connect();
  try {
    const result = await database.query(
      `select exists (
         select 1
         from public.plan_revision_sessions as revision_session
         join public.weekly_plans as plan
           on plan.id = revision_session.weekly_plan_id
          and plan.organization_id = revision_session.organization_id
          and plan.class_id = revision_session.class_id
          and plan.active_revision_id = revision_session.revision_id
         where revision_session.class_id = $1::uuid
           and (
             ($2::boolean = true
               and revision_session.starts_at <= statement_timestamp()
               and revision_session.ends_at > statement_timestamp())
             or
             ($2::boolean = false
               and revision_session.starts_at > statement_timestamp())
           )
       ) as ready`,
      [currentClassId ?? futureClassId, Boolean(currentClassId)],
    );
    if (result.rows[0]?.ready !== true) {
      throw new Error(
        `Det tidsavgrensede grunnlaget for scenarioet «${scenarioId}» er utløpt. Kjør \`npm run lab:reset\` for en ny lokal fixture.`,
      );
    }
  } finally {
    await database.end();
  }
}

async function chooseScenario() {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log("\nKlar – lokal utforsking");
    console.log("Endringer beholdes i den lokale, syntetiske testverdenen.");
    console.log(formatManualTestScenarios());
    const answer = await terminal.question(
      "\nVelg nummer eller scenario-id, Enter for Dagen og oppgaver, Q for å avslutte: ",
    );
    if (answer.trim().toLowerCase() === "q") return null;
    return resolveManualScenarioChoice(answer.trim() || "day");
  } finally {
    terminal.close();
  }
}

if (!existsSync(supabase) || !existsSync(playwright) || !npm || !existsSync(npm)) {
  throw new Error("Kjør npm ci før autentisert E2E eller lokal utforsking.");
}

const docker = spawnSync("docker", ["info"], {
  cwd: root,
  stdio: "ignore",
  shell: false,
});
if (docker.error || docker.status !== 0) {
  throw new Error(
    "Docker er ikke tilgjengelig. Start Docker Desktop og prøv igjen. Ingen ekstern database ble berørt.",
  );
}

const releaseRunnerLock = acquireLocalRunnerLock(root);
if (releaseRunnerLock.recoveredStaleLock) {
  console.log("En foreldreløs lokal runner-lås ble kontrollert og fjernet.");
}
const releaseRunnerLockOnExit = () => releaseRunnerLock();
process.once("exit", releaseRunnerLockOnExit);
if (roleDev) {
  // Reject a redirected cache path before any explicit local database reset.
  ensureManualTestCacheDirectory(root);
}

const projectId = getLocalProjectId();
console.log(
  reuse
    ? "Starter eller gjenopptar kun lokal Supabase uten å nullstille testdata …"
    : "Starter og nullstiller kun lokal Supabase …",
);
// `supabase start` prints local credentials to stdout. Never forward them.
run(process.execPath, [supabase, "start"], { suppressStdout: true });
if (!reuse) {
  run(process.execPath, [supabase, "db", "reset", "--local"]);
  // Reset recreates service containers. Restarting the local gateway makes it
  // resolve their new Docker addresses before health checks and seeding.
  run(
    "docker",
    ["restart", getLocalContainer("auth"), getLocalContainer("kong")],
    { suppressStdout: true },
  );
}

const status = parseSupabaseEnv(
  run(process.execPath, [supabase, "status", "--output", "env"], {
    capture: true,
  }),
);
const apiUrl = assertLocalSupabaseUrl(status.API_URL ?? "");
const databaseUrl = assertLocalDatabaseUrl(status.DB_URL ?? "");
const anonKey = status.ANON_KEY ?? status.PUBLISHABLE_KEY;
const serviceRoleKey = status.SERVICE_ROLE_KEY ?? status.SECRET_KEY;
if (!anonKey || !serviceRoleKey) {
  throw new Error("Fant ikke lokale Supabase-nøkler i `supabase status`.");
}
await waitForLocalAuth(apiUrl);

const ownerCreatedAtBeforeSetup = reuse
  ? await getOwnerCreatedAt(databaseUrl)
  : null;
let studentCodePepper;
let interruptedScenarioId = null;
if (reuse) {
  try {
    const cached = readManualTestCache(
      {
        root,
        projectId,
        apiUrl,
        databaseUrl,
        anonKey,
        serviceRoleKey,
        ownerCreatedAt: ownerCreatedAtBeforeSetup,
      },
      { allowDirty: roleDev },
    );
    studentCodePepper = cached.studentCodePepper;
    if (cached.manifest.dirtySince !== null) {
      interruptedScenarioId = cached.manifest.activeScenarioId ?? null;
      if (!interruptedScenarioId) {
        throw new Error(
          "Forrige utforskingsøkt mangler sikker scenarioproveniens og kan ikke gjenopprettes. Bruk `npm run lab:reset` for en ny lokal fixture.",
        );
      }
      if (
        cached.manifest.activeRunId !==
          releaseRunnerLock.recoveredStaleLockOwner ||
        !releaseRunnerLock.recoveredStaleLock
      ) {
        throw new Error(
          "Dirty-markeringen matcher ikke en kontrollert foreldreløs runner-lås og kan ikke gjenopprettes.",
        );
      }
      adoptInterruptedManualTestRun(
        root,
        interruptedScenarioId,
        releaseRunnerLock.recoveredStaleLockOwner,
        releaseRunnerLock.owner,
      );
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${reason}\nKjør \`npm run lab:reset\` for å lage en ny, lokal syntetisk testverden. Ingen data ble nullstilt.`,
    );
  }
} else {
  studentCodePepper = randomBytes(32).toString("hex");
}

const inheritedEnvironment = { ...process.env };
delete inheritedEnvironment.KLAR_AUTH_DIRECTORY;
const baseEnvironment = {
  ...inheritedEnvironment,
  NEXT_PUBLIC_SUPABASE_URL: apiUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  STUDENT_CODE_PEPPER: studentCodePepper,
  KLAR_E2E_AUTH: "1",
  KLAR_E2E_MODE: mode,
  KLAR_E2E_BROWSER: browser,
  KLAR_LAB_CHECK: labCheck ? "1" : "0",
  KLAR_LOCAL_RUNNER_ID: releaseRunnerLock.owner,
  ...createLocalRunnerSelectors({ mode, roleDev, reuse }),
  KLAR_E2E_DB_URL: databaseUrl,
  PILOT_ENABLED: "true",
  NEXT_PUBLIC_FEATURE_LEGACY_2X: "false",
  NEXT_PUBLIC_FEATURE_PUSH_NOTIFICATIONS: "false",
  FEATURE_SMART_IMPORT_AI: "false",
  TZ: "Europe/Oslo",
};

let testEnvironment = baseEnvironment;
if (!reuse) {
  testEnvironment = {
    ...baseEnvironment,
    KLAR_E2E_OWNER_EMAIL: "owner@e2e.klar.invalid",
    KLAR_E2E_OWNER_PASSWORD: `E2E-${randomBytes(18).toString("base64url")}aA1!`,
    KLAR_E2E_SUBSTITUTE_EMAIL: "substitute@e2e.klar.invalid",
    KLAR_E2E_SUBSTITUTE_PASSWORD: `E2E-${randomBytes(18).toString("base64url")}aA1!`,
    KLAR_E2E_VISUAL_STAFF_EMAIL: "visual-staff@e2e.klar.invalid",
    KLAR_E2E_VISUAL_STAFF_PASSWORD: `E2E-${randomBytes(18).toString("base64url")}aA1!`,
    KLAR_E2E_VISUAL_OWNER_EMAIL: "visual-owner@e2e.klar.invalid",
    KLAR_E2E_VISUAL_OWNER_PASSWORD: `E2E-${randomBytes(18).toString("base64url")}aA1!`,
    KLAR_E2E_OTHER_STAFF_EMAIL: "other-staff@e2e.klar.invalid",
    KLAR_E2E_OTHER_STAFF_PASSWORD: `E2E-${randomBytes(18).toString("base64url")}aA1!`,
    KLAR_E2E_STUDENT_CODE: `E2E-${randomBytes(5).toString("hex").toUpperCase()}`,
    KLAR_E2E_STUDENT_PASSWORD: `E2E-${randomBytes(18).toString("base64url")}aA1!`,
    KLAR_E2E_VISUAL_STUDENT_CODE: `VIS-2${randomBytes(5).toString("hex").toUpperCase()}`,
    KLAR_E2E_VISUAL_STUDENT_PASSWORD: `E2E-${randomBytes(18).toString("base64url")}aA1!`,
    KLAR_E2E_REWARD_STUDENT_CODE: `B2R-${randomBytes(5).toString("hex").toUpperCase()}`,
    KLAR_E2E_REWARD_STUDENT_PASSWORD: `E2E-${randomBytes(18).toString("base64url")}aA1!`,
    KLAR_E2E_REWARD_VISUAL_STUDENT_CODE: `B2V-${randomBytes(5).toString("hex").toUpperCase()}`,
    KLAR_E2E_REWARD_VISUAL_STUDENT_PASSWORD: `E2E-${randomBytes(18).toString("base64url")}aA1!`,
    KLAR_E2E_PROGRESS_VISUAL_STUDENT_CODE: `B2P-${randomBytes(5).toString("hex").toUpperCase()}`,
    KLAR_E2E_PROGRESS_VISUAL_STUDENT_PASSWORD: `E2E-${randomBytes(18).toString("base64url")}aA1!`,
    KLAR_E2E_D2_STUDENT_CODE: `D2-${randomBytes(5).toString("hex").toUpperCase()}`,
    KLAR_E2E_D2_STUDENT_PASSWORD: `E2E-${randomBytes(18).toString("base64url")}aA1!`,
    KLAR_E2E_RETURN_STUDENT_PASSWORD: `E2E-${randomBytes(18).toString("base64url")}aA1!`,
  };
  run(process.execPath, ["scripts/e2e/seed-local.mjs"], { env: testEnvironment });
}

if (!roleDev) {
  run(process.execPath, [npm, "run", "build"], { env: testEnvironment });
  run(process.execPath, [playwright, "test", ...(spec ? [spec] : [])], {
    env: testEnvironment,
  });
} else {
  const cachePaths = getManualTestCachePaths(root);
  if (!reuse) {
    const setupEnvironment = {
      ...testEnvironment,
      KLAR_AUTH_DIRECTORY: cachePaths.directory,
      ...createLocalRunnerSelectors({ mode, roleDev, reuse: false }),
    };
    run(
      process.execPath,
      [playwright, "test", "tests/e2e/auth.setup.ts", "--project=auth-setup"],
      { env: setupEnvironment },
    );
    writeManualTestCache({
      root,
      projectId,
      apiUrl,
      databaseUrl,
      anonKey,
      serviceRoleKey,
      ownerCreatedAt: await getOwnerCreatedAt(databaseUrl),
      studentCodePepper,
    });
  }

  const runScenario = async (scenario, recovering = false) => {
    const environment = {
      ...testEnvironment,
      KLAR_AUTH_DIRECTORY: cachePaths.directory,
      KLAR_MANUAL_SCENARIO: scenario.id,
      KLAR_RECOVER_INTERRUPTED_RUN: recovering ? "1" : "0",
      ...createLocalRunnerSelectors({ mode, roleDev, reuse: true }),
    };
    run(
      process.execPath,
      [
        playwright,
        "test",
        "tests/e2e/manual/a1-desktop.manual.spec.ts",
        "--project=manual-a1-desktop",
      ],
      { env: environment },
    );
  };

  const directScenario = requestedScenario ?? (labCheck ? "day" : null);
  if (interruptedScenarioId) {
    const interruptedScenario = getManualTestScenario(interruptedScenarioId);
    console.log(
      `Forrige kjøring av «${interruptedScenario.label}» ble avbrutt. Scenarioet åpnes først for identitetskontroll og ryddig avslutning.`,
    );
    await assertScenarioFixtureReady(databaseUrl, interruptedScenario.id);
    await runScenario(interruptedScenario, true);
  }
  if (directScenario && directScenario !== interruptedScenarioId) {
    const scenario = getManualTestScenario(directScenario);
    await assertScenarioFixtureReady(databaseUrl, scenario.id);
    await runScenario(scenario);
  } else if (!directScenario) {
    while (true) {
      let scenario;
      try {
        scenario = await chooseScenario();
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        continue;
      }
      if (!scenario) break;
      try {
        await assertScenarioFixtureReady(databaseUrl, scenario.id);
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        continue;
      }
      await runScenario(scenario);
    }
  }
  console.log(
    "Det lokale utforskingsverkstedet er avsluttet. Supabase og endringene kjører videre til eksplisitt nullstilling eller `npx supabase stop`.",
  );
}

if (!roleDev && mode === "manual") {
  console.log(
    "Manuell A1-desktopøkt er avsluttet. Før faktiske resultater i QA-protokollen; økten er ikke automatisk beståttbevis.",
  );
} else if (!roleDev) {
  console.log("Autentisert E2E er grønn. Lokal Supabase kjører videre for iterasjon.");
}
console.log("Stopp den senere med: npx supabase stop");
process.removeListener("exit", releaseRunnerLockOnExit);
releaseRunnerLock();

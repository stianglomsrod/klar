import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createConnection } from "node:net";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  assertLocalDatabaseUrl,
  assertLocalSupabaseUrl,
  parseSupabaseEnv,
} from "./e2e/local-safety.mjs";

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

function getLocalContainer(service) {
  const config = readFileSync(path.join(root, "supabase", "config.toml"), "utf8");
  const projectId = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
  if (!projectId || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(projectId)) {
    throw new Error("Fant ikke et trygt lokalt project_id i Supabase-konfigurasjonen.");
  }
  return `supabase_${service}_${projectId}`;
}

const modeArgument = process.argv.find((argument) => argument.startsWith("--mode="));
const browserArgument = process.argv.find((argument) =>
  argument.startsWith("--browser="),
);
const mode = modeArgument?.split("=")[1] ?? "smoke";
const browser = browserArgument?.split("=")[1] ?? "chromium";
if (!["smoke", "staff", "visual", "full", "manual"].includes(mode)) {
  throw new Error("E2E-modus må være smoke, staff, visual, full eller manual.");
}
if (!["chromium", "webkit"].includes(browser)) {
  throw new Error("E2E-browser må være chromium eller webkit.");
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
  if (browser !== "chromium") {
    throw new Error("Manuell A1-desktop-QA støtter bare Chromium.");
  }
  if (process.env.CI || !process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "Manuell A1-desktop-QA må startes av en person i en interaktiv terminal.",
    );
  }
  if (await isPortOpen("127.0.0.1", 3100)) {
    throw new Error(
      "Port 3100 er i bruk. Stopp den eksisterende Klar-serveren før manuell A1-desktop-QA; den blir ikke gjenbrukt fordi miljøet ikke kan verifiseres sikkert.",
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
      // A reset restarts Auth after the CLI has returned. Retry locally only.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Lokal Supabase Auth ble ikke klar innen 45 sekunder.");
}

if (!existsSync(supabase) || !existsSync(playwright) || !npm || !existsSync(npm)) {
  throw new Error("Kjør npm ci før autentisert E2E.");
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

console.log("Starter og nullstiller kun lokal Supabase …");
// `supabase start` prints local credentials to stdout. Never forward them to
// terminal logs; progress and actionable failures still arrive on stderr.
run(process.execPath, [supabase, "start"], { suppressStdout: true });
run(process.execPath, [supabase, "db", "reset", "--local"]);
// A local reset recreates service containers. Restarting the local gateway
// makes it resolve their new Docker addresses before health checks and seeding.
run(
  "docker",
  ["restart", getLocalContainer("auth"), getLocalContainer("kong")],
  { suppressStdout: true },
);
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

const testEnvironment = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: apiUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  STUDENT_CODE_PEPPER: randomBytes(32).toString("hex"),
  KLAR_E2E_AUTH: "1",
  KLAR_E2E_MODE: mode,
  KLAR_E2E_BROWSER: browser,
  ...(mode === "manual" ? { KLAR_MANUAL_QA: "1" } : {}),
  KLAR_E2E_DB_URL: databaseUrl,
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
  KLAR_E2E_VISUAL_STUDENT_CODE: `VIS-${randomBytes(5).toString("hex").toUpperCase()}`,
  KLAR_E2E_VISUAL_STUDENT_PASSWORD: `E2E-${randomBytes(18).toString("base64url")}aA1!`,
  PILOT_ENABLED: "true",
  NEXT_PUBLIC_FEATURE_LEGACY_2X: "false",
  NEXT_PUBLIC_FEATURE_PUSH_NOTIFICATIONS: "false",
  FEATURE_SMART_IMPORT_AI: "false",
  TZ: "Europe/Oslo",
};

run(process.execPath, ["scripts/e2e/seed-local.mjs"], { env: testEnvironment });
run(process.execPath, [npm, "run", "build"], { env: testEnvironment });
run(process.execPath, [playwright, "test"], { env: testEnvironment });

if (mode === "manual") {
  console.log(
    "Manuell A1-desktopøkt er avsluttet. Før faktiske resultater i QA-protokollen; økten er ikke automatisk beståttbevis.",
  );
} else {
  console.log("Autentisert E2E er grønn. Lokal Supabase kjører videre for iterasjon.");
}
console.log("Stopp den senere med: npx supabase stop");

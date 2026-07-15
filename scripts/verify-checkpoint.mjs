import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const npm = process.env.npm_execpath;
if (!npm || !existsSync(npm)) {
  throw new Error("Kjør kontrollpunktporten gjennom npm run verify:checkpoint.");
}
const environment = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "checkpoint-placeholder-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "checkpoint-placeholder-service-role-key",
  STUDENT_CODE_PEPPER: "checkpoint-placeholder-pepper-at-least-32-characters",
  PILOT_ENABLED: "true",
  NEXT_PUBLIC_FEATURE_LEGACY_2X: "false",
  NEXT_PUBLIC_FEATURE_PUSH_NOTIFICATIONS: "false",
  FEATURE_SMART_IMPORT_AI: "false",
};

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
    shell: false,
  });
  if (result.error || result.status !== 0) {
    throw result.error ?? new Error(`${command} avsluttet med kode ${result.status}.`);
  }
}

run("git", ["diff", "HEAD", "--check"]);
run(process.execPath, [npm, "run", "check"]);
run(process.execPath, [npm, "run", "build"]);
run(process.execPath, [npm, "run", "test:e2e"]);
run(process.execPath, [npm, "audit", "--omit=dev", "--audit-level=high"]);

console.log("Kontrollpunktporten er grønn.");

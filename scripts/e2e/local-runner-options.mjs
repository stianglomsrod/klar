import { getManualTestScenario } from "./manual-test-scenarios.mjs";

const allowedModes = new Set(["smoke", "staff", "visual", "full", "manual"]);
const allowedBrowsers = new Set(["chromium", "webkit"]);

function singleValueArgument(argv, prefix, label) {
  const matches = argv.filter((argument) => argument.startsWith(prefix));
  if (matches.length > 1) {
    throw new Error(`${label} kan bare angis én gang.`);
  }
  return matches[0]?.slice(prefix.length) ?? null;
}

export function parseLocalRunnerOptions(argv) {
  const mode = singleValueArgument(argv, "--mode=", "E2E-modus") ?? "smoke";
  const browser =
    singleValueArgument(argv, "--browser=", "E2E-browser") ?? "chromium";
  const rawSpec = singleValueArgument(argv, "--spec=", "Målrettet E2E-spec");
  const spec = rawSpec?.replaceAll("\\", "/") ?? null;
  const roleDev = argv.includes("--dev");
  const reuse = argv.includes("--reuse");
  const listScenarios = argv.includes("--list-scenarios");
  const labCheck = argv.includes("--lab-check");
  const scenario = singleValueArgument(
    argv,
    "--scenario=",
    "Lokalt testscenario",
  );

  const knownArguments = argv.filter(
    (argument) =>
      argument === "--dev" ||
      argument === "--reuse" ||
      argument === "--list-scenarios" ||
      argument === "--lab-check" ||
      argument.startsWith("--mode=") ||
      argument.startsWith("--browser=") ||
      argument.startsWith("--spec=") ||
      argument.startsWith("--scenario="),
  );
  if (knownArguments.length !== argv.length) {
    throw new Error("Den lokale E2E-starteren fikk et ukjent argument.");
  }
  for (const flag of ["--dev", "--reuse", "--list-scenarios", "--lab-check"]) {
    if (argv.filter((argument) => argument === flag).length > 1) {
      throw new Error(`${flag} kan bare angis én gang.`);
    }
  }

  if (!allowedModes.has(mode)) {
    throw new Error("E2E-modus må være smoke, staff, visual, full eller manual.");
  }
  if (!allowedBrowsers.has(browser)) {
    throw new Error("E2E-browser må være chromium eller webkit.");
  }
  if (
    spec !== null &&
    (!/^tests\/e2e\/[a-z0-9_./-]+\.spec\.ts$/i.test(spec) || spec.includes(".."))
  ) {
    throw new Error(
      "Målrettet E2E-spec må ligge under tests/e2e og ende på .spec.ts.",
    );
  }
  if (mode === "manual" && browser !== "chromium") {
    throw new Error("Manuell A1-desktop-QA og lokal rolleutvikling støtter bare Chromium.");
  }
  if (roleDev && mode !== "manual") {
    throw new Error("--dev kan bare brukes sammen med --mode=manual.");
  }
  if ((reuse || listScenarios || labCheck || scenario !== null) && !roleDev) {
    throw new Error(
      "Gjenbruk og scenariovalg kan bare brukes for lokal rolleutvikling.",
    );
  }
  if (reuse && spec !== null) {
    throw new Error("Gjenbruk kan ikke kombineres med en målrettet E2E-spec.");
  }
  if (labCheck && listScenarios) {
    throw new Error("Automatisk labkontroll kan ikke kombineres med listing.");
  }
  if (scenario !== null) getManualTestScenario(scenario);

  return {
    mode,
    browser,
    spec,
    roleDev,
    reuse,
    listScenarios,
    labCheck,
    scenario,
  };
}

export function createLocalWebServerCommand({ roleDev, port }) {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("Lokal app-port må være et gyldig heltall.");
  }
  const command = roleDev ? "dev" : "start";
  const bundler = roleDev ? " --webpack" : "";
  return `npm run ${command} -- --hostname 127.0.0.1 --port ${port}${bundler}`;
}

export function createLocalRunnerSelectors({ mode, roleDev, reuse = false }) {
  return {
    KLAR_MANUAL_QA: mode === "manual" ? "1" : "0",
    KLAR_ROLE_DEV: roleDev ? "1" : "0",
    KLAR_MANUAL_REUSE: reuse ? "1" : "0",
  };
}

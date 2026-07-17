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

  return { mode, browser, spec, roleDev };
}

export function createLocalWebServerCommand({ roleDev, port }) {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("Lokal app-port må være et gyldig heltall.");
  }
  const command = roleDev ? "dev" : "start";
  const bundler = roleDev ? " --webpack" : "";
  return `npm run ${command} -- --hostname 127.0.0.1 --port ${port}${bundler}`;
}

export function createLocalRunnerSelectors({ mode, roleDev }) {
  return {
    KLAR_MANUAL_QA: mode === "manual" ? "1" : "0",
    KLAR_ROLE_DEV: roleDev ? "1" : "0",
  };
}

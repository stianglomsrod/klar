import path from "node:path";
import {
  expect,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { getManualTestScenario } from "../../../scripts/e2e/manual-test-scenarios.mjs";
import {
  markManualTestCacheDirty,
  refreshManualTestCacheStateHashes,
  writeManualTestStorageState,
} from "../../../scripts/e2e/manual-test-cache.mjs";

type ScenarioSession = {
  label: string;
  route: string;
  state: string;
  heading: string;
  actorId?: string;
};

const canonicalAuthDirectory = path.join(process.cwd(), "playwright", ".auth");
const labAuthDirectory = path.join(canonicalAuthDirectory, "lab");
const roleDev = process.env.KLAR_ROLE_DEV === "1";
const labCheck = process.env.KLAR_LAB_CHECK === "1";
const recoveringInterruptedRun =
  process.env.KLAR_RECOVER_INTERRUPTED_RUN === "1";
const localRunnerId = process.env.KLAR_LOCAL_RUNNER_ID ?? null;

const formalQaSessions = [
  {
    label: "Eier – tilgangskontroll",
    route: "/v3/teacher/access",
    state: "owner-aal2.json",
    heading: "Tilganger",
  },
  {
    label: "Ansatt – klasseflate",
    route: "/v3/teacher/classes/30000000-0000-4000-8000-000000000002",
    state: "visual-staff-aal2.json",
    heading: "Visuell klasse 4B",
  },
  {
    label: "Elev – dagsflate",
    route: "/v3/student",
    state: "visual-student.json",
    heading: "Hei, Visuell elev",
  },
] as const;

async function persistLabContexts(
  opened: Array<{ context: BrowserContext; session: ScenarioSession }>,
  cleanClose: boolean,
) {
  if (!roleDev || opened.length === 0) return;
  for (const { context, session } of opened) {
    writeManualTestStorageState(
      process.cwd(),
      session.state,
      await context.storageState(),
    );
  }
  refreshManualTestCacheStateHashes(
    process.cwd(),
    cleanClose,
    localRunnerId,
  );
}

async function assertExpectedLabIdentity(
  context: BrowserContext,
  session: ScenarioSession,
  baseURL: string,
) {
  if (!roleDev || !session.actorId) return;
  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!apiUrl || !anonKey) {
    throw new Error("Lokal Supabase-konfigurasjon mangler for rollekontroll.");
  }
  const contextCookies = await context.cookies(baseURL);
  const rotatedCookies: Array<{ name: string; value: string }> = [];
  const supabase = createServerClient(apiUrl, anonKey, {
    cookies: {
      getAll: () =>
        contextCookies.map(({ name, value }) => ({ name, value })),
      setAll: (cookiesToSet) => {
        rotatedCookies.push(
          ...cookiesToSet.map(({ name, value }) => ({ name, value })),
        );
      },
    },
  });
  if (recoveringInterruptedRun) {
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      throw new Error(
        `Den avbrutte lokale økten «${session.label}» kunne ikke fornyes. Kjør \`npm run lab:reset\`.`,
      );
    }
    if (rotatedCookies.length > 0) {
      await context.addCookies(
        rotatedCookies.map(({ name, value }) => ({
          name,
          value,
          url: baseURL,
        })),
      );
    }
  }
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || user?.id !== session.actorId) {
    throw new Error(
      `Den aktive lokale økten matcher ikke den syntetiske rollen «${session.label}». Kjør \`npm run lab:reset\`.`,
    );
  }
  if (session.state.endsWith("-aal2.json")) {
    const { data, error } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || data.currentLevel !== "aal2") {
      throw new Error(
        `Den aktive lokale voksenøkten «${session.label}» mangler AAL2. Kjør \`npm run lab:reset\`.`,
      );
    }
  }
}

async function assertExpectedLabIdentities(
  opened: Array<{ context: BrowserContext; session: ScenarioSession }>,
  baseURL: string,
) {
  for (const { context, session } of opened) {
    await assertExpectedLabIdentity(context, session, baseURL);
  }
}

test("åpner isolerte vinduer for lokal utforsking eller manuell desktop-QA", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(0);
  if (process.env.KLAR_MANUAL_QA !== "1") {
    throw new Error(
      "Denne starteren kan bare brukes via de dokumenterte lokale npm-kommandoene.",
    );
  }
  if (baseURL !== "http://127.0.0.1:3100") {
    throw new Error("Lokal utforsking og manuell QA krever fast loopback-origin.");
  }

  const scenario = roleDev
    ? getManualTestScenario(process.env.KLAR_MANUAL_SCENARIO ?? "day")
    : null;
  const sessions = scenario?.sessions ?? formalQaSessions;
  const authDirectory = roleDev ? labAuthDirectory : canonicalAuthDirectory;
  const opened: Array<{
    context: BrowserContext;
    page: Page;
    session: ScenarioSession;
  }> = [];

  try {
    if (roleDev) {
      markManualTestCacheDirty(
        process.cwd(),
        scenario?.id ?? "day",
        localRunnerId,
      );
    }
    for (const session of sessions) {
      const context = await browser.newContext({
        baseURL,
        storageState: path.join(authDirectory, session.state),
        viewport: null,
        locale: "nb-NO",
        timezoneId: "Europe/Oslo",
        colorScheme: "light",
        serviceWorkers: "block",
      });
      const page = await context.newPage();
      opened.push({ context, page, session });
      await page.goto(session.route, {
        waitUntil: roleDev ? "domcontentloaded" : "networkidle",
      });
      await expect(page).toHaveURL(new URL(session.route, baseURL).toString());
      if (!roleDev || labCheck) {
        await expect(
          page.getByRole("heading", { name: session.heading, exact: true }),
        ).toBeVisible();
      }
      await assertExpectedLabIdentity(context, session, baseURL);
      console.log(`${session.label}: ${new URL(session.route, baseURL)}`);
    }

    await persistLabContexts(opened, false);
    await opened[0]?.page.bringToFront();
    if (labCheck) {
      await persistLabContexts(opened, true);
      return;
    }
    console.log(
      roleDev
        ? `Scenario «${scenario?.label}» er åpnet med ekte, isolerte lokale økter. Endringer blir stående til eksplisitt nullstilling. Lukk alle vinduene for å gå tilbake til scenariomenyen.`
        : "Tre isolerte syntetiske rolle-vinduer er åpne. Lukk alle tre for en ryddig avslutning; Ctrl+C er bare nødavslutning.",
    );
    await Promise.all(
      opened.map(({ page }) =>
        page.isClosed() ? Promise.resolve() : page.waitForEvent("close"),
      ),
    );
    await assertExpectedLabIdentities(opened, baseURL);
    await persistLabContexts(opened, true);
    test.skip(
      true,
      roleDev
        ? "Utforskingsverkstedet registrerer ikke et QA-resultat."
        : "Desktopstarteren registrerer ikke utfallet av den manuelle kontrollen.",
    );
  } finally {
    await Promise.all(
      opened.map(({ context }) => context.close().catch(() => undefined)),
    );
  }
});

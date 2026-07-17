import path from "node:path";
import {
  expect,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";

const authDirectory = path.join(process.cwd(), "playwright", ".auth");
const roleDev = process.env.KLAR_ROLE_DEV === "1";

const allSessions = [
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

test("åpner isolerte A1-vinduer for manuell desktop-QA", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(0);
  const sessions = roleDev
    ? allSessions.filter((session) => session.state !== "owner-aal2.json")
    : allSessions;
  if (process.env.KLAR_MANUAL_QA !== "1") {
    throw new Error(
      "Denne testen kan bare startes med npm run qa:a1:desktop eller npm run dev:roles.",
    );
  }
  if (baseURL !== "http://127.0.0.1:3100") {
    throw new Error(
      roleDev
        ? "Lokal rolleutvikling krever fast loopback-origin."
        : "Manuell A1-desktop-QA krever fast loopback-origin.",
    );
  }

  const opened: Array<{
    context: BrowserContext;
    page: Page;
  }> = [];

  try {
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
      await page.goto(session.route, {
        waitUntil: roleDev ? "domcontentloaded" : "networkidle",
      });
      await expect(page).toHaveURL(new URL(session.route, baseURL).toString());
      await expect(
        page.getByRole("heading", { name: session.heading, exact: true }),
      ).toBeVisible();
      opened.push({ context, page });
      console.log(`${session.label}: ${new URL(session.route, baseURL)}`);
    }

    await opened[0]?.page.bringToFront();
    console.log(
      roleDev
        ? "To isolerte syntetiske vinduer er åpne med hot reload: lærer og elev. Lukk begge for en ryddig avslutning; Ctrl+C er nødavslutning."
        : "Tre isolerte syntetiske rolle-vinduer er åpne. Lukk alle tre for en ryddig avslutning; Ctrl+C er bare nødavslutning.",
    );
    await Promise.all(
      opened.map(({ page }) =>
        page.isClosed() ? Promise.resolve() : page.waitForEvent("close"),
      ),
    );
    test.skip(
      true,
      roleDev
        ? "Utviklerstarteren registrerer ikke et QA-resultat."
        : "Desktopstarteren registrerer ikke utfallet av den manuelle kontrollen.",
    );
  } finally {
    await Promise.all(
      opened.map(({ context }) => context.close().catch(() => undefined)),
    );
  }
});

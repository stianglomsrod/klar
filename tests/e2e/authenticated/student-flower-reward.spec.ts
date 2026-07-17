import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { openLocalDatabase } from "../support/local-database";
import { expectNoAxeViolations, observeRuntimeErrors } from "../support/quality";

const authDirectory = path.join(process.cwd(), "playwright", ".auth");
const organizationId = "20000000-0000-4000-8000-000000000001";
const rewardClassId = "30000000-0000-4000-8000-000000000007";
const rewardStudentId = "10000000-0000-4000-8000-000000000017";
const taskTitle = "Fullfør første milepæl";

async function openTask(page: Page) {
  const button = page.getByRole("button", {
    name: `Åpne oppgaven ${taskTitle}`,
  });
  if (!(await button.isVisible())) {
    const details = page.locator("details").filter({ hasText: taskTitle });
    await details.locator("summary").click();
  }
  await expect(button).toBeVisible();
  await button.click();
  return page.getByRole("dialog", { name: taskTitle });
}

async function completeTask(page: Page) {
  const dialog = await openTask(page);
  await dialog.getByRole("button", { name: "Fullfør" }).click();
  const checkpoint = page.getByRole("dialog", { name: "Er du ferdig?" });
  await expect(checkpoint).toBeVisible();
  await checkpoint.getByRole("button", { name: "Ferdig" }).click();
  await expect(checkpoint).toBeHidden();
}

async function setOwnGardenVisibility(page: Page, visible: boolean) {
  await page.goto("/v3/student");
  const controls = page.locator("details").filter({ hasText: "Tilpass visningen" });
  if (!(await controls.getAttribute("open"))) {
    await controls.locator("summary").click();
  }
  const checkbox = controls.getByRole("checkbox", { name: "Vis blomsterhagen" });
  if (visible) await checkbox.check();
  else await checkbox.uncheck();
  await controls.getByRole("button", { name: "Lagre visning" }).click();
  await expect(controls.getByRole("status")).toHaveText("Visningen er lagret.");
}

async function expectGardenRouteRedirect(page: Page) {
  await page.evaluate(() => window.location.assign("/v3/student/rewards"));
  await page.waitForURL((url) => url.pathname === "/v3/student");
}

test("første nivå gir ett varig kronblad uten farming eller tvang", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const database = await openLocalDatabase();
  const expectNoRuntimeErrors = observeRuntimeErrors(page);
  let ownerContext: Awaited<ReturnType<typeof browser.newContext>> | null = null;

  try {
    await page.goto("/v3/student");
    await expect(
      page.getByRole("heading", { name: "Hei, Belønningselev" }),
    ).toBeVisible();
    await completeTask(page);

    await expect(
      page.getByText(
        "Oppgaven er ferdig. Et kronblad venter i blomsterhagen.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Åpne blomsterhagen" }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const pendingShortcut = page.getByRole("link", {
      name: "Et kronblad venter i blomsterhagen",
    });
    // Wait for the server-component refresh that updates the persistent shell
    // before testing a reload. WebKit reports an intentionally aborted RSC
    // request as a runtime error if navigation wins this race.
    await expect(pendingShortcut).toBeVisible();
    await page.reload();
    await expect(pendingShortcut).toBeVisible();
    await pendingShortcut.click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Blomsterhagen" }),
    ).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(8);
    for (const color of [
      "Rød",
      "Turkis",
      "Grønn",
      "Rosa",
      "Lilla",
      "Oransje",
      "Gul",
      "Blå",
    ]) {
      await expect(page.getByRole("radio", { name: color })).toBeVisible();
    }
    const turquoise = page.getByRole("radio", { name: "Turkis" });
    await page.getByText("Turkis", { exact: true }).click();
    await expect(turquoise).toBeChecked();
    await page.getByRole("button", { name: "Legg til kronblad" }).click();
    const savedMessage = page.getByText(
      "Kronbladet er lagt til i blomsterhagen.",
    );
    await expect(savedMessage).toBeFocused();
    await expect(
      page.getByRole("img", {
        name: "Blomst 1, 1 av 5 kronblader valgt",
      }),
    ).toBeVisible();

    await expect(pendingShortcut).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "Alle opptjente kronblad er valgt",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", {
        name: "Blomst 1, 1 av 5 kronblader valgt",
      }),
    ).toBeVisible();

    await page.goto("/v3/student");
    const completedDialog = await openTask(page);
    await completedDialog
      .getByRole("button", { name: "Angre fullføring" })
      .click();
    await expect(
      page.getByText("Oppgaven er klar igjen. Poengene er justert."),
    ).toBeVisible();
    await page.goto("/v3/student/rewards");
    await expect(
      page.getByRole("img", {
        name: "Blomst 1, 1 av 5 kronblader valgt",
      }),
    ).toBeVisible();

    await page.goto("/v3/student");
    await completeTask(page);
    await expect(
      page.getByText("Oppgaven er ferdig. Du fikk 10 poeng."),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("link", { name: /kronblad venter i blomsterhagen/ }),
    ).toHaveCount(0);

    await setOwnGardenVisibility(page, false);
    await page.reload();
    await page.getByRole("button", { name: "Åpne meny" }).click();
    await expect(
      page.getByRole("dialog", { name: "Meny" }).getByRole("link", {
        name: "Blomsterhagen",
      }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expectGardenRouteRedirect(page);

    await setOwnGardenVisibility(page, true);
    await page.reload();
    await page.getByRole("button", { name: "Åpne meny" }).click();
    await page
      .getByRole("dialog", { name: "Meny" })
      .getByRole("link", { name: "Blomsterhagen" })
      .click();
    await expect(
      page.getByRole("img", {
        name: "Blomst 1, 1 av 5 kronblader valgt",
      }),
    ).toBeVisible();

    if (!baseURL) throw new Error("Playwright baseURL mangler.");
    ownerContext = await browser.newContext({
      baseURL,
      storageState: path.join(authDirectory, "owner-aal2.json"),
    });
    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto(`/v3/teacher/classes/${rewardClassId}`);
    const studentRow = ownerPage
      .getByRole("region", { name: "Elever" })
      .locator("ul > li")
      .filter({ hasText: "Belønningselev" });
    await studentRow.getByText("Tilpass visning", { exact: true }).click();
    const staffGate = studentRow.getByRole("checkbox", {
      name: "Blomsterhage tilgjengelig",
    });
    await staffGate.uncheck();
    await studentRow.getByRole("button", { name: "Lagre" }).click();
    await expect(studentRow.getByRole("status")).toHaveText("Lagret.");

    await expectGardenRouteRedirect(page);
    await staffGate.check();
    await studentRow.getByRole("button", { name: "Lagre" }).click();
    await expect(studentRow.getByRole("status")).toHaveText("Lagret.");
    await page.goto("/v3/student/rewards");
    await expect(
      page.getByRole("img", {
        name: "Blomst 1, 1 av 5 kronblader valgt",
      }),
    ).toBeVisible();

    await expectNoAxeViolations(page);
    expectNoRuntimeErrors();

    const proof = await database.query<{
      xp_balance: number;
      current_level: number;
      highest_level: number;
      claims: number;
      entitlements: number;
      selected: number;
      collection_sequence: number;
      progress_enabled: boolean;
      flower_rewards_allowed: boolean;
      flower_rewards_visible: boolean;
    }>(
      `
        select
          progress.xp_balance::integer,
          progress.current_level::integer,
          progress.highest_level::integer,
          (select count(*)::integer from public.reward_claims where organization_id = $1::uuid and student_id = $2::uuid) as claims,
          (select count(*)::integer from public.level_reward_entitlements where organization_id = $1::uuid and student_id = $2::uuid) as entitlements,
          (select count(*)::integer from public.level_reward_entitlements where organization_id = $1::uuid and student_id = $2::uuid and status = 'selected') as selected,
          (select max(collection_sequence)::integer from public.reward_claims where organization_id = $1::uuid and student_id = $2::uuid) as collection_sequence,
          settings.progress_enabled,
          settings.flower_rewards_allowed,
          settings.flower_rewards_visible
        from public.student_progress as progress
        join public.student_experience_settings as settings
          on settings.organization_id = progress.organization_id
         and settings.student_id = progress.student_id
        where progress.organization_id = $1::uuid
          and progress.student_id = $2::uuid
      `,
      [organizationId, rewardStudentId],
    );
    expect(proof.rows[0]).toEqual({
      xp_balance: 1000,
      current_level: 2,
      highest_level: 2,
      claims: 1,
      entitlements: 1,
      selected: 1,
      collection_sequence: 1,
      progress_enabled: true,
      flower_rewards_allowed: true,
      flower_rewards_visible: true,
    });
  } finally {
    await ownerContext?.close();
    await database.end();
  }
});

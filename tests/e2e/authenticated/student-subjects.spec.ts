import { expect, test } from "@playwright/test";
import {
  expectMinimumTargetSize,
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  observeRuntimeErrors,
} from "../support/quality";

test("eleven finner alle synlige oppgaver samlet etter fag", async ({ page }) => {
  const expectNoRuntimeErrors = observeRuntimeErrors(page);
  await page.goto("/v3/student");

  const menuButton = page.getByRole("button", { name: "Åpne meny" });
  await expectMinimumTargetSize(menuButton);
  await menuButton.click();

  const menu = page.getByRole("dialog", { name: "Meny" });
  const navigation = menu.getByRole("navigation", { name: "Elevmeny" });
  await expect(navigation.getByRole("link")).toHaveCount(2);
  await expect(
    navigation.getByRole("link", { name: "Dagen i dag" }),
  ).toHaveAttribute("aria-current", "page");

  const subjectsNavigationLink = navigation.getByRole("link", {
    name: "Fag og oppgaver",
  });
  await expectMinimumTargetSize(subjectsNavigationLink);
  await subjectsNavigationLink.click();

  await expect(page).toHaveURL(/\/v3\/student\/subjects$/);
  const main = page.locator("main#main-content");
  await expect(main).toBeFocused();
  await expect(
    page.getByRole("heading", { level: 1, name: "Fag og oppgaver" }),
  ).toBeVisible();

  const subjectList = page.getByRole("list");
  const norwegian = subjectList.getByRole("link", { name: /^Norsk,/ });
  const mathematics = subjectList.getByRole("link", {
    name: /^Matematikk,/,
  });
  await expect(norwegian).toBeVisible();
  await expect(mathematics).toBeVisible();
  await expectMinimumTargetSize(norwegian);
  await expectMinimumTargetSize(mathematics);
  await expect(page.getByText("Oppgave ved annen skole")).toHaveCount(0);

  await menuButton.click();
  await expect(
    menu.getByRole("link", { name: "Fag og oppgaver" }),
  ).toHaveAttribute("aria-current", "page");
  const closeMenuButton = menu.getByRole("button", { name: "Lukk meny" });
  const signOutButton = menu.getByRole("button", { name: "Logg ut" });
  await closeMenuButton.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(signOutButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(closeMenuButton).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(menuButton).toBeFocused();

  await mathematics.click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Matematikk" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Oppgaver" }),
  ).toBeVisible();
  const completedTask = page
    .getByRole("article")
    .filter({ hasText: "Regn tre stykker" });
  await expect(completedTask.getByText("Ferdig", { exact: true })).toBeVisible();

  const openTask = completedTask.getByRole("button", {
    name: "Åpne oppgaven Regn tre stykker",
  });
  await openTask.focus();
  await page.keyboard.press("Enter");
  const taskDialog = page.getByRole("dialog", { name: "Regn tre stykker" });
  await expect(
    taskDialog.getByRole("button", { name: "Angre fullføring" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(taskDialog).toBeHidden();
  await expect(openTask).toBeFocused();

  await expectMinimumTargetSize(
    page.getByRole("link", { name: "Tilbake til fag og oppgaver" }),
  );
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);
  expectNoRuntimeErrors();
});

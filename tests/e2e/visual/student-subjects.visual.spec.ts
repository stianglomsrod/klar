import { expect, test } from "@playwright/test";
import {
  applyTextSpacingOverride,
  expectMinimumTargetSize,
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  observeRuntimeErrors,
} from "../support/quality";

test("lagrer elevens fagoversikt og fagdetalj som QA-artefakter", async ({
  page,
}, testInfo) => {
  const expectNoRuntimeErrors = observeRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/v3/student/subjects");
  if (testInfo.project.name.endsWith("reflow-200")) {
    await applyTextSpacingOverride(page);
  }

  await expect(
    page.getByRole("heading", { level: 1, name: "Fag og oppgaver" }),
  ).toBeVisible();
  const subjectList = page.getByRole("list");
  const socialStudies = subjectList.getByRole("link", {
    name: /^Samfunnsfag,/,
  });
  const norwegian = subjectList.getByRole("link", { name: /^Norsk,/ });
  await expect(socialStudies).toBeVisible();
  await expect(norwegian).toBeVisible();
  await expectMinimumTargetSize(socialStudies);
  await expectMinimumTargetSize(norwegian);
  await expect(subjectList.getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByText(/\d+ av \d+ oppgaver ferdige/)).toHaveCount(0);

  const helpDock = page.getByRole("region", { name: "Hjelp" });
  await expect(helpDock).toBeVisible();
  await expectMinimumTargetSize(
    helpDock.getByRole("button", { name: "Be om hjelp", exact: true }),
  );
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const lastCardBox = await subjectList.getByRole("link").last().boundingBox();
  const dockBox = await helpDock.boundingBox();
  expect(lastCardBox).not.toBeNull();
  expect(dockBox).not.toBeNull();
  if (lastCardBox && dockBox) {
    expect(lastCardBox.y + lastCardBox.height).toBeLessThanOrEqual(dockBox.y + 1);
  }
  await page.evaluate(() => window.scrollTo(0, 0));

  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);
  const overviewScreenshot = testInfo.outputPath(
    "student-subjects-overview-viewport.png",
  );
  await page.screenshot({
    path: overviewScreenshot,
    animations: "disabled",
  });
  await testInfo.attach("student-subjects-overview-viewport", {
    path: overviewScreenshot,
    contentType: "image/png",
  });

  const menuButton = page.getByRole("button", { name: "Åpne meny" });
  await menuButton.click();
  const menu = page.getByRole("dialog", { name: "Meny" });
  await expect(menu).toBeVisible();
  const menuBox = await menu.boundingBox();
  const viewport = page.viewportSize();
  expect(menuBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (menuBox && viewport) {
    expect(menuBox.x).toBeLessThanOrEqual(1);
    expect(menuBox.x + menuBox.width).toBeLessThan(viewport.width);
  }
  await expectNoAxeViolations(page);
  const menuScreenshot = testInfo.outputPath(
    "student-subjects-menu-viewport.png",
  );
  await page.screenshot({ path: menuScreenshot, animations: "disabled" });
  await testInfo.attach("student-subjects-menu-viewport", {
    path: menuScreenshot,
    contentType: "image/png",
  });
  await menu.getByRole("button", { name: "Lukk meny" }).click();

  await socialStudies.click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Samfunnsfag" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Oppgaver" }),
  ).toBeVisible();
  const taskCard = page
    .getByRole("article")
    .filter({ hasText: "Visuell arbeidsoppgave" });
  const openTask = taskCard.getByRole("button", {
    name: "Åpne oppgaven Visuell arbeidsoppgave",
  });
  await expectMinimumTargetSize(openTask);
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);
  const detailScreenshot = testInfo.outputPath(
    "student-subjects-detail-viewport.png",
  );
  await page.screenshot({ path: detailScreenshot, animations: "disabled" });
  await testInfo.attach("student-subjects-detail-viewport", {
    path: detailScreenshot,
    contentType: "image/png",
  });

  await openTask.focus();
  await page.keyboard.press("Enter");
  const taskDialog = page.getByRole("dialog", {
    name: "Visuell arbeidsoppgave",
  });
  await expect(taskDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(taskDialog).toBeHidden();
  await expect(openTask).toBeFocused();

  await page.goto("/v3/student/subjects");
  await page
    .getByRole("list")
    .getByRole("link", { name: /^Norsk,/ })
    .click();
  const currentTaskCard = page
    .getByRole("article")
    .filter({ hasText: "Visuell øktoppgave" });
  const openCurrentTask = currentTaskCard.getByRole("button", {
    name: "Åpne oppgaven Visuell øktoppgave",
  });
  await openCurrentTask.click();
  const currentTaskDialog = page.getByRole("dialog", {
    name: "Visuell øktoppgave",
  });
  await expect(
    currentTaskDialog.getByRole("button", {
      name: "Be om hjelp med denne oppgaven",
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(currentTaskDialog).toBeHidden();
  expectNoRuntimeErrors();
});

import { expect, test } from "@playwright/test";
import {
  applyTextSpacingOverride,
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  expectMinimumTargetSize,
  observeRuntimeErrors,
} from "../support/quality";

test("lagrer assignment-avgrenset ansattflate som QA-artefakt", async ({ page }, testInfo) => {
  const expectNoRuntimeErrors = observeRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/v3/teacher");
  await expect(page.getByRole("heading", { name: "Klar E2E" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Visuell klasse 4B/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Testklasse 3A/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Tilganger" })).toHaveCount(0);
  await page.getByRole("link", { name: /Visuell klasse 4B/ }).click();
  if (testInfo.project.name.endsWith("reflow-200")) {
    await applyTextSpacingOverride(page);
  }
  await expect(page.getByRole("heading", { name: "Visuell klasse 4B" })).toBeVisible();
  const helpQueue = page.getByRole("region", { name: "Hjelpekø" });
  await expect(helpQueue).toBeVisible();
  await expect(helpQueue.getByText("Åpen", { exact: true })).toBeVisible();
  await expect(
    helpQueue.getByText("Visuell arbeidsøkt", { exact: true }),
  ).toBeVisible();
  await expect(
    helpQueue.getByText("Ingen venter på hjelp.", { exact: true }),
  ).toBeVisible();
  await expectMinimumTargetSize(
    helpQueue.getByRole("button", { name: "Steng kø" }),
  );
  await expect(
    page
      .getByRole("region", { name: "Elever" })
      .getByText("Visuell elev", { exact: true }),
  ).toBeVisible();

  const publishedTasks = page.getByRole("region", {
    name: "Publiserte oppgaver",
  });
  const scheduledTask = publishedTasks.getByRole("article", {
    name: "Visuell øktoppgave, utsending 1",
  }).last();
  const scheduleTrigger = scheduledTask.getByRole("button", {
    name: "Flytt eller send ut på nytt",
  });
  await expectMinimumTargetSize(scheduleTrigger);
  await scheduleTrigger.focus();
  await page.keyboard.press("Enter");

  const scheduleDialog = page.getByRole("dialog", {
    name: "Flytt eller send ut på nytt Visuell øktoppgave",
  });
  const scheduleDialogElement = page.locator(
    "dialog.staff-dialog--task-iteration",
  );
  await expect(scheduleDialog).toBeVisible();
  const moveChoice = scheduleDialog.getByRole("radio", {
    name: "Flytt samme oppgave",
    exact: false,
  });
  const reissueChoice = scheduleDialog.getByRole("radio", {
    name: "Send ut på nytt",
    exact: false,
  });
  const targetSession = scheduleDialog.getByLabel("Ny undervisningsøkt");
  const visualStudent = scheduleDialog.getByRole("checkbox", {
    name: "Visuell elev",
    exact: false,
  });
  const closeScheduleDialog = scheduleDialog.getByRole("button", {
    name: "Lukk",
  });
  const cancelScheduleDialog = scheduleDialog.getByRole("button", {
    name: "Avbryt",
  });
  await expect(moveChoice).toBeFocused();
  expect(
    await moveChoice.evaluate((element) => element.matches(":focus-visible")),
  ).toBe(true);
  await page.keyboard.press("Shift+Tab");
  await expect(closeScheduleDialog).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(cancelScheduleDialog).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(closeScheduleDialog).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(scheduleDialogElement).not.toBeVisible();
  await expect(scheduleTrigger).toBeFocused();
  await scheduleTrigger.click();
  await expect(scheduleDialog).toBeVisible();
  await expect(moveChoice).not.toBeChecked();
  await expect(reissueChoice).not.toBeChecked();
  await expect(visualStudent).not.toBeChecked();
  const choiceScreenshot = testInfo.outputPath(
    "task-iteration-dialog-choice-viewport.png",
  );
  await page.screenshot({
    path: choiceScreenshot,
    fullPage: false,
    animations: "disabled",
  });
  await testInfo.attach("task-iteration-dialog-choice-viewport", {
    path: choiceScreenshot,
    contentType: "image/png",
  });
  await expectMinimumTargetSize(moveChoice.locator(".."));
  await expectMinimumTargetSize(reissueChoice.locator(".."));

  await reissueChoice.check();
  const targetOptionCount = await targetSession.locator("option").count();
  expect(targetOptionCount).toBeGreaterThan(1);
  await targetSession.selectOption({ index: targetOptionCount - 1 });
  await expect(visualStudent).toBeEnabled();
  await expectMinimumTargetSize(visualStudent.locator(".."));
  await visualStudent.check();
  const reviewSummary = scheduleDialog.getByRole("heading", {
    name: "Kontroller valget",
  });
  await expect(reviewSummary).toBeVisible();
  await expect(reviewSummary).toBeInViewport();
  await expect(
    scheduleDialog.getByText("Lager en ny oppgave. Eleven kan få poeng på nytt.", {
      exact: false,
    }),
  ).toBeVisible();

  await moveChoice.check();
  await expect(visualStudent).not.toBeChecked();
  await expect(targetSession).toHaveValue("");
  await targetSession.selectOption({ index: targetOptionCount - 1 });
  await visualStudent.check();
  await expect(reviewSummary).toBeInViewport();
  await expect(
    scheduleDialog.getByText("Beholder status og poenghistorikk. Ingen ny poengmulighet.", {
      exact: true,
    }),
  ).toBeVisible();
  await expectMinimumTargetSize(
    scheduleDialog.getByRole("button", { name: "Flytt oppgaven" }),
  );
  await expectMinimumTargetSize(
    scheduleDialog.getByRole("button", { name: "Avbryt" }),
  );
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);

  const dialogBox = await scheduleDialog.boundingBox();
  const dialogViewport = page.viewportSize();
  expect(dialogBox, "D2-dialogen skal ha målbar geometri").not.toBeNull();
  if (dialogBox && dialogViewport) {
    if (
      dialogViewport.width < 768 ||
      (dialogViewport.width === 768 && dialogViewport.height > dialogViewport.width)
    ) {
      expect(dialogBox.x).toBeLessThanOrEqual(1);
      expect(dialogBox.y).toBeLessThanOrEqual(1);
      expect(dialogBox.width).toBeGreaterThanOrEqual(dialogViewport.width - 2);
      expect(dialogBox.height).toBeGreaterThanOrEqual(dialogViewport.height - 2);
    } else if (
      dialogViewport.width >= 768 &&
      dialogViewport.width <= 1180 &&
      dialogViewport.width > dialogViewport.height
    ) {
      expect(dialogBox.x + dialogBox.width).toBeGreaterThanOrEqual(
        dialogViewport.width - 1,
      );
      expect(dialogBox.height).toBeGreaterThanOrEqual(dialogViewport.height - 2);
      expect(dialogBox.width).toBeLessThan(dialogViewport.width);
    } else {
      expect(dialogBox.x).toBeGreaterThan(0);
      expect(dialogBox.y).toBeGreaterThan(0);
      expect(dialogBox.width).toBeLessThan(dialogViewport.width);
      expect(dialogBox.height).toBeLessThan(dialogViewport.height);
    }
  }

  const scheduleScreenshot = testInfo.outputPath(
    "task-iteration-dialog-review-viewport.png",
  );
  await page.screenshot({
    path: scheduleScreenshot,
    fullPage: false,
    animations: "disabled",
  });
  await testInfo.attach("task-iteration-dialog-review-viewport", {
    path: scheduleScreenshot,
    contentType: "image/png",
  });
  await cancelScheduleDialog.click();
  await expect(scheduleDialogElement).not.toBeVisible();
  await expect(scheduleTrigger).toBeFocused();

  const planBuilder = page.getByRole("region", {
    name: "Planlegg undervisningsøktene",
  });
  await expect(planBuilder).toBeVisible();
  await planBuilder.getByLabel("Tittel").fill("Visuell kontrolløkt");
  await planBuilder.getByLabel("Fag").fill("Norsk");
  await planBuilder
    .getByLabel("Oppgave 1", { exact: true })
    .fill("Visuell kontrolloppgave");
  await planBuilder
    .getByLabel(/Kort instruksjon/)
    .fill("Syntetisk instruksjon for responsiv kontroll.");
  await expectMinimumTargetSize(
    planBuilder.getByRole("button", { name: "Legg til økt" }),
  );
  await expectMinimumTargetSize(
    planBuilder.getByRole("button", { name: "Legg til oppgave" }),
  );
  const reviewButton = planBuilder.getByRole("button", {
    name: "Kontroller klasseuken",
  });
  await expectMinimumTargetSize(reviewButton);
  await reviewButton.click();
  const review = planBuilder.getByRole("region", {
    name: "Kontroller før publisering",
  });
  await expect(review).toBeVisible();
  await expectMinimumTargetSize(
    review.getByRole("button", { name: "Publiser klasseuken" }),
  );
  const returnToEditing = review.getByRole("button", {
    name: "Gå tilbake og endre",
  });
  await expectMinimumTargetSize(returnToEditing);
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);
  const planScreenshot = testInfo.outputPath("weekly-plan-review-viewport.png");
  await page.screenshot({
    path: planScreenshot,
    fullPage: false,
    animations: "disabled",
  });
  await testInfo.attach("weekly-plan-review-viewport", {
    path: planScreenshot,
    contentType: "image/png",
  });
  await returnToEditing.click();
  await expect(planBuilder.getByLabel("Uken starter")).toBeFocused();
  const viewport = page.viewportSize();
  if (viewport && viewport.width < 1024) {
    await expectMinimumTargetSize(page.getByRole("button", { name: "Åpne meny" }));
  }
  await expectMinimumTargetSize(
    page.getByRole("button", { name: "Publiser løs oppgave" }),
  );
  const taskSection = page.getByRole("region", {
    name: "Andre publiserte oppgaver",
  });
  const returnTask = taskSection
    .locator(":scope > ul > li")
    .filter({ hasText: "Visuell oppgave for retur" });
  await returnTask.getByText("Ferdige elever (1)", { exact: true }).click();
  const reopenSummary = returnTask.getByText(
    "Åpne igjen for Visuell elev",
    { exact: true },
  );
  await expectMinimumTargetSize(reopenSummary);
  await reopenSummary.click();
  await expect(returnTask.getByLabel("Hva skal eleven gjøre?")).toBeVisible();
  await expectMinimumTargetSize(
    returnTask.getByRole("button", { name: "Avbryt" }),
  );
  await expectMinimumTargetSize(
    returnTask.getByRole("button", { name: "Åpne igjen", exact: true }),
  );
  const skipLink = page.getByRole("link", { name: "Hopp til hovedinnhold" });
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);
  const screenshot = testInfo.outputPath("staff-workspace.png");
  await page.screenshot({ path: screenshot, fullPage: true, animations: "disabled" });
  const skipState = await skipLink.evaluate((element) => ({
    active: document.activeElement === element,
    focusVisible: element.matches(":focus-visible"),
    clipped: getComputedStyle(element).clipPath === "inset(50%)",
  }));
  expect(skipState, "Skip-lenken skal bare bli synlig ved tastaturfokus").toEqual({
    active: false,
    focusVisible: false,
    clipped: true,
  });
  await testInfo.attach("staff-workspace", {
    path: screenshot,
    contentType: "image/png",
  });
  const viewportScreenshot = testInfo.outputPath("staff-workspace-viewport.png");
  await page.screenshot({
    path: viewportScreenshot,
    fullPage: false,
    animations: "disabled",
  });
  await testInfo.attach("staff-workspace-viewport", {
    path: viewportScreenshot,
    contentType: "image/png",
  });
  expectNoRuntimeErrors();
});

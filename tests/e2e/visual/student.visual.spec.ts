import { expect, test } from "@playwright/test";
import {
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  expectMinimumTargetSize,
  observeRuntimeErrors,
} from "../support/quality";

test("lagrer elevens dagsflate som QA-artefakt", async ({ page }, testInfo) => {
  const expectNoRuntimeErrors = observeRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/v3/student");
  await expect(page.getByRole("heading", { name: "Hei, Visuell elev" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Visuell arbeidsoppgave" }),
  ).toBeVisible();
  await expect(page.getByText("Oppgave publisert av vikar", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Be om hjelp" })).toBeVisible();
  // Den visuelle eleven har stille motivasjonsmodus. Det skal heller ikke
  // lekke poeng eller fremdrift gjennom en fast footer.
  await expect(
    page.getByRole("region", { name: "Din fremdrift" }),
  ).toHaveCount(0);
  await expect(page.getByText(/\d+ av \d+ ferdige/)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);
  const dayScreenshot = testInfo.outputPath("student-day-viewport.png");
  await page.screenshot({
    path: dayScreenshot,
    animations: "disabled",
  });
  await testInfo.attach("student-day-viewport", {
    path: dayScreenshot,
    contentType: "image/png",
  });

  const taskCard = page
    .getByRole("article")
    .filter({ hasText: "Visuell arbeidsoppgave" });
  const openButton = taskCard.getByRole("button", {
    name: "Åpne oppgaven Visuell arbeidsoppgave",
  });
  await expectMinimumTargetSize(openButton);
  await openButton.focus();
  await expect(openButton).toBeFocused();
  await page.keyboard.press("Enter");
  const taskDialog = page.getByRole("dialog", { name: "Visuell arbeidsoppgave" });
  const completeButton = taskDialog.getByRole("button", { name: "Fullfør" });
  await expectMinimumTargetSize(completeButton);
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);
  const taskScreenshot = testInfo.outputPath("student-task-viewport.png");
  await page.screenshot({
    path: taskScreenshot,
    animations: "disabled",
  });
  await testInfo.attach("student-task-viewport", {
    path: taskScreenshot,
    contentType: "image/png",
  });

  await completeButton.focus();
  await page.keyboard.press("Enter");
  const checkpoint = page.getByRole("dialog", { name: "Er du ferdig?" });
  await expect(checkpoint).toBeVisible();
  await expect(
    checkpoint.getByRole("heading", { name: "Er du ferdig?" }),
  ).toBeFocused();
  await expectMinimumTargetSize(
    checkpoint.getByRole("button", { name: "Avbryt" }),
  );
  await expectMinimumTargetSize(
    checkpoint.getByRole("button", { name: "Ferdig" }),
  );
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);
  const checkpointScreenshot = testInfo.outputPath(
    "student-checkpoint-viewport.png",
  );
  await page.screenshot({
    path: checkpointScreenshot,
    animations: "disabled",
  });
  await testInfo.attach("student-checkpoint-viewport", {
    path: checkpointScreenshot,
    contentType: "image/png",
  });

  const cancelButton = checkpoint.getByRole("button", { name: "Avbryt" });
  await cancelButton.focus();
  await page.keyboard.press("Enter");
  await expect(taskDialog).toBeVisible();
  await expect(completeButton).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(taskDialog).toBeHidden();
  await expect(openButton).toBeFocused();
  expectNoRuntimeErrors();
});

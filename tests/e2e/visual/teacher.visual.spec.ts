import { expect, test } from "@playwright/test";
import {
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  observeRuntimeErrors,
} from "../support/quality";

test("lagrer lærerens dashboard som QA-artefakt", async ({ page }, testInfo) => {
  const expectNoRuntimeErrors = observeRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/v3/teacher");
  await expect(page.getByRole("heading", { name: "Klar E2E" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);
  const screenshot = testInfo.outputPath("teacher-dashboard.png");
  await page.screenshot({ path: screenshot, fullPage: true, animations: "disabled" });
  await testInfo.attach("teacher-dashboard", {
    path: screenshot,
    contentType: "image/png",
  });
  expectNoRuntimeErrors();
});

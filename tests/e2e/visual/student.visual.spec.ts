import { expect, test } from "@playwright/test";
import {
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  observeRuntimeErrors,
} from "../support/quality";

test("lagrer elevens dagsflate som QA-artefakt", async ({ page }, testInfo) => {
  const expectNoRuntimeErrors = observeRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/v3/student");
  await expect(page.getByRole("heading", { name: "Hei, Testelev" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);
  const screenshot = testInfo.outputPath("student-day.png");
  await page.screenshot({ path: screenshot, fullPage: true, animations: "disabled" });
  await testInfo.attach("student-day", { path: screenshot, contentType: "image/png" });
  expectNoRuntimeErrors();
});

import { expect, test } from "@playwright/test";
import {
  applyTextSpacingOverride,
  expectMinimumTargetSize,
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  observeRuntimeErrors,
} from "../support/quality";

const colors = [
  "Rød",
  "Turkis",
  "Grønn",
  "Rosa",
  "Lilla",
  "Oransje",
  "Gul",
  "Blå",
] as const;

test("viser en rolig, lesbar og valgfri blomsterhage", async ({ page }, testInfo) => {
  const expectNoRuntimeErrors = observeRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/v3/student/rewards");

  await expect(
    page.getByRole("heading", { level: 1, name: "Blomsterhagen" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(
    page.getByRole("heading", { level: 2, name: "Velg et kronblad" }),
  ).toBeVisible();
  await expect(page.getByText(/nådde nivå 3/)).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Blomst 1, 1 av 5 kronblader valgt",
    }),
  ).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(8);

  for (const color of colors) {
    const radio = page.getByRole("radio", { name: color });
    await expect(radio).toBeVisible();
    await expectMinimumTargetSize(radio.locator(".."));
  }
  const orange = page.getByRole("radio", { name: "Oransje" });
  await page.getByText("Oransje", { exact: true }).click();
  await expect(orange).toBeChecked();
  const claimButton = page.getByRole("button", { name: "Legg til kronblad" });
  await expect(claimButton).toBeEnabled();
  await expectMinimumTargetSize(claimButton);

  if (testInfo.project.name.endsWith("reflow-200")) {
    await applyTextSpacingOverride(page);
  }
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);

  // Target-size assertions may scroll the last color into view. Return to the
  // document start so the sticky app header is captured at its real origin in
  // the full-page evidence image instead of being stitched over the content.
  await page.evaluate(() => window.scrollTo(0, 0));
  const screenshot = testInfo.outputPath("student-flower-reward-viewport.png");
  await page.screenshot({
    path: screenshot,
    fullPage: true,
    animations: "disabled",
  });
  await testInfo.attach("student-flower-reward-viewport", {
    path: screenshot,
    contentType: "image/png",
  });
  expectNoRuntimeErrors();
});

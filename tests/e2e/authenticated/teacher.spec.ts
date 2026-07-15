import { expect, test } from "@playwright/test";
import {
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  observeRuntimeErrors,
} from "../support/quality";

test("AAL2-læreren ser det syntetiske klasseområdet", async ({ page }) => {
  const expectNoRuntimeErrors = observeRuntimeErrors(page);
  await page.goto("/v3/teacher");
  await expect(page.getByRole("heading", { name: "Klar E2E" })).toBeVisible();
  await page.getByRole("link", { name: /Testklasse 3A/ }).click();
  await expect(page.getByRole("heading", { name: "Testklasse 3A" })).toBeVisible();
  await expect(page.getByText("Testelev", { exact: true })).toBeVisible();
  await expect(page.getByText("Les fem linjer", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);

  await page.goto("/v3/student");
  await expect(page).toHaveURL(/\/login$/);
  expectNoRuntimeErrors();
});

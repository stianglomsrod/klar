import { expect, test } from "@playwright/test";
import {
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  observeRuntimeErrors,
} from "../support/quality";

test("elevsesjonen viser bare elevens syntetiske arbeidsflate", async ({ page }) => {
  const expectNoRuntimeErrors = observeRuntimeErrors(page);
  await page.goto("/v3/student");
  await expect(page.getByRole("heading", { name: "Hei, Testelev" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Les fem linjer" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Regn tre stykker" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);

  await page.goto("/v3/teacher");
  await expect(page).toHaveURL(/\/login$/);
  expectNoRuntimeErrors();
});

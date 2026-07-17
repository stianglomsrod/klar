import { expect, test } from "@playwright/test";
import {
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  expectMinimumTargetSize,
  observeRuntimeErrors,
} from "../support/quality";

test("viser elevens valgfrie progresjonsflate i relevante viewports", async ({
  page,
}, testInfo) => {
  const expectNoRuntimeErrors = observeRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/v3/student");

  await expect(
    page.getByRole("heading", { name: "Hei, Visuell progresjonselev" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dagens arbeidsøkt" })).toBeVisible();
  await expect(page.getByText("Nå", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dagens øktoppgave" })).toBeVisible();
  await expect(page.getByText(/\d+ av \d+ ferdige/).first()).toBeVisible();

  const progressDock = page.getByRole("region", {
    name: "Din fremdrift og hjelp",
    exact: true,
  });
  await expect(progressDock).toBeVisible();
  await expect(progressDock.getByText("Nivå 1", { exact: true })).toBeVisible();
  await expect(progressDock.getByText("10 poeng", { exact: true })).toBeVisible();
  await expect(
    progressDock.getByRole("progressbar", {
      name: "10 av 1000 poeng mot nivå 2",
    }),
  ).toBeVisible();
  await expectMinimumTargetSize(
    progressDock.getByRole("button", { name: "Be om hjelp", exact: true }),
  );
  const dockBox = await progressDock.boundingBox();
  const viewport = page.viewportSize();
  expect(dockBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (dockBox && viewport) {
    expect(dockBox.x).toBeGreaterThanOrEqual(0);
    expect(dockBox.x + dockBox.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(dockBox.y + dockBox.height).toBeLessThanOrEqual(viewport.height + 1);
  }

  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);

  const screenshot = testInfo.outputPath("student-progress-viewport.png");
  await page.screenshot({
    path: screenshot,
    animations: "disabled",
  });
  await testInfo.attach("student-progress-viewport", {
    path: screenshot,
    contentType: "image/png",
  });
  expectNoRuntimeErrors();
});

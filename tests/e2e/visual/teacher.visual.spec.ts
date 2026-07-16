import { expect, test } from "@playwright/test";
import {
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
  await expect(page.getByRole("heading", { name: "Visuell klasse 4B" })).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Elever" })
      .getByText("Visuell elev", { exact: true }),
  ).toBeVisible();
  const viewport = page.viewportSize();
  if (viewport && viewport.width < 1024) {
    await expectMinimumTargetSize(page.getByRole("button", { name: "Åpne meny" }));
  }
  await expectMinimumTargetSize(
    page.getByRole("button", { name: "Publiser til klassen" }),
  );
  const taskSection = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Publiserte oppgaver" }),
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

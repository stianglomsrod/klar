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

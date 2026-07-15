import { expect, test } from "@playwright/test";
import {
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  expectMinimumTargetSize,
  observeRuntimeErrors,
} from "../support/quality";

test("lagrer ownerens tilgangsliste og responsive opprett-flyt", async ({
  page,
}, testInfo) => {
  const expectNoRuntimeErrors = observeRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/v3/teacher/access");
  await expect(page.getByRole("heading", { name: "Tilganger" })).toBeVisible();
  await expect(page.locator(".staff-assignment-status--active")).toHaveCount(2);
  await expect(page.locator(".staff-assignment-status--scheduled")).toHaveCount(1);
  await expect(page.locator(".staff-assignment-status--expired")).toHaveCount(1);
  await expect(page.locator(".staff-assignment-status--revoked")).toHaveCount(1);
  await expect(page.locator(".staff-assignment-status--active").first()).toContainText(
    "Aktiv",
  );
  await expect(page.locator(".staff-assignment-status--scheduled")).toContainText(
    "Planlagt",
  );
  await expect(page.locator(".staff-assignment-status--expired")).toContainText(
    "Utløpt",
  );
  await expect(page.locator(".staff-assignment-status--revoked")).toContainText(
    "Tilbakekalt",
  );
  await expect(page.getByText(/Operativ eiertilgang ·/)).toBeVisible();
  await expect(page.getByText("Opprettet med klassen", { exact: true })).toBeVisible();
  await expect(page.getByText(/operational_owner|legacy_teacher/)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);
  const listScreenshot = testInfo.outputPath("owner-access-list.png");
  await page.screenshot({
    path: listScreenshot,
    fullPage: true,
    animations: "disabled",
  });
  await testInfo.attach("owner-access-list", {
    path: listScreenshot,
    contentType: "image/png",
  });

  const activeAssignment = page
    .locator("li")
    .filter({ hasText: "Visuell ansatt" })
    .filter({ has: page.locator(".staff-assignment-status--active") });
  await expect(activeAssignment).toHaveCount(1);
  const revokeTrigger = activeAssignment.getByRole("button", { name: "Trekk tilbake" });
  await expectMinimumTargetSize(revokeTrigger);
  await revokeTrigger.click();
  const revokeDialog = page.getByRole("dialog", { name: "Trekk tilbake oppdrag?" });
  await expect(revokeDialog).toBeVisible();
  const keepButton = revokeDialog.getByRole("button", { name: "Behold tilgang" });
  const destructiveButton = revokeDialog.getByRole("button", {
    name: "Trekk tilbake",
    exact: true,
  });
  await expect(keepButton).toBeFocused();
  await expect(destructiveButton).not.toBeFocused();
  await expectMinimumTargetSize(keepButton);
  await expectMinimumTargetSize(destructiveButton);
  await page.keyboard.press("Shift+Tab");
  await expect(destructiveButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(keepButton).toBeFocused();
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);
  const revokeScreenshot = testInfo.outputPath("owner-access-revoke.png");
  await page.screenshot({
    path: revokeScreenshot,
    fullPage: false,
    animations: "disabled",
  });
  await testInfo.attach("owner-access-revoke", {
    path: revokeScreenshot,
    contentType: "image/png",
  });
  await page.keyboard.press("Escape");
  await expect(revokeDialog).toBeHidden();
  await expect(revokeTrigger).toBeFocused();

  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Viewport mangler i visuell E2E.");

  if (viewport.width < 1024) {
    const menuButton = page.getByRole("button", { name: "Åpne meny" });
    await expectMinimumTargetSize(menuButton);
    await menuButton.click();
    const menu = page.getByRole("dialog", { name: "Meny" });
    await expect(menu).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(menuButton).toBeFocused();
  }

  const openButton = page.getByRole("button", { name: "Gi tilgang" });
  await expectMinimumTargetSize(openButton);
  await openButton.click();
  const dialog = page.getByRole("dialog", { name: "Gi tilgang" });
  await expect(dialog).toBeVisible();
  await expectMinimumTargetSize(dialog.getByRole("button", { name: "Lukk" }));
  await expectMinimumTargetSize(
    dialog.getByRole("button", { name: "Bekreft oppdrag" }),
  );
  await expect(dialog).toContainText("Kontroller før du bekrefter");
  await expect(dialog).toContainText("Fra");
  const box = await dialog.boundingBox();
  if (!box) throw new Error("Tilgangsdialogen mangler layoutboks.");
  if (viewport.width <= 767) {
    expect(box.width).toBeGreaterThanOrEqual(viewport.width - 2);
    expect(box.height).toBeGreaterThanOrEqual(viewport.height - 2);
  } else if (viewport.width < 1024) {
    expect(box.height).toBeGreaterThanOrEqual(viewport.height - 2);
    expect(box.x + box.width).toBeGreaterThanOrEqual(viewport.width - 2);
    expect(box.width).toBeLessThan(viewport.width);
  } else {
    expect(box.width).toBeLessThan(viewport.width - 32);
    expect(Math.abs(box.x - (viewport.width - box.width) / 2)).toBeLessThan(4);
  }

  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);
  const screenshot = testInfo.outputPath("owner-access-open.png");
  await page.screenshot({ path: screenshot, fullPage: false, animations: "disabled" });
  await testInfo.attach("owner-access-open", {
    path: screenshot,
    contentType: "image/png",
  });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(openButton).toBeFocused();
  expectNoRuntimeErrors();
});

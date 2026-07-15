import { expect, test } from "@playwright/test";
import {
  expectMinimumTargetSize,
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  observeRuntimeErrors,
} from "../support/quality";

test("ownerflyten reflower ved 200 prosent og tåler tekst- og høydeoverstyring", async ({
  page,
}, testInfo) => {
  const expectNoRuntimeErrors = observeRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/v3/teacher/access");
  await expect(page.getByRole("heading", { name: "Tilganger" })).toBeVisible();

  const textOverride = await page.addStyleTag({
    content: `
      :where(html, body, button, input, select, textarea) {
        font-family: Arial, sans-serif !important;
      }
      :where(p, li, label, button, input, select, textarea) {
        line-height: 1.5 !important;
        letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important;
      }
      p { margin-bottom: 2em !important; }
    `,
  });

  const openButton = page.getByRole("button", { name: "Gi tilgang" });
  await openButton.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Gi tilgang" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Bekreft oppdrag" })).toBeVisible();
  await expectMinimumTargetSize(dialog.getByRole("button", { name: "Lukk" }));
  await expectMinimumTargetSize(
    dialog.getByRole("button", { name: "Bekreft oppdrag" }),
  );

  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((element) => element.contains(document.activeElement)),
      "Native dialog skal holde tastaturfokus",
    ).toBe(true);
  }

  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);
  const screenshot = testInfo.outputPath("owner-access-reflow-200.png");
  await page.screenshot({ path: screenshot, fullPage: false, animations: "disabled" });
  await testInfo.attach("owner-access-reflow-200", {
    path: screenshot,
    contentType: "image/png",
  });

  await textOverride.evaluate((element) => element.parentNode?.removeChild(element));
  await page.setViewportSize({ width: 640, height: 220 });
  const endField = dialog.getByLabel("Slutt");
  await endField.focus();
  await endField.scrollIntoViewIfNeeded();
  const [fieldBox, footerBox] = await Promise.all([
    endField.boundingBox(),
    dialog.locator("footer").boundingBox(),
  ]);
  if (!fieldBox || !footerBox) throw new Error("Manglet geometri for tastaturtesten.");
  expect(fieldBox.y).toBeGreaterThanOrEqual(0);
  expect(fieldBox.y + fieldBox.height).toBeLessThanOrEqual(footerBox.y + 1);
  await expectNoHorizontalOverflow(page);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(openButton).toBeFocused();
  expectNoRuntimeErrors();
});

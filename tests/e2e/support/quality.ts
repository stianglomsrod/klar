import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";

export async function expectNoAxeViolations(page: Page) {
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
}
export async function expectNoHorizontalOverflow(page: Page) {
  const overflows = await page.evaluate(() => {
    const candidates: Array<[string, Element]> = [
      ["document", document.documentElement],
      ...Array.from(
        document.querySelectorAll("dialog[open], .staff-dialog__scroll"),
      ).map((element, index) => [`dialog-${index}`, element] as [string, Element]),
    ];
    return candidates
      .filter(([, element]) => element.scrollWidth > element.clientWidth + 1)
      .map(([label]) => label);
  });
  expect(overflows).toEqual([]);
}

export async function applyTextSpacingOverride(page: Page) {
  return page.addStyleTag({
    content: `
      :where(body, body *) {
        line-height: 1.5 !important;
        letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important;
      }
      :where(body, button, input, select, textarea) {
        font-family: Arial, sans-serif !important;
      }
      p { margin-bottom: 2em !important; }
    `,
  });
}

export async function expectMinimumTargetSize(
  locator: Locator,
  minimum = 44,
) {
  const boxes = await locator.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return {
        label:
          element.getAttribute("aria-label") ??
          element.textContent?.trim() ??
          element.tagName,
        width: box.width,
        height: box.height,
      };
    }),
  );
  expect(boxes.length, "Fant ingen synlige trykkmål å måle").toBeGreaterThan(0);
  expect(
    boxes.filter((box) => box.width < minimum || box.height < minimum),
    `Trykkmål skal være minst ${minimum} × ${minimum} CSS-piksler`,
  ).toEqual([]);
}

export function observeRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return () => expect(errors, "Uventede runtime-feil i browseren").toEqual([]);
}

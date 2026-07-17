import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function expectNoAxeViolations(page: import("@playwright/test").Page) {
  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations).toEqual([]);
}

test("login is keyboard reachable and has no detectable WCAG A/AA violations", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Logg inn" })).toBeVisible();

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Hopp til hovedinnhold" });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();

  await expectNoAxeViolations(page);
});

test("pilot stop page is accessible without authentication", async ({ page }) => {
  await page.goto("/v3/unavailable");
  await expect(
    page.getByRole("heading", { name: "Piloten er midlertidig stengt" }),
  ).toBeVisible();
  await expectNoAxeViolations(page);
});

test("login does not overflow a narrow student device", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/login");
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
});

test("archived 2.x privileged API routes expose no operations", async ({
  request,
}) => {
  const paths = [
    "/api/admin/substitute-link",
    "/api/seed",
    "/api/push/send",
    "/api/push/subscribe",
    "/api/push/react",
  ];

  for (const path of paths) {
    const response = await request.post(path, { data: {} });
    expect(response.status(), path).toBe(404);
  }
});

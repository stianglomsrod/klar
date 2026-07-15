import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test as setup } from "@playwright/test";
import { getE2ECredentials } from "./support/env";
import { generateFreshTotp } from "./support/totp";

const authDirectory = path.join(process.cwd(), "playwright", ".auth");
const studentState = path.join(authDirectory, "student.json");
const teacherState = path.join(authDirectory, "teacher.json");

async function fillLogin(
  page: import("@playwright/test").Page,
  identifier: string,
  password: string,
) {
  await page.goto("/login");
  await page.getByLabel("Elevkode eller e-post").fill(identifier);
  const passwordInput = page.getByLabel("Passord");
  await passwordInput.fill(password);
  try {
    await page.getByRole("button", { name: "Logg inn" }).click();
    await Promise.race([
      page.waitForURL(/\/v3\//, { timeout: 10_000 }),
      page.getByRole("alert").waitFor({ state: "visible", timeout: 10_000 }),
    ]);
  } finally {
    // Playwright can include the live DOM in error-context.md. Direct DOM
    // cleanup neither waits for a disabled field nor changes submitted data.
    await page
      .evaluate(() => {
        const input = document.querySelector<HTMLInputElement>("#password");
        if (input) input.value = "";
      })
      .catch(() => undefined);
  }
}

setup("oppretter isolerte elev- og lærersesjoner", async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error("Playwright baseURL mangler.");
  await mkdir(authDirectory, { recursive: true });
  const credentials = getE2ECredentials();

  const studentContext = await browser.newContext({ baseURL });
  const studentPage = await studentContext.newPage();
  await fillLogin(
    studentPage,
    credentials.studentCode,
    credentials.studentPassword,
  );
  await expect(studentPage).toHaveURL(/\/v3\/student$/);
  await studentContext.storageState({ path: studentState });
  await studentContext.close();

  const teacherContext = await browser.newContext({ baseURL });
  const teacherPage = await teacherContext.newPage();
  await fillLogin(
    teacherPage,
    credentials.ownerEmail,
    credentials.ownerPassword,
  );
  await expect(teacherPage).toHaveURL(/\/v3\/mfa\/enroll$/);
  await teacherPage
    .getByRole("button", { name: "Start sikkert oppsett" })
    .click();
  const secretNode = teacherPage.locator("code");
  await expect(secretNode).not.toBeEmpty();
  const secret = (await secretNode.textContent())?.trim();
  if (!secret) throw new Error("MFA-oppsettet returnerte ingen hemmelighet.");
  await teacherPage.getByLabel("Sekssifret kode").fill(
    await generateFreshTotp(secret),
  );
  await teacherPage
    .getByRole("button", { name: "Bekreft og fortsett" })
    .click();
  await expect(teacherPage).toHaveURL(/\/v3\/teacher$/);
  await teacherContext.storageState({ path: teacherState });
  await teacherContext.close();
});

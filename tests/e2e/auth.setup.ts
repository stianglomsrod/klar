import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test as setup, type Browser, type Page } from "@playwright/test";
import { getE2ECredentials } from "./support/env";
import { generateFreshTotp } from "./support/totp";

setup.setTimeout(120_000);

const authDirectory = path.join(process.cwd(), "playwright", ".auth");
const states = {
  student: path.join(authDirectory, "student.json"),
  visualStudent: path.join(authDirectory, "visual-student.json"),
  ownerAal1: path.join(authDirectory, "owner-aal1.json"),
  ownerAal2: path.join(authDirectory, "owner-aal2.json"),
  substituteAal1: path.join(authDirectory, "substitute-aal1.json"),
  substituteAal2: path.join(authDirectory, "substitute-aal2.json"),
  visualStaffAal2: path.join(authDirectory, "visual-staff-aal2.json"),
  visualOwnerAal2: path.join(authDirectory, "visual-owner-aal2.json"),
  otherStaffAal2: path.join(authDirectory, "other-org-staff-aal2.json"),
};

async function fillLogin(page: Page, identifier: string, password: string) {
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
    await page
      .evaluate(() => {
        const input = document.querySelector<HTMLInputElement>("#password");
        if (input) input.value = "";
      })
      .catch(() => undefined);
  }
}

async function createAdultStates(input: {
  browser: Browser;
  baseURL: string;
  email: string;
  password: string;
  aal1Path?: string;
  aal2Path: string;
}) {
  const context = await input.browser.newContext({ baseURL: input.baseURL });
  const page = await context.newPage();
  await fillLogin(page, input.email, input.password);
  await expect(page).toHaveURL(/\/v3\/mfa\/enroll$/);
  await page.getByRole("button", { name: "Start sikkert oppsett" }).click();
  const secretNode = page.locator("code");
  await expect(secretNode).not.toBeEmpty();
  const secret = (await secretNode.textContent())?.trim();
  if (!secret) throw new Error("MFA-oppsettet returnerte ingen hemmelighet.");
  const enrollmentCode = await generateFreshTotp(secret);
  await page.getByLabel("Sekssifret kode").fill(enrollmentCode);
  await secretNode.evaluate((node) => node.parentElement?.remove());
  await page.getByRole("button", { name: "Bekreft og fortsett" }).click();
  await expect(page).toHaveURL(/\/v3\/teacher$/);

  if (!input.aal1Path) {
    await context.storageState({ path: input.aal2Path });
    await context.close();
    return;
  }

  await page.getByRole("button", { name: "Logg ut" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await fillLogin(page, input.email, input.password);
  await expect(page).toHaveURL(/\/v3\/mfa\/challenge$/);
  await context.storageState({ path: input.aal1Path });

  await page.getByLabel("Sekssifret kode").fill(await generateFreshTotp(secret));
  await page.getByRole("button", { name: "Bekreft og fortsett" }).click();
  await expect(page).toHaveURL(/\/v3\/teacher$/);
  await context.storageState({ path: input.aal2Path });
  await context.close();
}

setup("oppretter isolerte elev-, owner- og ansattsesjoner", async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error("Playwright baseURL mangler.");
  await mkdir(authDirectory, { recursive: true });
  const credentials = getE2ECredentials();

  const studentContext = await browser.newContext({ baseURL });
  const studentPage = await studentContext.newPage();
  await fillLogin(studentPage, credentials.studentCode, credentials.studentPassword);
  await expect(studentPage).toHaveURL(/\/v3\/student$/);
  await studentContext.storageState({ path: states.student });
  await studentContext.close();

  const visualStudentContext = await browser.newContext({ baseURL });
  const visualStudentPage = await visualStudentContext.newPage();
  await fillLogin(
    visualStudentPage,
    credentials.visualStudentCode,
    credentials.visualStudentPassword,
  );
  await expect(visualStudentPage).toHaveURL(/\/v3\/student$/);
  await visualStudentContext.storageState({ path: states.visualStudent });
  await visualStudentContext.close();

  await createAdultStates({
    browser,
    baseURL,
    email: credentials.ownerEmail,
    password: credentials.ownerPassword,
    aal1Path: states.ownerAal1,
    aal2Path: states.ownerAal2,
  });
  await createAdultStates({
    browser,
    baseURL,
    email: credentials.substituteEmail,
    password: credentials.substitutePassword,
    aal1Path: states.substituteAal1,
    aal2Path: states.substituteAal2,
  });
  await createAdultStates({
    browser,
    baseURL,
    email: credentials.visualStaffEmail,
    password: credentials.visualStaffPassword,
    aal2Path: states.visualStaffAal2,
  });
  await createAdultStates({
    browser,
    baseURL,
    email: credentials.visualOwnerEmail,
    password: credentials.visualOwnerPassword,
    aal2Path: states.visualOwnerAal2,
  });
  await createAdultStates({
    browser,
    baseURL,
    email: credentials.otherStaffEmail,
    password: credentials.otherStaffPassword,
    aal2Path: states.otherStaffAal2,
  });
});

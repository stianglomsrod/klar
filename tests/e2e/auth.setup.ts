import { randomBytes } from "node:crypto";
import { chmod, mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  expect,
  test as setup,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { ensureManualTestCacheDirectory } from "../../scripts/e2e/manual-test-cache.mjs";
import { getE2ECredentials } from "./support/env";
import { generateFreshTotp } from "./support/totp";

setup.setTimeout(120_000);

const canonicalAuthDirectory = path.join(process.cwd(), "playwright", ".auth");
const labAuthDirectory = path.join(canonicalAuthDirectory, "lab");
const requestedAuthDirectory = process.env.KLAR_AUTH_DIRECTORY;
const authDirectory = requestedAuthDirectory
  ? path.resolve(requestedAuthDirectory)
  : canonicalAuthDirectory;
if (
  requestedAuthDirectory &&
  (process.env.KLAR_ROLE_DEV !== "1" ||
    authDirectory !== path.resolve(labAuthDirectory))
) {
  throw new Error(
    "Alternativ auth-mappe er bare tillatt for den faste lokale lab-mappen.",
  );
}
const states = {
  student: path.join(authDirectory, "student.json"),
  visualStudent: path.join(authDirectory, "visual-student.json"),
  rewardStudent: path.join(authDirectory, "reward-student.json"),
  rewardVisualStudent: path.join(authDirectory, "reward-visual-student.json"),
  progressVisualStudent: path.join(authDirectory, "progress-visual-student.json"),
  d2Student: path.join(authDirectory, "d2-student.json"),
  returnStudent: path.join(authDirectory, "return-student.json"),
  helpStudent: path.join(authDirectory, "help-student.json"),
  helpStaffAal2: path.join(authDirectory, "help-staff-aal2.json"),
  ownerAal1: path.join(authDirectory, "owner-aal1.json"),
  ownerAal2: path.join(authDirectory, "owner-aal2.json"),
  substituteAal1: path.join(authDirectory, "substitute-aal1.json"),
  substituteAal2: path.join(authDirectory, "substitute-aal2.json"),
  visualStaffAal2: path.join(authDirectory, "visual-staff-aal2.json"),
  visualOwnerAal2: path.join(authDirectory, "visual-owner-aal2.json"),
  otherStaffAal2: path.join(authDirectory, "other-org-staff-aal2.json"),
};

async function saveStorageState(context: BrowserContext, file: string) {
  const temporary = `${file}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(await context.storageState()), {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await rename(temporary, file);
    await chmod(file, 0o600);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function fillLogin(page: Page, identifier: string, password: string) {
  // Login is a client component. Waiting past script loading prevents WebKit
  // from submitting the server-rendered form before React has attached onSubmit.
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel("Elevkode eller e-post").fill(identifier);
  const passwordInput = page.getByLabel("Passord");
  await passwordInput.fill(password);
  try {
    await page.getByRole("button", { name: "Logg inn" }).click();
    const loginTimeout = process.env.KLAR_ROLE_DEV === "1" ? 45_000 : 15_000;
    const loginError = page
      .getByRole("region", { name: "Logg inn" })
      .getByRole("alert");
    await Promise.race([
      page.waitForURL(/\/v3\//, { timeout: loginTimeout }),
      loginError.waitFor({ state: "visible", timeout: loginTimeout }),
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
    await saveStorageState(context, input.aal2Path);
    await context.close();
    return;
  }

  await page.getByRole("button", { name: "Logg ut" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await fillLogin(page, input.email, input.password);
  await expect(page).toHaveURL(/\/v3\/mfa\/challenge$/);
  await saveStorageState(context, input.aal1Path);

  await page.getByLabel("Sekssifret kode").fill(await generateFreshTotp(secret));
  await page.getByRole("button", { name: "Bekreft og fortsett" }).click();
  await expect(page).toHaveURL(/\/v3\/teacher$/);
  await saveStorageState(context, input.aal2Path);
  await context.close();
}

setup("oppretter isolerte elev-, owner- og ansattsesjoner", async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error("Playwright baseURL mangler.");
  if (requestedAuthDirectory) {
    ensureManualTestCacheDirectory(process.cwd());
  } else {
    await mkdir(authDirectory, { recursive: true, mode: 0o700 });
    await chmod(authDirectory, 0o700);
  }
  const credentials = getE2ECredentials();

  const studentContext = await browser.newContext({ baseURL });
  const studentPage = await studentContext.newPage();
  await fillLogin(studentPage, credentials.studentCode, credentials.studentPassword);
  await expect(studentPage).toHaveURL(/\/v3\/student$/);
  await saveStorageState(studentContext, states.student);
  await studentContext.close();

  const visualStudentContext = await browser.newContext({ baseURL });
  const visualStudentPage = await visualStudentContext.newPage();
  await fillLogin(
    visualStudentPage,
    credentials.visualStudentCode,
    credentials.visualStudentPassword,
  );
  await expect(visualStudentPage).toHaveURL(/\/v3\/student$/);
  await saveStorageState(visualStudentContext, states.visualStudent);
  await visualStudentContext.close();

  const rewardStudentContext = await browser.newContext({ baseURL });
  const rewardStudentPage = await rewardStudentContext.newPage();
  await fillLogin(
    rewardStudentPage,
    credentials.rewardStudentCode,
    credentials.rewardStudentPassword,
  );
  await expect(rewardStudentPage).toHaveURL(/\/v3\/student$/);
  await saveStorageState(rewardStudentContext, states.rewardStudent);
  await rewardStudentContext.close();

  const rewardVisualStudentContext = await browser.newContext({ baseURL });
  const rewardVisualStudentPage = await rewardVisualStudentContext.newPage();
  await fillLogin(
    rewardVisualStudentPage,
    credentials.rewardVisualStudentCode,
    credentials.rewardVisualStudentPassword,
  );
  await expect(rewardVisualStudentPage).toHaveURL(/\/v3\/student$/);
  await saveStorageState(rewardVisualStudentContext, states.rewardVisualStudent);
  await rewardVisualStudentContext.close();

  const progressVisualStudentContext = await browser.newContext({ baseURL });
  const progressVisualStudentPage = await progressVisualStudentContext.newPage();
  await fillLogin(
    progressVisualStudentPage,
    credentials.progressVisualStudentCode,
    credentials.progressVisualStudentPassword,
  );
  await expect(progressVisualStudentPage).toHaveURL(/\/v3\/student$/);
  await saveStorageState(
    progressVisualStudentContext,
    states.progressVisualStudent,
  );
  await progressVisualStudentContext.close();

  const d2StudentContext = await browser.newContext({ baseURL });
  const d2StudentPage = await d2StudentContext.newPage();
  await fillLogin(
    d2StudentPage,
    credentials.d2StudentCode,
    credentials.d2StudentPassword,
  );
  await expect(d2StudentPage).toHaveURL(/\/v3\/student$/);
  await saveStorageState(d2StudentContext, states.d2Student);
  await d2StudentContext.close();

  const returnStudentContext = await browser.newContext({ baseURL });
  const returnStudentPage = await returnStudentContext.newPage();
  await fillLogin(
    returnStudentPage,
    credentials.returnStudentEmail,
    credentials.returnStudentPassword,
  );
  await expect(returnStudentPage).toHaveURL(/\/v3\/student$/);
  await saveStorageState(returnStudentContext, states.returnStudent);
  await returnStudentContext.close();

  const helpStudentContext = await browser.newContext({ baseURL });
  const helpStudentPage = await helpStudentContext.newPage();
  await fillLogin(
    helpStudentPage,
    credentials.helpStudentEmail,
    credentials.helpStudentPassword,
  );
  await expect(helpStudentPage).toHaveURL(/\/v3\/student$/);
  await saveStorageState(helpStudentContext, states.helpStudent);
  await helpStudentContext.close();

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
  await createAdultStates({
    browser,
    baseURL,
    email: credentials.helpStaffEmail,
    password: credentials.helpStaffPassword,
    aal2Path: states.helpStaffAal2,
  });
});

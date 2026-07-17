import path from "node:path";
import {
  defineConfig,
  devices,
  type PlaywrightTestConfig,
} from "@playwright/test";
import { assertLocalSupabaseUrl } from "./scripts/e2e/local-safety.mjs";

const port = 3100;
const baseURL = `http://127.0.0.1:${port}`;
const authenticated = process.env.KLAR_E2E_AUTH === "1";
if (authenticated) {
  assertLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
}
const mode = process.env.KLAR_E2E_MODE ?? "smoke";
const authBrowser: "chromium" | "webkit" =
  process.env.KLAR_E2E_BROWSER === "webkit" ? "webkit" : "chromium";
const authDirectory = path.join(process.cwd(), "playwright", ".auth");
const outputNamespace = authenticated ? `${authBrowser}-${mode}` : "public";

const targets = [
  { name: "small-mobile", width: 360, height: 640, hasTouch: true },
  { name: "mobile-landscape", width: 640, height: 360, hasTouch: true },
  { name: "ipad-portrait", width: 768, height: 1024, hasTouch: true },
  { name: "ipad-landscape", width: 1024, height: 768, hasTouch: true },
  { name: "desktop", width: 1440, height: 900, hasTouch: false },
] as const;

const projects: NonNullable<PlaywrightTestConfig["projects"]> = [];

if (!authenticated || mode === "smoke" || mode === "full") {
  const publicBrowser = authenticated ? authBrowser : "chromium";
  projects.push({
    name: `public-${publicBrowser}`,
    testMatch: /pilot\.spec\.ts/,
    use: {
      ...(publicBrowser === "webkit"
        ? devices["Desktop Safari"]
        : devices["Desktop Chrome"]),
    },
  });
}

if (authenticated) {
  projects.push({
    name: "auth-setup",
    testMatch: /auth\.setup\.ts/,
    use: {
      browserName: authBrowser,
      headless: true,
      screenshot: "off",
      trace: "off",
      video: "off",
    },
  });

  if (mode === "manual") {
    projects.push({
      name: "manual-a1-desktop",
      testMatch: /manual\/a1-desktop\.manual\.spec\.ts/,
      dependencies: ["auth-setup"],
      use: {
        browserName: "chromium",
        headless: false,
        viewport: null,
        launchOptions: { args: ["--start-maximized"] },
        trace: "off",
        screenshot: "off",
        video: "off",
      },
    });
  }

  if (mode === "smoke" || mode === "full") {
    projects.push(
      {
        name: "student-smoke",
        testMatch: /authenticated\/student\.spec\.ts/,
        dependencies: ["auth-setup"],
        use: {
          browserName: authBrowser,
          storageState: path.join(authDirectory, "student.json"),
          viewport: { width: 360, height: 640 },
          hasTouch: true,
        },
      },
      {
        name: "teacher-smoke",
        testMatch: /authenticated\/teacher\.spec\.ts/,
        dependencies: ["auth-setup"],
        use: {
          browserName: authBrowser,
          storageState: path.join(authDirectory, "owner-aal2.json"),
          viewport: { width: 1440, height: 900 },
        },
      },
    );
  }

  if (mode === "staff" || mode === "full") {
    projects.push(
      {
        name: "staff-lifecycle",
        testMatch: /authenticated\/staff-lifecycle\.spec\.ts/,
        dependencies: ["auth-setup"],
        use: {
          browserName: authBrowser,
          viewport: { width: 1440, height: 900 },
        },
      },
      {
        name: "staff-control-actions",
        testMatch: /authenticated\/staff-control-actions\.spec\.ts/,
        dependencies: ["auth-setup"],
        use: {
          browserName: authBrowser,
          viewport: { width: 1440, height: 900 },
          trace: "off",
          screenshot: "off",
          video: "off",
        },
      },
      {
        name: "staff-capabilities",
        testMatch: /authenticated\/staff-capabilities\.spec\.ts/,
        dependencies: ["auth-setup"],
        use: {
          browserName: authBrowser,
          storageState: path.join(
            authDirectory,
            "other-org-staff-aal2.json",
          ),
          viewport: { width: 1440, height: 900 },
        },
      },
      {
        name: "staff-expiry",
        testMatch: /authenticated\/staff-expiry\.spec\.ts/,
        dependencies: ["auth-setup"],
        use: {
          browserName: authBrowser,
          storageState: path.join(authDirectory, "substitute-aal2.json"),
          viewport: { width: 1440, height: 900 },
        },
      },
    );
  }

  if (mode === "visual" || mode === "full") {
    for (const target of targets) {
      projects.push(
        {
          name: `visual-student-${target.name}`,
          testMatch: /visual\/student\.visual\.spec\.ts/,
          dependencies: ["auth-setup"],
          use: {
            browserName: authBrowser,
            storageState: path.join(authDirectory, "visual-student.json"),
            viewport: { width: target.width, height: target.height },
            hasTouch: target.hasTouch,
          },
        },
        {
          name: `visual-student-progress-${target.name}`,
          testMatch: /visual\/student-progress\.visual\.spec\.ts/,
          dependencies: ["auth-setup"],
          use: {
            browserName: authBrowser,
            storageState: path.join(authDirectory, "student.json"),
            viewport: { width: target.width, height: target.height },
            hasTouch: target.hasTouch,
          },
        },
        {
          name: `visual-teacher-${target.name}`,
          testMatch: /visual\/teacher\.visual\.spec\.ts/,
          dependencies: ["auth-setup"],
          use: {
            browserName: authBrowser,
            storageState: path.join(authDirectory, "visual-staff-aal2.json"),
            viewport: { width: target.width, height: target.height },
            hasTouch: target.hasTouch,
          },
        },
        {
          name: `visual-owner-access-${target.name}`,
          testMatch: /visual\/owner-access\.visual\.spec\.ts/,
          dependencies: ["auth-setup"],
          use: {
            browserName: authBrowser,
            storageState: path.join(authDirectory, "visual-owner-aal2.json"),
            viewport: { width: target.width, height: target.height },
            hasTouch: target.hasTouch,
          },
        },
      );
    }
    projects.push({
      name: "visual-owner-access-reflow-200",
      testMatch: /visual\/staff-reflow\.visual\.spec\.ts/,
      dependencies: ["auth-setup"],
      use: {
        browserName: authBrowser,
        storageState: path.join(authDirectory, "visual-owner-aal2.json"),
        // 1440 × 900 at 200 % browser zoom has approximately this CSS viewport.
        viewport: { width: 720, height: 450 },
      },
    });
    projects.push(
      {
        name: "visual-student-reflow-200",
        testMatch: /visual\/student\.visual\.spec\.ts/,
        dependencies: ["auth-setup"],
        use: {
          browserName: authBrowser,
          storageState: path.join(authDirectory, "visual-student.json"),
          // 1440 × 900 at 200 % browser zoom has approximately this CSS viewport.
          viewport: { width: 720, height: 450 },
        },
      },
      {
        name: "visual-teacher-reflow-200",
        testMatch: /visual\/teacher\.visual\.spec\.ts/,
        dependencies: ["auth-setup"],
        use: {
          browserName: authBrowser,
          storageState: path.join(authDirectory, "visual-staff-aal2.json"),
          // Exercise the C1 review at the same 200 % reflow proxy.
          viewport: { width: 720, height: 450 },
        },
      },
    );
  }
}

export default defineConfig({
  testDir: "./tests/e2e",
  respectGitIgnore: false,
  outputDir: path.join("./test-results", outputNamespace),
  fullyParallel: !authenticated,
  workers: authenticated ? (mode === "manual" ? 1 : 4) : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  projects,
  use: {
    baseURL,
    locale: "nb-NO",
    timezoneId: "Europe/Oslo",
    colorScheme: "light",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run start -- -p ${port}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      PILOT_ENABLED: "true",
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "e2e-placeholder-anon-key",
      SUPABASE_SERVICE_ROLE_KEY:
        process.env.SUPABASE_SERVICE_ROLE_KEY ??
        "e2e-placeholder-service-role-key",
      STUDENT_CODE_PEPPER:
        process.env.STUDENT_CODE_PEPPER ??
        "e2e-placeholder-pepper-at-least-32-characters",
      NEXT_PUBLIC_FEATURE_LEGACY_2X: "false",
      NEXT_PUBLIC_FEATURE_PUSH_NOTIFICATIONS: "false",
      FEATURE_SMART_IMPORT_AI: "false",
    },
  },
});

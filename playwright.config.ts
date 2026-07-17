import { defineConfig } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "./tests/e2e",
  respectGitIgnore: false,
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: process.env.CI
      ? `npm run start -- -p ${port}`
      : `npm run dev -- -p ${port}`,
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      PILOT_ENABLED: "true",
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "e2e-placeholder-anon-key",
      SUPABASE_SERVICE_ROLE_KEY:
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? "e2e-placeholder-service-role-key",
      STUDENT_CODE_PEPPER:
        process.env.STUDENT_CODE_PEPPER ??
        "e2e-placeholder-pepper-at-least-32-characters",
      NEXT_PUBLIC_FEATURE_LEGACY_2X: "false",
      NEXT_PUBLIC_FEATURE_PUSH_NOTIFICATIONS: "false",
      FEATURE_SMART_IMPORT_AI: "false",
    },
  },
});

import { defineConfig, devices } from "@playwright/test";

/**
 * Sales Outreach Desk browser checks (ADM-8): visual comparison at the reference size (1186 × 742), keyboard/focus,
 * and 403/reassignment cache clearing. They run against `next dev` in mock mode (`OUTREACH_DESK_MOCK=desk`) with a
 * local e2e admin-user database (seeded by `tests/e2e/global-setup.ts`). No production URI or secret is used:
 * every value below is a local placeholder. Point `E2E_BASE_URL` at an already running server to reuse it.
 *
 *   pnpm test:e2e
 */
const port = Number(process.env.E2E_PORT ?? 3100);
// `localhost`, not 127.0.0.1: next dev refuses its client chunks to an origin it does not list.
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export const E2E_ENV = {
  MONGODB_URI: process.env.E2E_MONGODB_URI ?? "mongodb://127.0.0.1:27189/?directConnection=true",
  ADMIN_AUTH_DB_NAME: process.env.E2E_ADMIN_AUTH_DB_NAME ?? "vantage_admin_outreach_e2e",
  ADMIN_ACCESS_TOKEN_SECRET: "access-secret-for-local-e2e-access-secret-0001",
  ADMIN_REFRESH_TOKEN_SECRET: "refresh-secret-for-local-e2e-refresh-secret-01",
  VANTAGE_API_BASE_URL: "http://127.0.0.1:3107",
  VANTAGE_API_SECRET: "local-e2e-api-secret",
  VANTAGE_ADMIN_PROXY_SIGNING_SECRET: "local-e2e-proxy-signing-secret-32ch",
  OUTREACH_DESK_MOCK: "desk",
  NEXT_TELEMETRY_DISABLED: "1",
} as const;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  outputDir: "test-results/e2e",
  use: {
    baseURL,
    viewport: { width: 1186, height: 742 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    timezoneId: "America/New_York",
    locale: "en-US",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1186, height: 742 }, deviceScaleFactor: 1 } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm exec next dev -p ${port}`,
        url: `${baseURL}/login`,
        reuseExistingServer: true,
        timeout: 180_000,
        env: { ...E2E_ENV, NODE_OPTIONS: "--max-old-space-size=3072" },
      },
});

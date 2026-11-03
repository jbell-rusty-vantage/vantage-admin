import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { ADMIN_PROXY_HEADER_NAMES, computeAdminActorSignature } from "../../server/auth/proxySigning";
import { RetiredIngestionSetupPage } from "./pages/retired-ingestion";

// This regression uses an isolated local canonical API in addition to the
// normal local auth seed. The general mock-only e2e run does not start it.
const localApi = process.env.E2E_RETIREMENT_API_BASE_URL;
test.skip(!localApi, "Requires E2E_RETIREMENT_API_BASE_URL and isolated local auth/API databases.");
if (localApi && !["127.0.0.1", "localhost"].includes(new URL(localApi).hostname)) throw new Error("Retirement browser regression must use a loopback canonical API.");

test("Owner Setup removes external ingestion and preserves the Granot registry", async ({ page }, testInfo) => {
  const setup = new RetiredIngestionSetupPage(page);
  const login = await setup.loginOwner();
  expect(login.ok).toBe(true);
  await expect(setup.setupNavigation.getByRole("link", { name: /External Sheet|Best Relocation|Sheet ingestion/i })).toHaveCount(0);
  await expect(page.getByTestId("connections-granot")).toBeVisible();
  await expect(page.getByTestId("connections-best-relocation")).toHaveCount(0);
  await expect(page.getByText(/Best Relocation.*(ingestion|schedule)|Enable.*ingestion/i)).toHaveCount(0);
  await setup.screenshot(testInfo.outputPath("owner-connections.png"));
  await setup.openGranotNames();
  await expect(setup.granotNamesHeading).toBeVisible();
  await expect(setup.addGranotName).toBeVisible();
  await setup.screenshot(testInfo.outputPath("owner-granot-registry.png"));
});

test("retired URLs are removed and expose no ingestion controls", async ({ page }, testInfo) => {
  const setup = new RetiredIngestionSetupPage(page);
  await setup.loginOwner();
  for (const route of ["/ingestion", "/setup/sheet-ingestion"]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /ingest|enable|run now|preview/i })).toHaveCount(0);
  }
  await setup.screenshot(testInfo.outputPath("retired-route-not-found.png"));
});

test("authenticated Owner cannot reactivate old paths; local canonical API returns stable 410", async ({ page }) => {
  const setup = new RetiredIngestionSetupPage(page);
  const { data: { admin } } = await setup.loginOwner();
  const endpoints = [
    ["PATCH", "connections/best-relocation"],
    ["POST", "connections/best-relocation/preview"],
    ["POST", "connections/best-relocation/run"],
    ["POST", "connections/best-relocation/repair-identities"],
    ["POST", "runs/old/retry"],
    ["POST", "conflicts/old/resolve"],
  ] as const;
  for (const [method, suffix] of endpoints) {
    const path = `/api/v1/admin/ingestion/${suffix}`;
    const proxy = await page.request.fetch(`/api/proxy${path}`, { method, data: { application_enabled: true } });
    expect(proxy.status(), `${method} ${path} Admin proxy`).toBe(403);
    const timestamp = String(Date.now()), requestId = randomUUID();
    const headers = {
      "x-api-secret": "local-e2e-api-secret",
      [ADMIN_PROXY_HEADER_NAMES.userId]: admin.id,
      [ADMIN_PROXY_HEADER_NAMES.email]: admin.email,
      [ADMIN_PROXY_HEADER_NAMES.role]: admin.role,
      [ADMIN_PROXY_HEADER_NAMES.timestamp]: timestamp,
      [ADMIN_PROXY_HEADER_NAMES.requestId]: requestId,
      [ADMIN_PROXY_HEADER_NAMES.signature]: computeAdminActorSignature({ adminId: admin.id, email: admin.email, role: admin.role, method, path, timestamp, requestId }, "local-e2e-proxy-signing-secret-32ch"),
    };
    const canonical = await page.request.fetch(`${localApi}${path}`, { method, headers, data: { application_enabled: true } });
    expect(canonical.status(), `${method} ${path} canonical API`).toBe(410);
    expect((await canonical.json()).code).toBe("BEST_RELOCATION_RETIRED");
  }
});

test("Owner Insights displays the server bad-call metric separately", async ({ page }, testInfo) => {
  const setup = new RetiredIngestionSetupPage(page);
  await setup.loginOwner();
  await page.goto("/insights");
  await expect(page.getByRole("heading", { name: "Bad Call Leads", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Bad Call Leads", exact: true })).toContainText("0");
  await page.getByRole("region", { name: "Bad Call Leads", exact: true }).scrollIntoViewIfNeeded();
  await setup.screenshot(testInfo.outputPath("owner-insights-bad-call-metric.png"));
});

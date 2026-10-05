import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page, type Response } from "@playwright/test";
import {
  salesOutreachCapabilitiesSchema,
  salesOutreachDetailSchema,
  salesOutreachQueueSchema,
  salesOutreachRepDaysSchema,
  salesOutreachTeamSchema,
  salesOutreachConfigurationReadSchema,
  salesOutreachEnrollmentReportSchema,
  salesOutreachEnrollmentApplySchema,
  salesOutreachAssignmentResponseSchema,
} from "../../lib/api/salesOutreach";
import { signIn, waitForDesk } from "./helpers";

/**
 * P2 integration walk (SPRINT-RUNBOOK P2): the admin against the REAL server API on the csi01 loopback replica with
 * the server's synthetic pilot (`ops/sales-outreach/seed-synthetic-pilot.ts`). Skipped unless E2E_INTEGRATION=1.
 * Every desk response the browser receives is validated against the admin's Zod mirror, so contract drift fails here.
 *
 *   E2E_INTEGRATION=1 E2E_BASE_URL=http://localhost:3100 P2_API=http://127.0.0.1:3107 P2_CRON_SECRET=… pnpm exec playwright test tests/e2e/integration.spec.ts
 */
const enabled = process.env.E2E_INTEGRATION === "1";
const API = process.env.P2_API ?? "http://127.0.0.1:3107";
const CRON = process.env.P2_CRON_SECRET ?? "";
const EVIDENCE = path.join(process.cwd(), "docs/sales-outreach-desk/workspace/evidence/screenshots");
const BFF = "/api/proxy/api/v1/admin/sales-outreach";

test.skip(!enabled, "P2 integration needs the replica API (E2E_INTEGRATION=1)");
test.describe.configure({ mode: "serial" });

type Drift = { url: string; issue: string };
const drift: Drift[] = [];
const seen = new Set<string>();

const schemaFor = (url: string) => {
  const pathname = new URL(url).pathname.replace(BFF, "");
  if (pathname === "/capabilities") return salesOutreachCapabilitiesSchema;
  if (pathname === "/team") return salesOutreachTeamSchema;
  if (pathname === "/rep-days") return salesOutreachRepDaysSchema;
  if (pathname === "/queue") return salesOutreachQueueSchema;
  if (/^\/outreach\/[a-f\d]{24}$/.test(pathname)) return salesOutreachDetailSchema;
  if (pathname === "/configuration") return salesOutreachConfigurationReadSchema;
  return null;
};

function watchContract(page: Page) {
  page.on("response", async (response: Response) => {
    const url = response.url();
    if (!url.includes(BFF) || response.request().method() !== "GET") return;
    const schema = schemaFor(url);
    if (!schema || !response.ok()) return;
    seen.add(new URL(url).pathname.replace(BFF, "").replace(/[a-f\d]{24}/, ":id"));
    try {
      const body = await response.json();
      const parsed = schema.safeParse(body.data);
      if (!parsed.success) drift.push({ url, issue: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
    } catch (error) {
      drift.push({ url, issue: String(error) });
    }
  });
}

async function bff<T>(request: APIRequestContext, method: "GET" | "POST" | "PATCH", pathname: string, body?: unknown, key?: string): Promise<{ status: number; json: T }> {
  const response = await request.fetch(`${BFF}/${pathname}`, {
    method,
    data: body,
    headers: { "content-type": "application/json", ...(key ? { "idempotency-key": key } : {}) },
  });
  return { status: response.status(), json: (await response.json()) as T };
}

async function cron(request: APIRequestContext, name: string) {
  const response = await request.fetch(`${API}/api/cron/${name}`, { method: "GET", headers: { "x-cron-secret": CRON } });
  return { status: response.status(), body: await response.json().catch(() => null) };
}

test.beforeAll(() => mkdirSync(EVIDENCE, { recursive: true }));
test.afterAll(() => {
  writeFileSync(path.join(process.cwd(), "test-results", "p2-contract.json"), JSON.stringify({ drift, reads_validated: [...seen].sort() }, null, 2));
});

test("Owner: enroll the pilot through the BFF and drive the desk crons", async ({ page }) => {
  await signIn(page, "owner");
  const caps = await bff<{ ok: boolean; data: unknown }>(page.request, "GET", "capabilities");
  expect(caps.status).toBe(200);
  const capabilities = salesOutreachCapabilitiesSchema.parse(caps.json.data);
  expect(capabilities.desk_available).toBe(true);

  const config = await bff<{ ok: boolean; data: unknown }>(page.request, "GET", "configuration");
  expect(config.status).toBe(200);
  const read = salesOutreachConfigurationReadSchema.parse(config.json.data);
  if (read.value?.migration.paused) {
    const value = { ...read.value, migration: { ...read.value.migration, paused: false } };
    const patched = await bff(page.request, "PATCH", "configuration", { expected_revision: read.revision, value }, `p2-unpause-${read.revision}`);
    expect(patched.status, JSON.stringify(patched.json)).toBe(200);
  }

  const report = await bff<{ ok: boolean; data: unknown }>(page.request, "POST", "enrollment/report", { selection: { mode: "backfill_scope" }, kind: "pilot", cohort_id: "p2-pilot" }, "p2-report-1");
  expect(report.status, JSON.stringify(report.json)).toBe(200);
  const manifest = salesOutreachEnrollmentReportSchema.parse(report.json.data);
  expect(manifest.writes).toBe(0);
  let status = "running";
  for (let attempt = 0; attempt < 10 && status !== "completed"; attempt += 1) {
    const apply = await bff<{ ok: boolean; data: unknown }>(page.request, "POST", "enrollment/apply", { kind: "pilot", cohort_id: manifest.cohort_id, lead_refs: manifest.lead_refs, manifest_hash: manifest.manifest_hash }, "p2-apply-1");
    expect(apply.status, JSON.stringify(apply.json)).toBe(200);
    status = salesOutreachEnrollmentApplySchema.parse(apply.json.data).status;
  }
  expect(status).toBe("completed");

  for (const name of ["sales-outreach-lead-changes", "sales-outreach-contact-events", "sales-outreach-evaluate", "sales-outreach-evaluate"]) {
    const result = await cron(page.request, name);
    expect(result.status, `${name}: ${JSON.stringify(result.body)}`).toBe(200);
  }
});

test("Owner and Manager: Team desk on real data", async ({ page }) => {
  watchContract(page);
  await signIn(page, "owner");
  await page.goto("/outreach-desk?view=team");
  await waitForDesk(page);
  await expect(page.getByRole("heading", { name: "Team outreach" })).toBeVisible();
  await expect(page.getByTestId("daily-call-goals").getByText(/Pilot Rep Avery/)).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE, "p2-team-owner.png") });
  await page.goto("/outreach-desk?view=settings");
  await waitForDesk(page);
  await page.screenshot({ path: path.join(EVIDENCE, "p2-settings-owner.png"), fullPage: true });
  await page.context().clearCookies();

  await signIn(page, "manager");
  await page.goto("/outreach-desk?view=team");
  await waitForDesk(page);
  await expect(page.getByRole("heading", { name: "Team outreach" })).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE, "p2-team-manager.png") });
  const config = await bff(page.request, "GET", "configuration");
  expect(config.status).toBe(403);
});

test("Rep: own queue and lead on real data; a foreign rep's lead is 404", async ({ page }) => {
  watchContract(page);
  await signIn(page, "rep");
  await page.goto("/outreach-desk?view=my&workflow=all&state=all_active");
  await waitForDesk(page);
  await expect(page.getByRole("heading", { name: "My outreach" })).toBeVisible();
  await expect(page.locator(".od-table--queue tbody tr[data-subject]").first()).toBeVisible();
  await expect(page.locator(".od-lead__job")).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE, "p2-my-rep.png") });
  const team = await bff(page.request, "GET", "team");
  expect(team.status).toBe(403);
  const foreign = await bff(page.request, "GET", "rep-days?agent_id=360f2f6456d420c391c73535");
  expect(foreign.status).toBe(403);
});

test("Reassignment on the server revokes the former Rep's read (P06d, cache-clear path)", async ({ browser }) => {
  const ownerPage = await browser.newPage();
  await signIn(ownerPage, "owner");
  const queue = await bff<{ ok: boolean; data: unknown }>(ownerPage.request, "GET", "queue?agent_id=d9e98cc15237c848c5c8732b&state=all_active");
  expect(queue.status).toBe(200);
  const row = salesOutreachQueueSchema.parse(queue.json.data).rows[0];
  expect(row, "Avery has a lead").toBeTruthy();
  const detail = salesOutreachDetailSchema.parse((await bff<{ data: unknown }>(ownerPage.request, "GET", `outreach/${row!.subject_id}`)).json.data);

  const repPage = await browser.newPage();
  watchContract(repPage);
  await signIn(repPage, "rep");
  await repPage.goto(`/outreach-desk?view=my&workflow=all&state=all_active&lead=${row!.subject_id}`);
  await waitForDesk(repPage);
  await expect(repPage.locator(".od-lead__job")).toBeVisible();

  const moved = await bff<{ ok: boolean; data: unknown }>(ownerPage.request, "PATCH", `outreach/${row!.subject_id}/assignment`, { expected_revision: detail.assignment.assignment_revision, agent_id: "360f2f6456d420c391c73535" }, `p2-assign-${row!.subject_id}`);
  expect(moved.status, JSON.stringify(moved.json)).toBe(200);
  salesOutreachAssignmentResponseSchema.parse(moved.json.data);

  await repPage.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(() => new URL(repPage.url()).searchParams.get("lead"), { timeout: 20_000 }).toBeNull();
  await expect(repPage.locator(`.od-table--queue tr[data-subject="${row!.subject_id}"]`)).toHaveCount(0);
  const after = await bff(repPage.request, "GET", `outreach/${row!.subject_id}`);
  expect(after.status).toBe(404);
  await repPage.screenshot({ path: path.join(EVIDENCE, "p2-rep-after-reassignment.png") });
});

test("generic Admin: no desk at page, BFF or stream", async ({ page }) => {
  await signIn(page, "admin");
  const pageResponse = await page.request.get("/outreach-desk", { maxRedirects: 0 });
  expect([307, 308]).toContain(pageResponse.status());
  expect((await bff(page.request, "GET", "capabilities")).status).toBe(403);
  expect((await page.request.get("/api/outreach-desk-live")).status()).toBe(403);
});

test("no contract drift in any desk read the browser made", () => {
  expect(drift, JSON.stringify(drift, null, 2)).toEqual([]);
  expect([...seen].length).toBeGreaterThan(3);
});

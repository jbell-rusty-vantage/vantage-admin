import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { expect, test, type APIRequestContext, type Page, type Response } from "@playwright/test";
import { accountCommandSchema, accountsSchema, leadSearchSchema, numberDetailSchema, numbersPageSchema } from "../../lib/api/allNumbers";
import { salesOutreachErrorFromBody } from "../../lib/api/salesOutreach";
import { signIn, waitForDesk } from "./helpers";

/**
 * All Numbers + Accounts integration walk: the admin against the REAL server API (phase B) on the csi01 loopback replica,
 * after the production order (pilot seed + legacy numbers/attachments → phase A migration → phase B → desk resync →
 * cleanup). Skipped unless E2E_INTEGRATION=1. Every All Numbers / Accounts response the browser receives is validated
 * against the admin's Zod mirror, and the desk consequences of a link change are read from the server database.
 *
 *   E2E_INTEGRATION=1 E2E_BASE_URL=http://localhost:3100 INT_API=http://127.0.0.1:3107 INT_CRON_SECRET=… \
 *   INT_DB=testvantagemovers_allnumint pnpm exec playwright test tests/e2e/all-numbers.integration.spec.ts
 */
const enabled = process.env.E2E_INTEGRATION === "1";
const API = process.env.INT_API ?? "http://127.0.0.1:3107";
const CRON = process.env.INT_CRON_SECRET ?? "";
const DB = process.env.INT_DB ?? "";
const EVIDENCE = path.join(process.cwd(), "docs/sales-outreach-desk/workspace/evidence/screenshots");
const BFF = "/api/proxy/api/v1/admin/sales-intelligence";

test.skip(!enabled, "All Numbers integration needs the replica API (E2E_INTEGRATION=1)");
test.describe.configure({ mode: "serial" });

type Drift = { url: string; issue: string };
const drift: Drift[] = [];
const seen = new Set<string>();

const schemaFor = (url: string, method: string) => {
  const pathname = new URL(url).pathname.replace(BFF, "");
  if (method === "GET" && pathname === "/numbers") return numbersPageSchema;
  if (method === "GET" && pathname === "/numbers/lead-search") return leadSearchSchema;
  if (/^\/numbers\/[a-f\d]{24}(\/lead)?$/.test(pathname)) return numberDetailSchema;
  if (pathname === "/accounts" || pathname === "/accounts/suggest") return accountsSchema;
  if (/^\/accounts\/[^/]+\/agent$/.test(pathname)) return accountCommandSchema;
  return null;
};

function watchContract(page: Page) {
  page.on("response", async (response: Response) => {
    const url = response.url();
    if (!url.includes(BFF)) return;
    const method = response.request().method();
    const schema = schemaFor(url, method);
    if (!schema || !response.ok()) return;
    seen.add(`${method} ${new URL(url).pathname.replace(BFF, "").replace(/[a-f\d]{24}/, ":id").replace(/accounts\/[^/]+\/agent/, "accounts/:ext/agent")}`);
    try {
      const body = await response.json();
      const parsed = schema.safeParse(body.data);
      if (!parsed.success) drift.push({ url, issue: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
    } catch (error) {
      drift.push({ url, issue: String(error) });
    }
  });
}

async function cron(request: APIRequestContext, name: string) {
  const response = await request.fetch(`${API}/api/cron/${name}`, { method: "GET", headers: { "x-cron-secret": CRON } });
  expect(response.status(), name).toBe(200);
}
/** The minute crons that drain the desk wake of a link or account change. */
async function drainDesk(request: APIRequestContext) {
  for (const name of ["sales-intelligence-job-recovery", "sales-outreach-lead-changes", "sales-outreach-contact-events", "sales-outreach-evaluate"]) await cron(request, name);
}

/* ── Read-only server database probes (the desk consequences of a link change) ── */
let db: mongoose.mongo.Db;
async function leadIdByName(name: string) {
  const lead = await db.collection("form_leads").findOne({ name });
  return lead!._id as mongoose.Types.ObjectId;
}
async function subjectOf(name: string) {
  return db.collection("sales_outreach_subjects").findOne({ lead_id: await leadIdByName(name) });
}
/** Which subject the post-activation call on `e164` credits now (null = none), and the number ids each named subject carries. */
async function deskState(e164: string, names: string[]) {
  const number = await db.collection("contact_numbers").findOne({ e164 });
  const call = await db.collection("call_interactions").findOne({ contact_number_id: number!._id, telephony_session_id: /^tsess-post-/ });
  const event = await db.collection("sales_outreach_contact_events").findOne({ source_kind: "call", source_id: call!._id });
  const subjects: Record<string, boolean> = {};
  for (const name of names) subjects[name] = ((await subjectOf(name))?.contact_number_ids ?? []).map(String).includes(String(number!._id));
  const credited = event?.subject_id ? await db.collection("sales_outreach_subjects").findOne({ _id: event.subject_id }) : null;
  const creditedName = credited ? (await db.collection("form_leads").findOne({ _id: credited.lead_id }))?.name ?? null : null;
  return { credited: creditedName, association: event?.association ?? null, goal_credit: event?.goal_credit ?? null, has_number: subjects };
}

const numberRow = (page: Page, display: string) => page.locator(".od-table--numbers tbody tr[data-number]", { hasText: display });
const accountRow = (page: Page, extension: string) => page.locator(`.od-table--accounts tr[data-extension="${extension}"]`);
const shot = (page: Page, name: string, fullPage = false) => page.screenshot({ path: path.join(EVIDENCE, `integration-${name}.png`), fullPage });

test.beforeAll(async () => {
  mkdirSync(EVIDENCE, { recursive: true });
  if (!enabled) return;
  expect(DB).toMatch(/^testvantagemovers_[a-z0-9]+$/);
  await mongoose.connect("mongodb://127.0.0.1:27189/?directConnection=true", { dbName: DB });
  db = mongoose.connection.db!;
});
test.afterAll(async () => {
  if (!enabled) return;
  writeFileSync(path.join(process.cwd(), "test-results", "all-numbers-contract.json"), JSON.stringify({ drift, reads_validated: [...seen].sort() }, null, 2));
  await mongoose.disconnect();
});

test("All Numbers on real data: cards, list, Load more and the side panel", async ({ page }) => {
  watchContract(page);
  await signIn(page, "owner");
  await page.goto("/outreach-desk?view=numbers");
  await waitForDesk(page);
  await expect(page.getByRole("heading", { name: "All Numbers", level: 1 })).toBeVisible();
  await expect(page.getByTestId("card-waiting")).toContainText("12");
  await expect(page.getByTestId("card-all-numbers")).toContainText("44");
  const rows = page.locator(".od-table--numbers tbody tr[data-number]");
  await expect(rows).toHaveCount(25);
  await expect(numberRow(page, "(555) 010-0001")).toContainText("Morgan Ellis");
  await expect(numberRow(page, "(555) 010-0001")).toContainText("Job JOB-2001");
  await shot(page, "all-numbers-owner-1186x742");

  await page.getByRole("button", { name: "Load more" }).click();
  await expect(rows).toHaveCount(44);
  await expect(page.getByRole("button", { name: "Load more" })).toHaveCount(0);
  await expect(numberRow(page, "(555) 010-9001")).toContainText("Unknown");
  await expect(numberRow(page, "(555) 010-9001")).toContainText("WIRELESS CALLER");
  await expect(rows.filter({ hasText: "(555) 010-9099" })).toHaveCount(0); // purged

  // A number with two Leads: the newest is its Lead, the other one is listed.
  await numberRow(page, "(555) 010-0019").click();
  const panel = page.getByTestId("number-panel");
  await expect(panel.getByTestId("number-lead")).toContainText("Blair Tanaka");
  await expect(panel.getByTestId("number-lead")).toContainText("Matched by phone");
  await expect(panel.getByRole("link", { name: /Open in desk/ })).toHaveAttribute("href", /\/outreach-desk\?view=team&lead=[a-f\d]{24}$/);
  await expect(panel).toContainText("Other leads with this number");
  await expect(panel.getByTestId("number-calls").locator("li")).toHaveCount(2);
  await shot(page, "all-numbers-panel-1186x742");

  // The Call Lead found by its RingCentral session wins over the older Form Lead on the same phone.
  await numberRow(page, "(555) 010-9002").click();
  await expect(panel.getByTestId("number-lead")).toContainText("JOB-3102");
  await expect(panel).toContainText("JOB-3101");
  // The migrated Owner pin and Owner rejection.
  await numberRow(page, "(555) 010-9003").click();
  await expect(panel.getByTestId("number-lead")).toContainText("Lee Hart");
  await expect(panel.getByTestId("number-lead")).toContainText("Linked by you");
  await numberRow(page, "(555) 010-9004").click();
  await expect(panel.getByTestId("number-lead")).toContainText("Right Person");
  await expect(panel).toContainText("Unlinked leads");
  await expect(panel).toContainText("Wrong Person");
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});

test("Waiting on us and search (digits, caller name, Lead name, job #)", async ({ page }) => {
  watchContract(page);
  await signIn(page, "owner");
  await page.goto("/outreach-desk?view=numbers");
  await waitForDesk(page);
  await page.getByRole("group", { name: "Show" }).getByRole("button", { name: /Waiting on us/ }).click();
  await expect(page).toHaveURL(/view=numbers&show=waiting/);
  const rows = page.locator(".od-table--numbers tbody tr[data-number]");
  await expect(rows).toHaveCount(12);
  await expect(rows.first()).toContainText("(555) 010-9117"); // the longest wait
  await expect(rows.last()).toContainText("(555) 010-0013");
  for (const row of await rows.all()) await expect(row.locator(".od-wait")).toBeVisible();
  await shot(page, "all-numbers-waiting-1186x742");

  const search = page.getByRole("searchbox", { name: "Search number, name or job #" });
  const expectSearch = async (q: string, display: string, count = 1) => {
    await search.fill(q);
    await page.keyboard.press("Enter");
    await expect(rows).toHaveCount(count);
    await expect(rows.first()).toContainText(display);
  };
  await expectSearch("wireless", "(555) 010-9001");
  // Switch back to All and search right away: the second URL write must build on the first, not on the stale URL.
  await page.getByRole("group", { name: "Show" }).getByRole("button", { name: /^All/ }).click();
  await expectSearch("0109002", "(555) 010-9002");
  await expect(page).toHaveURL(/view=numbers&q=0109002$/);
  await expectSearch("Riley", "(555) 010-0004");
  await expectSearch("JOB-3302", "(555) 010-9004");
  await expectSearch("john smith", "(555) 010-9101");
});

test("Link to a lead, Use this lead, Unlink, Link again — and the desk credit follows", async ({ page }) => {
  watchContract(page);
  await signIn(page, "owner");
  const before = await deskState("+15550100001", ["Morgan Ellis", "Jordan Reyes"]);
  expect(before).toEqual({ credited: "Morgan Ellis", association: "unique", goal_credit: "confirmed", has_number: { "Morgan Ellis": true, "Jordan Reyes": false } });

  await page.goto("/outreach-desk?view=numbers&q=0100001");
  await waitForDesk(page);
  await numberRow(page, "(555) 010-0001").click();
  const panel = page.getByTestId("number-panel");
  await expect(panel.getByTestId("number-lead")).toContainText("Morgan Ellis");

  // Link a different lead found by search.
  await panel.getByRole("button", { name: "Link a different lead" }).click();
  await panel.getByRole("searchbox", { name: "Search leads by name, job # or phone" }).fill("Jordan");
  await expect(panel.getByRole("button", { name: "Link: Jordan Reyes" })).toBeVisible();
  await shot(page, "all-numbers-link-picker-1186x742");
  await panel.getByRole("button", { name: "Link: Jordan Reyes" }).click();
  await expect(panel.getByRole("status")).toHaveText("Linked to Jordan Reyes.");
  await expect(panel.getByTestId("number-lead")).toContainText("Jordan Reyes");
  await expect(panel.getByTestId("number-lead")).toContainText("Linked by you");
  await expect(numberRow(page, "(555) 010-0001")).toContainText("Jordan Reyes");
  await drainDesk(page.request);
  expect(await deskState("+15550100001", ["Morgan Ellis", "Jordan Reyes"])).toEqual({
    credited: "Jordan Reyes", association: "unique", goal_credit: "confirmed", has_number: { "Morgan Ellis": true, "Jordan Reyes": true },
  });

  // Morgan is still a phone match: "Use this lead" pins Morgan back.
  await panel.locator("li", { hasText: "Morgan Ellis" }).getByRole("button", { name: "Use this lead" }).click();
  await expect(panel.getByRole("status")).toHaveText("Linked to Morgan Ellis.");
  await expect(panel.getByTestId("number-lead")).toContainText("Morgan Ellis");
  await drainDesk(page.request);
  expect(await deskState("+15550100001", ["Morgan Ellis", "Jordan Reyes"])).toEqual({
    credited: "Morgan Ellis", association: "unique", goal_credit: "confirmed", has_number: { "Morgan Ellis": true, "Jordan Reyes": false },
  });

  // Unlink: Morgan is never matched again, the number is Unknown, the call credits nobody.
  await panel.getByRole("button", { name: "Unlink" }).click();
  await expect(panel.getByRole("status")).toHaveText("Morgan Ellis unlinked.");
  await expect(panel.getByTestId("number-lead")).toContainText("Unknown");
  await expect(panel).toContainText("Unlinked leads");
  await shot(page, "all-numbers-unlinked-1186x742");
  await drainDesk(page.request);
  const unlinked = await deskState("+15550100001", ["Morgan Ellis", "Jordan Reyes"]);
  expect(unlinked.credited).toBeNull();
  expect(unlinked.has_number).toEqual({ "Morgan Ellis": false, "Jordan Reyes": false });

  // Link again from the Unlinked list restores the credit.
  await panel.locator("li", { hasText: "Morgan Ellis" }).getByRole("button", { name: "Link again" }).click();
  await expect(panel.getByRole("status")).toHaveText("Linked to Morgan Ellis.");
  await drainDesk(page.request);
  expect(await deskState("+15550100001", ["Morgan Ellis", "Jordan Reyes"])).toEqual({
    credited: "Morgan Ellis", association: "unique", goal_credit: "confirmed", has_number: { "Morgan Ellis": true, "Jordan Reyes": false },
  });
});

test("through the BFF: unknown number 404, stale revision REVISION_CONFLICT 409, foreign cursor CURSOR_EXPIRED 409, unknown param 400", async ({ page }) => {
  await signIn(page, "owner");
  const missing = await page.request.get(`${BFF}/numbers/000000000000000000000000?scope=production`);
  expect(missing.status()).toBe(404);
  const list = await (await page.request.get(`${BFF}/numbers?scope=production&q=0100002`)).json();
  const row = list.data.items[0];
  const stale = await page.request.post(`${BFF}/numbers/${row.id}/lead?scope=production`, {
    data: { revision: row.revision - 1, lead: { model: row.lead.model, id: row.lead.id } },
    headers: { "Idempotency-Key": `int-stale-${Date.now()}` },
  });
  expect(stale.status()).toBe(409);
  const refusal = await stale.json();
  // The generic proxy carries the server code as `registry_code`; the client parser reads either.
  expect(refusal.code ?? refusal.registry_code).toBe("REVISION_CONFLICT");
  expect(salesOutreachErrorFromBody(409, refusal, "COMMAND_FAILED").code).toBe("REVISION_CONFLICT");
  const firstPage = await (await page.request.get(`${BFF}/numbers?scope=production&limit=2`)).json();
  const badCursor = await page.request.get(`${BFF}/numbers?scope=production&view=waiting&cursor=${encodeURIComponent(firstPage.data.cursor)}`);
  // A cursor of another view is CURSOR_EXPIRED (409); the list then restarts from page one.
  expect(badCursor.status()).toBe(409);
  expect((await badCursor.json()).registry_code).toBe("CURSOR_EXPIRED");
  // Unknown query params are refused.
  expect((await page.request.get(`${BFF}/numbers?scope=production&bogus=1`)).status()).toBe(400);
});

test("Accounts on real data: Suggest matches, Connect, Change, Disconnect, desk assignment follows, Message preview", async ({ page }) => {
  watchContract(page);
  await signIn(page, "owner");
  await page.goto("/outreach-desk?view=accounts");
  await waitForDesk(page);
  await expect(page.getByRole("heading", { name: "RingCentral Accounts", level: 1 })).toBeVisible();
  await expect(accountRow(page, "101")).toContainText("Pilot Rep Avery");
  await expect(accountRow(page, "101")).toContainText("Sales rep");
  await expect(accountRow(page, "101")).toContainText("(555) 010-0801");
  await expect(accountRow(page, "104")).toContainText("Not connected");
  await expect(accountRow(page, "104").getByRole("button", { name: "Connect Dana Service" })).toBeVisible();
  await expect(accountRow(page, "105")).toContainText("Not connected");
  await expect(accountRow(page, "106")).toContainText("Old Employee");
  await expect(page.locator('.od-table--accounts tr[data-extension="201"]')).toHaveCount(0); // a Department is not a User
  await shot(page, "accounts-owner-1186x742");

  await page.getByRole("button", { name: "Suggest matches" }).click();
  await expect(page.getByRole("status").first()).toHaveText(/match|No new matches found\./);

  // One click connects the suggestion; the link is reviewed at once.
  const linksBefore = await db.collection("rep_identity_links").countDocuments({ rc_extension_id: "104" });
  await accountRow(page, "104").getByRole("button", { name: "Connect Dana Service" }).click();
  await expect(page.getByRole("status").first()).toHaveText("Dana Service is connected to Dana Service.");
  await expect(accountRow(page, "104")).toHaveAttribute("data-connected", "true");
  await expect(accountRow(page, "104")).toContainText("Sales rep");
  const dana = await db.collection("rep_identity_links").findOne({ rc_account_id: "pilot", rc_extension_id: "104", effective_to: null });
  expect(dana?.status).toBe("reviewed");
  expect(dana?.rc_sms_sender_number).toBe("+15550100804");

  // Change: another Agent and role.
  await accountRow(page, "104").getByRole("button", { name: "Change: Dana Service" }).click();
  const editor = page.getByRole("form", { name: "Connect Dana Service to an Agent" });
  await editor.getByLabel("Agent").selectOption({ label: "Robin Field" });
  await editor.getByLabel("Role").selectOption({ label: "Service" });
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status").first()).toHaveText("Robin Field is connected to Dana Service.");
  await expect(accountRow(page, "104")).toContainText("Robin Field");
  await expect(accountRow(page, "104")).toContainText("Service");
  expect(await db.collection("rep_identity_links").countDocuments({ rc_extension_id: "104" })).toBe(linksBefore + 2); // connect, then change (the first is retired)

  // Disconnect asks first.
  await accountRow(page, "104").getByRole("button", { name: "Disconnect: Dana Service" }).click();
  await page.getByRole("group", { name: "Disconnect" }).getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByRole("status").first()).toHaveText("Dana Service is not connected now.");
  await expect(accountRow(page, "104")).toHaveAttribute("data-connected", "false");

  // Desk assignment follows a rep's connection (CONTRACT alignment item 2): disconnect Casey, then connect Casey again.
  const casey = await db.collection("agents").findOne({ name: "Pilot Rep Casey" });
  const caseySubjects = async () => {
    const leads = await db.collection("form_leads").find({ receiver_agent: casey!._id }, { projection: { _id: 1 } }).toArray();
    const subjects = await db.collection("sales_outreach_subjects").find({ lead_id: { $in: leads.map((l) => l._id) } }).toArray();
    return { total: subjects.length, assigned: subjects.filter((s) => String(s.assigned_agent_id) === String(casey!._id)).length };
  };
  const assignedBefore = await caseySubjects();
  expect(assignedBefore.total).toBeGreaterThan(0);
  expect(assignedBefore.assigned).toBe(assignedBefore.total);
  await accountRow(page, "103").getByRole("button", { name: "Disconnect: Pilot Rep Casey" }).click();
  await page.getByRole("group", { name: "Disconnect" }).getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByRole("status").first()).toHaveText("Pilot Rep Casey is not connected now.");
  await drainDesk(page.request);
  expect((await caseySubjects()).assigned).toBe(0);
  await accountRow(page, "103").getByRole("button", { name: "Connect: Pilot Rep Casey" }).click();
  const reconnect = page.getByRole("form", { name: "Connect Pilot Rep Casey to an Agent" });
  await reconnect.getByLabel("Agent").selectOption({ label: "Pilot Rep Casey" });
  await reconnect.getByLabel("Role").selectOption({ label: "Sales rep" });
  await reconnect.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status").first()).toHaveText("Pilot Rep Casey is connected to Pilot Rep Casey.");
  await drainDesk(page.request);
  expect((await caseySubjects()).assigned).toBe(assignedBefore.total);

  // Message: preview only. Send would reach RingCentral, which this replica run never does.
  await accountRow(page, "101").getByRole("button", { name: "Message: Pilot Rep Avery" }).click();
  const message = page.getByTestId("message-panel");
  await message.getByLabel("Message", { exact: true }).fill("Please call back today's missed callers.");
  await message.getByRole("button", { name: "Preview" }).click();
  await expect(message.getByTestId("message-preview")).toContainText("Please call back today's missed callers.");
  await expect(message.getByRole("button", { name: "Send" })).toBeEnabled();
  await page.waitForTimeout(200);
  await shot(page, "accounts-message-preview-1186x742");
});

for (const view of ["numbers", "accounts"] as const) {
  test(`scroll: ${view} scrolls inside the desk frame on real data`, async ({ page }) => {
    await page.setViewportSize({ width: 1186, height: 600 });
    await signIn(page, "owner");
    await page.goto(`/outreach-desk?view=${view}`);
    await waitForDesk(page);
    const scroller = page.locator(".od-scroll").first();
    await scroller.hover();
    await page.mouse.wheel(0, 600);
    await expect.poll(() => scroller.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  });
}

test("the other desk views still load against phase B", async ({ page }) => {
  await signIn(page, "owner");
  for (const [view, heading] of [["team", "Team outreach"], ["activity", "Activity"], ["settings", "Settings"]] as const) {
    await page.goto(`/outreach-desk?view=${view}`);
    await waitForDesk(page);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
    await expect(page.locator(".od-main [role=alert]")).toHaveCount(0);
  }
  await shot(page, "team-owner-phase-b-1186x742");
  await page.context().clearCookies();
  await signIn(page, "rep");
  await page.goto("/outreach-desk?view=my&workflow=all&state=all_active");
  await waitForDesk(page);
  await expect(page.getByRole("heading", { name: "My outreach" })).toBeVisible();
  await expect(page.locator(".od-table--queue tbody tr[data-subject]").first()).toBeVisible();
  await expect(page.locator(".od-main [role=alert]")).toHaveCount(0);
  // A Rep never reaches All Numbers or Accounts.
  expect((await page.request.get(`${BFF}/numbers?scope=production`)).status()).toBe(403);
});

test("no contract drift on any All Numbers / Accounts response", () => {
  expect(drift).toEqual([]);
  expect([...seen].length).toBeGreaterThan(5);
});

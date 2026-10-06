import { expect, test, type Page } from "@playwright/test";
import { DESK_API, signIn, waitForDesk } from "./helpers";
import { SYNTHETIC_AGENTS } from "../outreach-desk/fixtures/synthetic";

/**
 * ADM-8 flow checks on the mock desk: keyboard selection and visible focus, reassignment/403 cache clearing, and the
 * role routing of A1 (redirects, Manager pages, generic Admin refused).
 */

const selectedLead = (page: Page) => new URL(page.url()).searchParams.get("lead");
/** A visible-page refresh: the desk's live hook refetches every read (the same path as a reconnect frame). */
const refreshDesk = (page: Page) => page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

test("keyboard: arrows move between queue rows, Enter selects, focus is visible", async ({ page }) => {
  await signIn(page, "rep");
  await page.goto("/outreach-desk?view=my");
  await waitForDesk(page);
  const rows = page.locator(".od-table--queue tbody tr[data-subject]");
  await expect(rows.first()).toBeVisible();
  await rows.first().focus();
  await page.keyboard.press("ArrowDown");
  await expect(rows.nth(1)).toBeFocused();
  const shadow = await rows.nth(1).evaluate((node) => getComputedStyle(node).boxShadow);
  expect(shadow).not.toBe("none");
  const id = await rows.nth(1).getAttribute("data-subject");
  await page.keyboard.press("Enter");
  await expect.poll(() => selectedLead(page)).toBe(id);
  await expect(rows.nth(1)).toHaveAttribute("aria-selected", "true");
  // Copy job # is a real button the keyboard reaches; a pending Job Number is disabled, never fabricated.
  await expect(page.locator(".od-lead").getByRole("button", { name: /Copy job #/ })).toBeEnabled();
});

test("reassignment: a 404 on the open lead clears it from the queue and drops the selection", async ({ page }) => {
  await signIn(page, "rep");
  await page.goto("/outreach-desk?view=my");
  await waitForDesk(page);
  await expect.poll(() => selectedLead(page)).not.toBeNull();
  const lead = selectedLead(page) as string;
  const jobNo = (await page.locator(".od-lead__job").textContent())?.trim() ?? "";
  // The lead is reassigned on the server: its detail answers 404 and it leaves this Rep's queue.
  await page.route(`${DESK_API}/outreach/${lead}`, (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ ok: false, code: "NOT_FOUND", error: "Not found", request_id: "e2e" }) }),
  );
  await page.route(`${DESK_API}/queue**`, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.rows = body.data.rows.filter((row: { subject_id: string }) => row.subject_id !== lead);
    await route.fulfill({ response, json: body });
  });
  await refreshDesk(page);
  await expect.poll(() => selectedLead(page)).toBeNull();
  await expect(page.locator(`.od-table--queue tr[data-subject="${lead}"]`)).toHaveCount(0);
  await expect(page.locator(".od-lead__job")).toHaveCount(0);
  await expect(page.getByText(jobNo, { exact: true })).toHaveCount(0);
});

test("scope loss: a 403 on capabilities drops every cached desk read and says so", async ({ page }) => {
  await signIn(page, "rep");
  await page.goto("/outreach-desk?view=my");
  await waitForDesk(page);
  await expect(page.locator(".od-table--queue tbody tr[data-subject]").first()).toBeVisible();
  await page.route(`${DESK_API}/**`, (route) =>
    route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ ok: false, code: "FORBIDDEN", error: "Forbidden", request_id: "e2e" }) }),
  );
  await refreshDesk(page);
  await expect(page.getByText("Your account can't open the Outreach Desk.")).toBeVisible();
  await expect(page.locator(".od-table--queue")).toHaveCount(0);
});

test("a Rep that is not linked sees why, not an empty desk", async ({ page }) => {
  await page.route(`${DESK_API}/capabilities**`, (route) =>
    route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ ok: false, code: "REP_NOT_LINKED", error: "Rep not linked", request_id: "e2e" }) }),
  );
  await signIn(page, "rep");
  await page.goto("/outreach-desk?view=my");
  await expect(page.getByText(/isn't linked to a reviewed RingCentral sales extension/)).toBeVisible();
});

test("routing: Rep and Manager homes, old Sales Intelligence links, and no desk for a generic Admin", async ({ page }) => {
  await signIn(page, "rep");
  await page.goto("/sales-intelligence");
  await expect(page).toHaveURL(/\/outreach-desk\?view=my$/);
  await page.goto("/form-leads");
  await expect(page).toHaveURL(/\/outreach-desk\?view=my$/);
  // A Rep can't inspect another rep: the agent parameter is dropped.
  await page.goto(`/outreach-desk?view=my&agent=${SYNTHETIC_AGENTS.jamie.id}`);
  await expect(page).toHaveURL(/\/outreach-desk\?view=my$/);
  await page.context().clearCookies();

  await signIn(page, "manager");
  await page.goto("/form-leads");
  await expect(page).toHaveURL(/\/outreach-desk\?view=team$/);
  await page.goto("/outreach-desk?view=numbers");
  await expect(page).toHaveURL(/\/outreach-desk\?view=team$/);
  // Daily Operations lives on Today → Operations; `/daily` redirects there and a Manager may open it.
  await page.goto("/daily");
  await expect(page).toHaveURL(/\/\?tab=operations$/);
  await page.context().clearCookies();

  await signIn(page, "owner");
  await page.goto("/sales-intelligence?number=65f0000000000000000000cd");
  await expect(page).toHaveURL(/\/outreach-desk\?view=numbers&number=65f0000000000000000000cd$/);
  await page.goto("/sales-intelligence?view=reps");
  await expect(page).toHaveURL(/\/outreach-desk\?view=accounts$/);
  await page.context().clearCookies();

  await signIn(page, "admin");
  const response = await page.request.get("/outreach-desk?view=team", { maxRedirects: 0 });
  expect([307, 308]).toContain(response.status());
  expect(new URL(response.headers().location ?? "", "http://x").pathname).toBe("/");
  const api = await page.request.get("/api/proxy/api/v1/admin/sales-outreach/capabilities");
  expect(api.status()).toBe(403);
  const live = await page.request.get("/api/outreach-desk-live");
  expect(live.status()).toBe(403);
});

test("scroll: the desk scrolls when reached from the Admin dashboard, not only from a deep link", async ({ page }) => {
  await page.setViewportSize({ width: 1186, height: 600 });
  await signIn(page, "owner");
  await page.goto("/?tab=operations");
  // Client-side navigation unmounts the dashboard shell, whose document lock once stripped <body>'s own height.
  await page.locator('a[href="/outreach-desk"]').first().click();
  await page.waitForURL(/\/outreach-desk/);
  await waitForDesk(page);
  await expect(page.locator("body")).toHaveClass(/\bh-full\b/);
  const scroller = page.locator(".od-scroll").first();
  await scroller.hover();
  await page.mouse.wheel(0, 600);
  await expect.poll(() => scroller.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
});

import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { signIn, waitForDesk } from "./helpers";

/**
 * All Numbers and RingCentral Accounts on the mock desk (all-numbers/CONTRACT.md §6): Waiting on us, Link to a lead and
 * Unlink, a stale-revision conflict, Accounts Connect/Change/Disconnect/Suggest/Message, scrolling inside `.od-scroll`
 * (deep link and client-side navigation), and the narrow layout. The mock keeps state, so each test resets it first.
 * Screenshots go next to the other desk evidence.
 */
const EVIDENCE = path.join(process.cwd(), "docs/sales-outreach-desk/workspace/evidence/screenshots");
const NUMBERS_API = "**/api/proxy/api/v1/admin/sales-intelligence";

async function resetMock(page: Page) {
  const response = await page.request.post("/api/proxy/api/v1/admin/sales-intelligence/__mock/reset?scope=production", { data: {} });
  expect(response.ok(), "reset the All Numbers mock").toBe(true);
}

async function openAsOwner(page: Page, query: string) {
  await signIn(page, "owner");
  await resetMock(page);
  await page.goto(`/outreach-desk?${query}`);
  await waitForDesk(page);
}

const numberRow = (page: Page, display: string) => page.locator(".od-table--numbers tbody tr[data-number]", { hasText: display });
const accountRow = (page: Page, extension: string) => page.locator(`.od-table--accounts tr[data-extension="${extension}"]`);

test.beforeAll(() => mkdirSync(EVIDENCE, { recursive: true }));

test("All Numbers: cards, list and the side panel in the desk look", async ({ page }) => {
  await openAsOwner(page, "view=numbers");
  await expect(page.getByRole("heading", { name: "All Numbers", level: 1 })).toBeVisible();
  await expect(page.locator('.od-nav__item[aria-current="page"]')).toHaveText("All Numbers");
  await expect(page.getByTestId("card-waiting")).toContainText("7");
  await expect(page.getByTestId("card-all-numbers")).toContainText("32");
  const rows = page.locator(".od-table--numbers tbody tr[data-number]");
  await expect(rows).toHaveCount(25);
  // An Unknown number and a linked one, with their last call.
  await expect(numberRow(page, "(786) 555-0148")).toContainText("Unknown");
  await expect(numberRow(page, "(512) 555-0142")).toContainText("Taylor Brooks");
  await expect(numberRow(page, "(512) 555-0142")).toContainText("Job P5561042");
  await expect(numberRow(page, "(512) 555-0142")).toContainText("Voicemail");
  await page.screenshot({ path: path.join(EVIDENCE, "all-numbers-owner-1186x742.png") });

  // Keyset paging: Load more appends the rest.
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(rows).toHaveCount(32);
  await expect(page.getByRole("button", { name: "Load more" })).toHaveCount(0);

  // A row opens the panel; the URL carries the open number.
  await numberRow(page, "(512) 555-0142").click();
  const panel = page.getByTestId("number-panel");
  await expect(panel).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("number")).not.toBeNull();
  await expect(panel.getByTestId("number-waiting")).toContainText("Waiting on us for 2 hours");
  await expect(panel.getByTestId("number-lead")).toContainText("Taylor Brooks");
  await expect(panel.getByRole("link", { name: /Open in desk/ })).toHaveAttribute("href", /\/outreach-desk\?view=team&lead=[a-f\d]{24}$/);
  await expect(panel).toContainText("Other leads with this number");
  await expect(panel.getByTestId("number-calls").locator("li")).toHaveCount(3);
  await page.screenshot({ path: path.join(EVIDENCE, "all-numbers-panel-1186x742.png") });
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});

test("Waiting on us: the switch keeps only waiting numbers, longest wait first", async ({ page }) => {
  await openAsOwner(page, "view=numbers");
  await page.getByRole("group", { name: "Show" }).getByRole("button", { name: /Waiting on us/ }).click();
  await expect(page).toHaveURL(/view=numbers&show=waiting/);
  const rows = page.locator(".od-table--numbers tbody tr[data-number]");
  await expect(rows).toHaveCount(7);
  await expect(rows.first()).toContainText("(281) 555-0133");
  await expect(rows.first()).toContainText("3 days");
  for (const row of await rows.all()) await expect(row.locator(".od-wait")).toBeVisible();
  // The search narrows the waiting list (number digits, caller name, lead name or job #).
  await page.getByRole("searchbox", { name: "Search number, name or job #" }).fill("wireless");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/show=waiting&q=wireless/);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("(786) 555-0148");
});

test("open a number → Link to a lead → Unlink", async ({ page }) => {
  await openAsOwner(page, "view=numbers&show=waiting");
  await numberRow(page, "(786) 555-0148").click();
  const panel = page.getByTestId("number-panel");
  await expect(panel.getByTestId("number-lead")).toContainText("Unknown");
  await panel.getByRole("button", { name: "Link to a lead" }).click();
  await panel.getByRole("searchbox", { name: "Search leads by name, job # or phone" }).fill("Noah");
  await expect(panel.getByRole("button", { name: "Link: Noah Fischer" })).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE, "all-numbers-link-picker-1186x742.png") });
  await panel.getByRole("button", { name: "Link: Noah Fischer" }).click();
  await expect(panel.getByRole("status")).toHaveText("Linked to Noah Fischer.");
  await expect(panel.getByTestId("number-lead")).toContainText("Noah Fischer");
  await expect(panel.getByTestId("number-lead")).toContainText("Linked by you");
  // The list row follows.
  await expect(numberRow(page, "(786) 555-0148")).toContainText("Noah Fischer");

  await panel.getByRole("button", { name: "Unlink" }).click();
  await expect(panel.getByRole("status")).toHaveText("Noah Fischer unlinked.");
  await expect(panel.getByTestId("number-lead")).toContainText("Unknown");
  await expect(panel).toContainText("Unlinked leads");
  await expect(numberRow(page, "(786) 555-0148")).toContainText("Unknown");
});

test("a stale revision answers 409: the panel reloads the number and says so", async ({ page }) => {
  await openAsOwner(page, "view=numbers&q=Avery");
  await numberRow(page, "(303) 555-0181").click();
  const panel = page.getByTestId("number-panel");
  await expect(panel.getByTestId("number-lead")).toContainText("Avery Stone");
  await page.route(`${NUMBERS_API}/numbers/*/lead**`, (route) =>
    route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ ok: false, code: "REVISION_CONFLICT", error: "Stale revision", request_id: "e2e" }) }),
  );
  await panel.getByRole("button", { name: "Use this lead" }).click();
  await expect(panel.getByRole("alert")).toContainText("This number changed while you were looking");
});

test("Accounts: Suggest matches, Connect a suggestion, Change, Disconnect and Message", async ({ page }) => {
  await openAsOwner(page, "view=accounts");
  await expect(page.getByRole("heading", { name: "RingCentral Accounts", level: 1 })).toBeVisible();
  await expect(page.locator('.od-nav__item[aria-current="page"]')).toHaveText("Accounts");
  await expect(accountRow(page, "63010101")).toContainText("Alex Morgan");
  await expect(accountRow(page, "63010109")).toContainText("Not in directory");
  await expect(accountRow(page, "63010110")).toContainText("Not connected");
  await page.screenshot({ path: path.join(EVIDENCE, "accounts-owner-1186x742.png") });

  // Suggest matches proposes Robin Hale for the Robin Hale extension.
  await expect(accountRow(page, "63010106").getByRole("button", { name: /Connect Robin Hale/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Suggest matches" }).click();
  await expect(page.getByRole("status")).toHaveText("1 match to review.");
  await expect(accountRow(page, "63010106").getByRole("button", { name: "Connect Robin Hale" })).toBeVisible();

  // One click connects a suggestion.
  await accountRow(page, "63010105").getByRole("button", { name: "Connect Drew Lane" }).click();
  await expect(page.getByRole("status")).toHaveText("Drew Lane is connected to Drew Lane.");
  await expect(accountRow(page, "63010105")).toHaveAttribute("data-connected", "true");
  await expect(accountRow(page, "63010105")).toContainText("Sales rep");

  // Change: another Agent and role.
  await accountRow(page, "63010104").getByRole("button", { name: "Change: Casey Reed" }).click();
  const editor = page.getByRole("form", { name: "Connect Casey Reed to an Agent" });
  await editor.getByLabel("Agent").selectOption({ label: "Morgan Blake" });
  await editor.getByLabel("Role").selectOption({ label: "Manager" });
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Morgan Blake is connected to Casey Reed.");
  await expect(accountRow(page, "63010104")).toContainText("Morgan Blake");
  await expect(accountRow(page, "63010104")).toContainText("Manager");

  // Disconnect asks first.
  await accountRow(page, "63010102").getByRole("button", { name: "Disconnect: Jamie Park" }).click();
  await expect(page.getByText("Disconnect Jamie Park from Jamie Park?")).toBeVisible();
  await page.getByRole("group", { name: "Disconnect" }).getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByRole("status")).toHaveText("Jamie Park is not connected now.");
  await expect(accountRow(page, "63010102")).toHaveAttribute("data-connected", "false");
  await expect(accountRow(page, "63010102")).toContainText("Not connected");

  // Message: preview, then send.
  await accountRow(page, "63010101").getByRole("button", { name: "Message: Alex Morgan" }).click();
  const message = page.getByTestId("message-panel");
  await message.getByLabel("Message", { exact: true }).fill("Please review today's missed callers.");
  await message.getByRole("button", { name: "Preview" }).click();
  await expect(message.getByTestId("message-preview")).toContainText("Please review today's missed callers.");
  await expect(message.getByRole("button", { name: "Send" })).toBeEnabled();
  await page.waitForTimeout(200); // let the button's color transition finish before the evidence shot
  await page.screenshot({ path: path.join(EVIDENCE, "accounts-message-panel-1186x742.png") });
  await message.getByRole("button", { name: "Send" }).click();
  await expect(message.getByRole("status")).toHaveText("Sent.");
});

test("Accounts: a stale link revision answers 409 and the view says so", async ({ page }) => {
  await openAsOwner(page, "view=accounts");
  await page.route(`${NUMBERS_API}/accounts/*/agent**`, (route) =>
    route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ ok: false, code: "REVISION_CONFLICT", error: "Stale revision", request_id: "e2e" }) }),
  );
  await accountRow(page, "63010103").getByRole("button", { name: "Disconnect: Sam Taylor" }).click();
  await page.getByRole("group", { name: "Disconnect" }).getByRole("button", { name: "Disconnect" }).click();
  await expect(page.locator(".od-flash--red")).toContainText("This account changed while you were editing");
});

for (const view of [
  { key: "numbers", label: "All Numbers" },
  { key: "accounts", label: "Accounts" },
] as const) {
  test(`scroll: ${view.label} scrolls inside the desk frame, from a deep link and from the nav`, async ({ page }) => {
    await page.setViewportSize({ width: 1186, height: 600 });
    await openAsOwner(page, `view=${view.key}`);
    const scroller = page.locator(".od-scroll").first();
    await scroller.hover();
    await page.mouse.wheel(0, 600);
    await expect.poll(() => scroller.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);

    // Client-side navigation from the dashboard into the view (the path that once left <body> without a height).
    await page.goto("/daily");
    await page.locator('a[href="/outreach-desk"]').first().click();
    await page.waitForURL(/\/outreach-desk/);
    await waitForDesk(page);
    await page.locator(`.od-nav__item[data-view="${view.key}"]`).click();
    await page.waitForURL(new RegExp(`view=${view.key}`));
    await waitForDesk(page);
    const again = page.locator(".od-scroll").first();
    await again.hover();
    await page.mouse.wheel(0, 600);
    await expect.poll(() => again.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  });
}

test("narrow: no sideways page scroll at 820 px; on a phone the tables stack and the panel takes the width", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 900 });
  await openAsOwner(page, "view=numbers");
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);
  await expect(page.locator(".od-mobilebar")).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE, "all-numbers-narrow-820.png") });
  await numberRow(page, "(512) 555-0142").click();
  await expect(page.getByTestId("number-panel")).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/outreach-desk?view=numbers");
  await waitForDesk(page);
  expect(await overflow()).toBeLessThanOrEqual(0);
  await expect(page.locator(".od-table--numbers thead")).toBeHidden();
  await page.screenshot({ path: path.join(EVIDENCE, "all-numbers-phone-390.png") });
  await numberRow(page, "(512) 555-0142").click();
  await expect(page.getByTestId("number-panel")).toBeVisible();
  const box = await page.locator(".od-drawer").boundingBox();
  expect(Math.round(box?.width ?? 0)).toBe(390);
  expect(await overflow()).toBeLessThanOrEqual(0);

  await page.goto("/outreach-desk?view=accounts");
  await waitForDesk(page);
  expect(await overflow()).toBeLessThanOrEqual(0);
  await expect(page.locator(".od-table--accounts thead")).toBeHidden();
  await page.screenshot({ path: path.join(EVIDENCE, "accounts-phone-390.png") });
});

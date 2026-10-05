import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { signIn, waitForDesk } from "./helpers";

/**
 * V01/V02 visual checks (ADM-8): the Team desk (Owner and Manager) and the Rep desk render at the reference size
 * (1186 × 742) on the synthetic mock and are saved next to the references for side-by-side comparison. Structural
 * assertions guard the bubbly token set: pale blue page, white 12 px+ rounded cards, circular icon badges, pill
 * tracks, the selected nav pill and the selected-row tint — and that the flat Admin dashboard chrome is absent.
 */
const EVIDENCE = path.join(process.cwd(), "docs/sales-outreach-desk/workspace/evidence/screenshots");
const REFERENCES = path.join(process.cwd(), "docs/sales-outreach-desk/references");

async function sideBySide(page: Page, reference: string, shot: string, out: string, title: string) {
  const ref = readFileSync(path.join(REFERENCES, reference)).toString("base64");
  const ours = readFileSync(shot).toString("base64");
  const compare = await page.context().newPage();
  await compare.setViewportSize({ width: 2400, height: 820 });
  await compare.setContent(`<!doctype html><html><body style="margin:0;background:#1d2433;font:14px system-ui;color:#fff">
    <div style="display:flex;gap:16px;padding:12px">
      <figure style="margin:0"><figcaption style="padding:0 0 6px">Reference — ${reference}</figcaption><img src="data:image/webp;base64,${ref}" width="1186" height="742"></figure>
      <figure style="margin:0"><figcaption style="padding:0 0 6px">Built — ${title}</figcaption><img src="data:image/png;base64,${ours}" width="1186" height="742"></figure>
    </div></body></html>`);
  await compare.screenshot({ path: out, fullPage: true });
  await compare.close();
}

async function expectBubblyTokens(page: Page) {
  const root = page.locator(".od-root");
  await expect(root).toHaveCSS("background-color", "rgb(244, 247, 252)");
  const card = page.locator(".od-card").first();
  const radius = await card.evaluate((node) => Number.parseFloat(getComputedStyle(node).borderTopLeftRadius));
  expect(radius).toBeGreaterThanOrEqual(12);
  await expect(card).toHaveCSS("background-color", "rgb(255, 255, 255)");
  const navPill = page.locator('.od-nav__item[aria-current="page"]');
  await expect(navPill).toHaveCSS("background-color", "rgb(234, 242, 254)");
  const pillRadius = await navPill.evaluate((node) => Number.parseFloat(getComputedStyle(node).borderTopLeftRadius));
  expect(pillRadius).toBeGreaterThanOrEqual(8);
  // The flat Admin dashboard chrome (its sidebar nav and header) is not on the desk.
  await expect(page.locator('nav[aria-label="Dashboard"]')).toHaveCount(0);
}

test.beforeAll(() => mkdirSync(EVIDENCE, { recursive: true }));

test("Team desk (Owner) matches the manager reference composition", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto("/outreach-desk?view=team");
  await waitForDesk(page);
  await expect(page.getByRole("heading", { name: "Team outreach" })).toBeVisible();
  await expect(page.getByText("Thursday, Oct 1")).toBeVisible();
  // Four summary cards with circular badges and pill tracks.
  for (const id of ["card-outbound", "card-reps-at-goal", "card-overdue", "card-quoted"]) await expect(page.getByTestId(id)).toBeVisible();
  await expect(page.getByTestId("card-outbound")).toContainText("277 / 400");
  await expect(page.getByTestId("card-reps-at-goal")).toContainText("1 / 4");
  const badge = page.locator(".od-summary .od-badge").first();
  await expect(badge).toHaveCSS("border-top-left-radius", "50%");
  // Daily call goals: 108/100 capped with Goal reached and 0 remaining; a zero-goal rep says so.
  const goals = page.getByTestId("daily-call-goals");
  await expect(goals.getByRole("row", { name: /Jamie Park/ })).toContainText("108 / 100");
  await expect(goals.getByRole("row", { name: /Jamie Park/ })).toContainText("Goal reached");
  await expect(goals.getByRole("row", { name: /Drew Lane/ })).toContainText("No goal today");
  await expect(goals.getByRole("progressbar").first()).toBeVisible();
  await expect(page.getByTestId("leads-needing-attention")).toContainText("P5561042");
  await expectBubblyTokens(page);
  const shot = path.join(EVIDENCE, "team-owner-1186x742.png");
  await page.screenshot({ path: shot });
  await sideBySide(page, "manager-desk.webp", shot, path.join(EVIDENCE, "compare-team-owner.png"), "Team outreach (Owner)");
});

test("Team desk (Manager) is the same desk without Owner-only options (V02)", async ({ page }) => {
  await signIn(page, "manager");
  await page.goto("/outreach-desk");
  await expect(page).toHaveURL(/view=team/);
  await waitForDesk(page);
  await expect(page.getByRole("heading", { name: "Team outreach" })).toBeVisible();
  await expect(page.locator('.od-nav__item[data-view="numbers"]')).toHaveCount(0);
  await expect(page.locator('.od-nav__item[data-view="accounts"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Admin dashboard" })).toHaveCount(0);
  await expectBubblyTokens(page);
  const shot = path.join(EVIDENCE, "team-manager-1186x742.png");
  await page.screenshot({ path: shot });
  await sideBySide(page, "manager-desk.webp", shot, path.join(EVIDENCE, "compare-team-manager.png"), "Team outreach (Manager)");
});

test("My desk (Rep) matches the sales-rep reference composition", async ({ page }) => {
  await signIn(page, "rep");
  await page.goto("/outreach-desk");
  await expect(page).toHaveURL(/view=my/);
  await waitForDesk(page);
  await expect(page.getByRole("heading", { name: "My outreach" })).toBeVisible();
  await expect(page.getByTestId("goal-card")).toContainText("64");
  await expect(page.getByTestId("goal-card")).toContainText("/ 100");
  await expect(page.getByRole("tab", { name: "New leads" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "Needs contact" })).toHaveAttribute("aria-pressed", "true");
  // The first row is selected (tinted) and its panel is open.
  const selected = page.locator('.od-table--queue tr[aria-selected="true"]');
  await expect(selected).toHaveCount(1);
  await expect(selected.locator("td").first()).toHaveCSS("background-color", "rgb(238, 244, 254)");
  await expect(page.locator(".od-lead__job")).toBeVisible();
  await expect(page.getByRole("button", { name: /Copy job #/ }).first()).toBeVisible();
  // A Rep has no team frame, no rep filter and no Unassigned.
  await expect(page.locator('.od-nav__item[data-view="team"]')).toHaveCount(0);
  await expectBubblyTokens(page);
  const shot = path.join(EVIDENCE, "my-rep-1186x742.png");
  await page.screenshot({ path: shot });
  await sideBySide(page, "sales-rep-desk.webp", shot, path.join(EVIDENCE, "compare-my-rep.png"), "My outreach (Rep)");
});

test("narrow layout keeps the goal above the queue and stacks the lead panel", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 900 });
  await signIn(page, "rep");
  await page.goto("/outreach-desk?view=my");
  await waitForDesk(page);
  const goal = await page.getByTestId("goal-card").boundingBox();
  const queue = await page.getByTestId("queue").boundingBox();
  expect(goal && queue && goal.y < queue.y).toBe(true);
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE, "my-rep-820-narrow.png"), fullPage: true });
});

test("Activity, Settings and the Team lead drawer render for each role", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto("/outreach-desk?view=settings");
  await waitForDesk(page);
  for (const id of ["settings-controls", "settings-roster", "settings-closures", "settings-attendance", "settings-restrictions", "settings-enrollment"]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  await page.screenshot({ path: path.join(EVIDENCE, "settings-owner.png"), fullPage: true });
  await page.goto("/outreach-desk?view=activity");
  await waitForDesk(page);
  await page.locator(".od-table tbody tr[data-selectable]").first().click();
  await expect(page.getByRole("heading", { name: "Contact history" })).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE, "activity-owner.png") });
  await page.goto("/outreach-desk?view=team");
  await waitForDesk(page);
  await page.getByTestId("leads-needing-attention").locator("tbody tr[data-selectable]").first().click();
  await expect(page.locator(".od-drawer .od-lead__job")).toBeVisible();
  await expect(page.locator(".od-drawer").getByLabel("Assigned rep")).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE, "team-owner-lead-drawer.png") });
  await page.context().clearCookies();

  await signIn(page, "manager");
  await page.goto("/outreach-desk?view=settings");
  await waitForDesk(page);
  await expect(page.getByTestId("settings-attendance")).toBeVisible();
  await expect(page.getByTestId("settings-controls")).toHaveCount(0);
  await expect(page.getByTestId("settings-restrictions")).toHaveCount(0);
  await page.screenshot({ path: path.join(EVIDENCE, "settings-manager.png") });
});

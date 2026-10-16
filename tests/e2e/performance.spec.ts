import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { signIn, waitForDesk, DESK_API } from "./helpers";
import { shiftPerformanceDate } from "../../components/outreach-desk/lib/performance";
import { salesOutreachPerformanceSchema } from "../../lib/api/salesOutreach";

const EVIDENCE = path.join(process.cwd(), "docs/outreach-performance/evidence");
function report(start: string) {
  return salesOutreachPerformanceSchema.parse({
    week: { start, end_exclusive: shiftPerformanceDate(start, 7), through: start === "2026-09-28" ? "2026-10-01" : shiftPerformanceDate(start, 6), timezone: "America/New_York" },
    as_of: "2026-10-01T16:00:00.000Z", earliest_reliable_dates: { calls: "2026-09-01", text_volume: "2026-09-14", text_requirements: "2026-09-28" },
    channel_freshness: { calls: "2026-10-01T15:58:00.000Z", texts: "2026-10-01T15:55:00.000Z" }, provisional: { calls: false, texts: true },
    rows: ["Alex Morgan", "Jamie Park"].map((name, i) => ({ agent_id: `6650a1b2c3d4e5f60718000${i+1}`, name, historical_membership_state: "active", calls: { rank: i+1, weekly_volume: i ? 300 : 486, met_days: i ? 2 : 3, eligible_days: 3, pending_days: 0, completion_rate: i ? 2/3 : 1, provisional: false }, texts: { rank: 2-i, weekly_volume: i ? 80 : 62, on_time_required: i ? 18 : 12, resolved_due_required: 20, pending_requirements: 2, completion_rate: i ? .9 : .6, provisional: true },
      days: Array.from({ length: 7 }, (_, day) => ({ business_date: shiftPerformanceDate(start, day), future: start === "2026-09-28" && day > 3, calls: { actual: day > 3 ? start === "2026-09-28" ? null : 0 : day === 3 ? 62 : i ? [100, 100, 38][day] : [200, 124, 100][day], goal: day > 3 || start !== "2026-09-28" && day === 3 ? 0 : 100, state: day > 3 ? start === "2026-09-28" ? "upcoming" : "no_goal" : day === 3 ? start === "2026-09-28" ? "in_progress" : "no_goal" : i && day === 2 ? "not_met" : "met", coverage: "complete" }, texts: { sent: 12, on_time_required: 4, resolved_due_required: 4, applicable_required: 6, pending: 2, state: start === "2026-09-28" && day === 3 ? "in_progress" : "pending_data", coverage: "partial" } })) })), unassigned: { required_text_counts: 3 },
  });
}
class PerformancePage {
  constructor(readonly page: Page) {}
  get card() { return this.page.getByTestId("rep-performance"); }
  async open() {
    await this.page.route(`${DESK_API}/performance?*`, route => route.fulfill({ json: { ok: true, data: report(new URL(route.request().url()).searchParams.get("week_start")!) } }));
    await signIn(this.page, "manager");
    await this.page.goto("/outreach-desk?view=team");
    await waitForDesk(this.page);
    await expect(this.card).toContainText("486");
    await this.card.scrollIntoViewIfNeeded();
  }
  async capture(file: string) {
    const viewport = this.page.viewportSize()!;
    const height = Math.ceil((await this.card.boundingBox())!.height) + 260;
    await this.page.setViewportSize({ width: viewport.width, height: Math.max(viewport.height, height) });
    await this.card.scrollIntoViewIfNeeded();
    await this.card.screenshot({ path: path.join(EVIDENCE, file) });
    await this.page.setViewportSize(viewport);
  }
}
test.beforeAll(() => mkdirSync(EVIDENCE, { recursive: true }));
test("Manager performance preserves daily expansion across channels, ranks independently and browses history", async ({ page }) => {
  const view = new PerformancePage(page); await view.open();
  await expect(view.card.getByRole("columnheader", { name: "Today", exact: true })).toBeVisible();
  await expect(view.card.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await view.card.getByRole("button", { name: "Show daily performance for Alex Morgan" }).click();
  await expect(view.card.getByRole("table", { name: "Alex Morgan daily calls" })).toBeVisible();
  await view.capture("performance-desktop-calls.png");
  await view.card.getByRole("tab", { name: "Texts", exact: true }).click();
  await expect(view.card.getByRole("table", { name: "Alex Morgan daily texts" })).toBeVisible();
  await expect(view.card).toContainText("18/20 required");
  await view.capture("performance-desktop-texts.png");
  await view.card.getByRole("tab", { name: "Texts", exact: true }).press("ArrowLeft");
  await expect(view.card.getByRole("tab", { name: "Calls", exact: true })).toBeFocused();
  await view.card.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(view.card.getByRole("columnheader", { name: "Today", exact: true })).toHaveCount(0);
  await expect(view.card).toContainText("Sep 21");
  await view.capture("performance-desktop-history.png");
  await view.card.getByRole("button", { name: "This week", exact: true }).click();
  await expect(view.card.getByRole("columnheader", { name: "Today", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await view.card.scrollIntoViewIfNeeded();
  await view.capture("performance-narrow-calls.png");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await view.card.getByRole("tab", { name: "Texts", exact: true }).click();
  await view.capture("performance-narrow-texts.png");
  const tableScroll = view.card.locator(".od-table-wrap");
  expect(await tableScroll.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
  await tableScroll.evaluate(node => { node.scrollLeft = node.scrollWidth; });
  await view.capture("performance-narrow-texts-right.png");
});

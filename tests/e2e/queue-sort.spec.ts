import { expect, test } from "@playwright/test";
import { DESK_API, signIn, waitForDesk } from "./helpers";

for (const scenario of [
  { user: "rep" as const, view: "my" },
  { user: "owner" as const, view: "my" },
  { user: "owner" as const, view: "team" },
]) {
  test(`${scenario.user} ${scenario.view}: Lead Received defaults newest-first and the compact guide precedes the list`, async ({ page }) => {
    await signIn(page, scenario.user);
    const queueRequest = page.waitForRequest((request) => request.url().includes("/sales-outreach/queue?"));
    await page.goto(`/outreach-desk?view=${scenario.view}`);
    const requested = new URL((await queueRequest).url());
    expect(requested.searchParams.get("sort")).toBe("lead_received");
    expect(requested.searchParams.get("direction")).toBe("desc");
    await waitForDesk(page);
    const guide = page.getByRole("complementary", { name: "Sort options" });
    await expect(guide).toBeVisible();
    await expect(guide).toContainText("Over 60% close within 2 days");
    await expect(guide).toContainText("Earliest outstanding contact deadlines first");
    await expect(guide).toContainText("leads without a date stay at the bottom");
    if (scenario.view === "my") {
      const sort = page.getByLabel("Sort queue");
      await expect(sort).toHaveValue("lead_received");
      const overdue = page.waitForRequest(`${DESK_API}/queue**`);
      await sort.selectOption("urgency");
      expect(new URL((await overdue).url()).searchParams.get("sort") ?? "urgency").toBe("urgency");
      await expect(sort).toHaveValue("urgency");
      await sort.selectOption("lead_received");
      await expect(sort).toHaveValue("lead_received");
      await expect.poll(() => new URL(page.url()).searchParams.get("sort")).toBeNull();
    }
    if (scenario.user === "rep") {
      await guide.screenshot({ path: "test-results/sort-guide-desktop.png" });
      await page.setViewportSize({ width: 390, height: 844 });
      await guide.scrollIntoViewIfNeeded();
      const box = await guide.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(390);
      await guide.screenshot({ path: "test-results/sort-guide-mobile.png" });
    }
  });
}

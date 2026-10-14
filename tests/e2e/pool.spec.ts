import { expect, test } from "@playwright/test";
import { mockSalesOutreachResponse } from "../../lib/api/salesOutreachMock";
import { SYNTHETIC_AGENTS, SYNTHETIC_AS_OF, syntheticDetail, syntheticQueueRows } from "../outreach-desk/fixtures/synthetic";
import type { SalesOutreachPoolDto } from "../../lib/api/salesOutreach";
import { DESK_API, signIn } from "./helpers";
import { PoolPage } from "./pages/pool.page";

test("Pool shows foreign assignment, resnapshots teammate completion, and evicts revoked detail", async ({ page }) => {
  let completed = false;
  let revoked = false;
  const row = { ...syntheticQueueRows()[0]!, assigned_agent_id: SYNTHETIC_AGENTS.sam.id, assigned_agent_name: "Sam Taylor", priority_raw: "9" };
  const duty = (): SalesOutreachPoolDto => ({
    business_date: "2026-10-01", state: completed ? "completed" : "due", due_at: "2026-10-02T00:00:00.000Z",
    completed_at: completed ? SYNTHETIC_AS_OF : null,
    completed_by_agent_id: completed ? SYNTHETIC_AGENTS.sam.id : null,
    completed_by_agent_name: completed ? "Sam Taylor" : null,
    completion_event_id: completed ? "6650a1b2c3d4e5f607199001" : null,
  });
  await page.clock.install();
  await page.route(`${DESK_API}/queue**`, async (route) => {
    const scope = new URL(route.request().url()).searchParams.get("queue_scope");
    if (scope !== "pool") return route.continue();
    const response = mockSalesOutreachResponse({ role: "owner", method: "GET", path: "queue" });
    const body = response.body as { data: Record<string, unknown> };
    body.data.rows = revoked ? [] : [{ ...row, pool: duty() }];
    body.data.next_cursor = null;
    body.data.has_more = false;
    body.data.pool_summary = { team_due: completed ? 0 : 1, team_completed: completed ? 1 : 0, assigned_due: 0, assigned_completed: 0, actual_outbound: 0 };
    await route.fulfill({ json: body });
  });
  await page.route(`${DESK_API}/outreach/${row.subject_id}`, async (route) => {
    if (revoked) return route.fulfill({ status: 404, json: { ok: false, code: "NOT_FOUND", error: "Not found" } });
    const detail = syntheticDetail({ subjectId: row.subject_id, role: "rep" })!;
    await route.fulfill({ json: { ok: true, data: { ...detail, pool: duty(), assignment: { ...detail.assignment, assigned_agent_id: row.assigned_agent_id, assigned_agent_name: row.assigned_agent_name } } } });
  });
  await signIn(page, "rep");
  const poolPage = new PoolPage(page);
  await poolPage.open();
  for (const name of ["New", "Quoted", "Other", "Pool"]) await expect(poolPage.tab(name)).toBeVisible();
  await expect(poolPage.tab("Pool")).toHaveAttribute("aria-selected", "true");
  await expect(poolPage.rows).toContainText("Assigned to Sam Taylor");
  await expect(poolPage.detail).toContainText("1 shared call due");
  await expect(poolPage.detail.getByRole("button", { name: "Schedule a callback" })).toHaveCount(0);
  completed = true;
  await poolPage.nextSnapshot();
  await expect(poolPage.rows).toContainText("Shared call completed");
  await expect(poolPage.detail).toContainText("Shared call completed");
  await expect(poolPage.workload).toContainText("0 due · 1 completed for the team");
  await expect(poolPage.workload).toContainText("Actual Pool outbound calls: 0");
  revoked = true;
  await poolPage.nextSnapshot();
  await expect(poolPage.rows).toHaveCount(0);
  await expect(page.getByText("Assigned to Sam Taylor")).toHaveCount(0);
  await expect(page).not.toHaveURL(new RegExp(`lead=${row.subject_id}`));
});

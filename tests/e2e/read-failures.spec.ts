import { expect, test, type Page, type Route } from "@playwright/test";
import { DESK_API, signIn } from "./helpers";

/**
 * Lifecycle repair ADM-0 on the mock desk: a desk read that fails inside a view is said in words (never skeletons
 * that do not resolve), and a read carrying enum values this admin does not know yet still renders.
 */

const SERVER_ERROR = { status: 500, contentType: "application/json", body: JSON.stringify({ ok: false, code: "INTERNAL", error: "Internal", request_id: "e2e" }) };

/** Rewrites the mock's JSON answer for a read before the desk sees it. */
const rewrite = (edit: (data: Record<string, unknown>) => void) => async (route: Route) => {
  const response = await route.fetch();
  const body = await response.json();
  edit(body.data);
  await route.fulfill({ response, json: body });
};

const skeletons = (page: Page) => page.locator(".od-main .od-skeleton");

test("Team: a failed GET /team says so in place of the cards and tables (no endless skeletons)", async ({ page }) => {
  await page.route(`${DESK_API}/team**`, (route) => route.fulfill(SERVER_ERROR));
  await signIn(page, "owner");
  await page.goto("/outreach-desk?view=team");
  const failure = page.getByTestId("team-read-error");
  await expect(failure).toContainText("Team goals and lead counts couldn't load.");
  await expect(failure.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(skeletons(page)).toHaveCount(0);
  await expect(page.getByTestId("card-outbound")).toContainText("Unavailable");
});

test("Team: a body this admin can't read is named as a version mismatch, at once", async ({ page }) => {
  await page.route(`${DESK_API}/team**`, rewrite((data) => void (data.daily_call_goals = "not a list")));
  await signIn(page, "manager");
  await page.goto("/outreach-desk?view=team");
  await expect(page.getByTestId("team-read-error")).toContainText("doesn't understand yet");
  await expect(skeletons(page)).toHaveCount(0);
});

test("My: a failed GET /rep-days says so in the goal card; a failed queue is not an empty list", async ({ page }) => {
  await page.route(`${DESK_API}/rep-days**`, (route) => route.fulfill(SERVER_ERROR));
  await page.route(`${DESK_API}/queue**`, rewrite((data) => void (data.rows = "not a list")));
  await signIn(page, "rep");
  await page.goto("/outreach-desk?view=my");
  await expect(page.getByTestId("goal-read-error")).toContainText("This goal couldn't load.");
  await expect(page.getByTestId("queue-read-error")).toContainText("The lead list couldn't load.");
  await expect(page.getByText("Nothing needs contact right now.")).toHaveCount(0);
  await expect(skeletons(page)).toHaveCount(0);
});

test("My: new server enum values in rep-days and the queue still render (tolerant reads)", async ({ page }) => {
  await page.route(
    `${DESK_API}/queue**`,
    rewrite((data) => {
      for (const row of data.rows as Record<string, Record<string, unknown>>[]) {
        row.call!.status = "awaiting_capture";
        (row.call!.coverage as Record<string, unknown>).state = "catching_up";
      }
      (data.freshness as Record<string, Record<string, unknown>>).calls!.state = "confirmation_stale";
    }),
  );
  await page.route(
    `${DESK_API}/rep-days**`,
    rewrite((data) => {
      for (const rep of (data.reps ?? []) as Record<string, Record<string, unknown>>[]) {
        rep.coverage!.state = "catching_up";
        rep.overdue_leads = { value: null, unknown_reason: "coverage_wait" };
      }
    }),
  );
  await signIn(page, "rep");
  await page.goto("/outreach-desk?view=my");
  await expect(page.locator(".od-table--queue tbody tr[data-subject]").first()).toBeVisible();
  await expect(page.getByTestId("goal-card")).toBeVisible();
  await expect(page.getByTestId("goal-read-error")).toHaveCount(0);
  await expect(page.getByTestId("queue-read-error")).toHaveCount(0);
  await expect(skeletons(page)).toHaveCount(0);
});

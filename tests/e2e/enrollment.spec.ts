import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { DESK_API, signIn, waitForDesk } from "./helpers";
import { SYNTHETIC_ADMITTED_ROW, syntheticEnrollmentCandidates, syntheticSubjectId } from "../outreach-desk/fixtures/synthetic";

/**
 * Lifecycle repair ADM-4 on the mock desk (today = 2026-10-01): the Owner's enrollment lists in Settings — "Ready to
 * enroll" and "Older" with a one-click Enroll, a read-only "Needs review" with the reason in words, Load more over the
 * opaque `next_cursor` — the day's new-lead intake (`GET /enrollment/admissions`) and the `admission:` cohort line in
 * the lead panel. Server codes never show.
 */

const EVIDENCE = path.join(process.cwd(), "docs", "sales-outreach-desk", "workspace", "evidence", "screenshots");
const SNAKE = /\b[a-z]+_[a-z_]+\b/;

async function openSettings(page: Page) {
  await signIn(page, "owner");
  await page.goto("/outreach-desk?view=settings");
  await waitForDesk(page);
  await expect(page.getByTestId("settings-enrollment")).toBeVisible();
}

test("Owner: Ready to enroll lists the in-scope leads with Enroll; Needs review is read-only with the reason in words", async ({ page }) => {
  await openSettings(page);
  const panel = page.getByTestId("settings-enrollment");
  await expect(panel.getByRole("tab", { name: "Ready to enroll" })).toHaveAttribute("aria-selected", "true");
  const ready = panel.getByTestId("enrollment-list-in_scope");
  await expect(ready.locator("tbody tr")).toHaveCount(3);
  await expect(ready.locator("tbody tr").first()).toContainText("P5550101");
  await expect(ready.locator("tbody tr").first()).toContainText("Received recently");
  await expect(ready.locator("tbody tr").nth(2)).toContainText("Upcoming move");
  await expect(ready.getByRole("button", { name: "Enroll" })).toHaveCount(3);
  await expect(panel.getByTestId("enrollment-hint")).toHaveText("Eligible and not on the desk yet: received in the last 90 days, or moving from today on.");
  await expect(panel.getByRole("button", { name: "Load more" })).toHaveCount(0);

  // One-click Enroll: the mock's migration is paused, so the refusal reads by code.
  const [report] = await Promise.all([page.waitForRequest((request) => request.method() === "POST" && /\/enrollment\/report$/.test(request.url())), ready.getByRole("button", { name: "Enroll" }).first().click()]);
  const body = report.postDataJSON() as { selection: { mode: string; lead_refs: unknown[] }; kind: string; cohort_id: string };
  expect(body.selection).toEqual({ mode: "selected", lead_refs: [{ model: "FormLead", id: syntheticSubjectId(1101) }] });
  expect(body.cohort_id).toMatch(/^owner-enroll-\d{4}-\d{2}-\d{2}$/);
  await expect(panel.getByRole("alert")).toHaveText("Enrollment is paused in the configuration (migration paused).");

  await panel.getByRole("tab", { name: "Older" }).click();
  const older = panel.getByTestId("enrollment-list-older");
  await expect(older.locator("tbody tr")).toHaveCount(2);
  await expect(older.getByRole("button", { name: "Enroll" })).toHaveCount(2);
  await expect(panel.getByTestId("enrollment-hint")).toHaveText("Not enrolled — older than 90 days, with no upcoming move.");

  await panel.getByRole("tab", { name: "Needs review" }).click();
  const review = panel.getByTestId("enrollment-list-review");
  await expect(review.locator("tbody tr")).toHaveCount(1);
  await expect(review.locator("tbody tr").first()).toContainText("Needs review: the time this lead came in is missing");
  await expect(review.getByRole("button")).toHaveCount(0);
  await expect(review.locator("th")).toHaveCount(4);
  expect(await panel.innerText()).not.toMatch(SNAKE);
  await panel.screenshot({ path: path.join(EVIDENCE, "adm4-enrollment-review.png") });
});

test("Owner: Load more follows next_cursor; an expired cursor reloads the list from the top and says so", async ({ page }) => {
  const first = { ...syntheticEnrollmentCandidates("in_scope", { limit: 2 }), next_cursor: "opaque-page-2" };
  const second = syntheticEnrollmentCandidates("in_scope", { offset: 2, limit: 2 });
  let expire = false;
  await page.route(`${DESK_API}/enrollment/candidates**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("partition") !== "in_scope") return route.fallback();
    if (!url.searchParams.get("cursor")) return route.fulfill({ json: { ok: true, data: first } });
    if (expire) return route.fulfill({ status: 409, json: { ok: false, code: "CURSOR_EXPIRED", error: "x", issues: [{ path: "cursor", code: "invalid" }] } });
    expect(url.searchParams.get("cursor")).toBe("opaque-page-2");
    return route.fulfill({ json: { ok: true, data: second } });
  });
  await openSettings(page);
  const panel = page.getByTestId("settings-enrollment");
  const ready = panel.getByTestId("enrollment-list-in_scope");
  await expect(ready.locator("tbody tr")).toHaveCount(2);
  await expect(panel.getByText("2 leads shown")).toBeVisible();
  await panel.getByRole("button", { name: "Load more" }).click();
  await expect(ready.locator("tbody tr")).toHaveCount(3);
  await expect(panel.getByRole("button", { name: "Load more" })).toHaveCount(0);

  // The list changes under the cursor: page one again, with a note.
  expire = true;
  await page.reload();
  await waitForDesk(page);
  await expect(ready.locator("tbody tr")).toHaveCount(2);
  await panel.getByRole("button", { name: "Load more" }).click();
  await expect(panel.getByText("The list changed while you were paging, so it was reloaded from the top.")).toBeVisible();
  await expect(ready.locator("tbody tr")).toHaveCount(2);
});

test("Owner: a page with no rows but a cursor keeps looking; 'none' shows only when the server is done or the bound is hit", async ({ page }) => {
  // The server checks at most 1,000 Leads a page, so pages can come back empty with a cursor (LEDGER OPS-2: the
  // ready Leads sit near the end of the walk; older = 0 across tens of thousands of Leads).
  const empty = (partition: "in_scope" | "older", cursor: string | null) => ({ ...syntheticEnrollmentCandidates(partition), items: [], next_cursor: cursor, scanned: 1000 });
  const olderCalls: string[] = [];
  await page.route(`${DESK_API}/enrollment/candidates**`, async (route) => {
    const url = new URL(route.request().url());
    const partition = url.searchParams.get("partition");
    const cursor = url.searchParams.get("cursor");
    if (partition === "in_scope") {
      if (!cursor) return route.fulfill({ json: { ok: true, data: empty("in_scope", "ready-2") } });
      if (cursor === "ready-2") return route.fulfill({ json: { ok: true, data: empty("in_scope", "ready-3") } });
      return route.fulfill({ json: { ok: true, data: { ...syntheticEnrollmentCandidates("in_scope"), next_cursor: null } } });
    }
    if (partition === "older") {
      olderCalls.push(cursor ?? "");
      // Page n answers the cursor older-n (page 1 has none): thirteen empty pages, then the end of the walk.
      const n = cursor ? Number(cursor.slice("older-".length)) : 1;
      return route.fulfill({ json: { ok: true, data: empty("older", n < 13 ? `older-${n + 1}` : null) } });
    }
    return route.fallback();
  });
  await openSettings(page);
  const panel = page.getByTestId("settings-enrollment");
  const ready = panel.getByTestId("enrollment-list-in_scope");
  // Two empty pages, then the rows: they show without a click, and the empty text never claims there are none.
  await expect(ready.locator("tbody tr[data-lead]")).toHaveCount(3);
  await expect(panel).not.toContainText("No leads are waiting to be enrolled.");
  await expect(panel.getByRole("button", { name: "Load more" })).toHaveCount(0);

  await panel.getByRole("tab", { name: "Older" }).click();
  const empty10 = panel.getByTestId("enrollment-empty");
  await expect(empty10).toHaveText("None found in the first 10,000 leads checked. Load more to keep looking.");
  // Distinct pages (a dev-mode remount may ask for page one twice).
  expect(new Set(olderCalls).size).toBe(10);
  await panel.getByRole("button", { name: "Load more" }).click();
  // The walk ends on page 13: now the server has nothing left to check, and only now does the list say "none".
  await expect(empty10).toHaveText("No older eligible leads.");
  expect(new Set(olderCalls).size).toBe(13);
  await expect(panel.getByRole("button", { name: "Load more" })).toHaveCount(0);
});

test("Owner: the day's new-lead intake reads counts and refusals in words; an old day says the retention", async ({ page }) => {
  await openSettings(page);
  const panel = page.getByTestId("settings-admissions");
  await expect(panel.getByRole("heading", { name: "New-lead intake" })).toBeVisible();
  const counts = panel.getByTestId("admissions-counts");
  await expect(counts.locator('[data-key="admitted_intake"]')).toContainText("6");
  await expect(counts.locator('[data-key="admitted_intake"]')).toContainText("Added to the desk");
  await expect(counts.locator('[data-key="not_admitted"]')).toContainText("6");
  await expect(panel.getByTestId("admissions-by-reason").locator("li").first()).toHaveText("2 · Marked as a duplicate lead");
  const refusals = panel.getByTestId("admissions-refusals").locator("tbody tr");
  await expect(refusals).toHaveCount(6);
  await expect(refusals.first()).toContainText("Form lead");
  await expect(refusals.first()).toContainText("Marked as a duplicate lead");
  await expect(refusals.nth(1)).toContainText("Already booked");
  // An olr B6 automatic-admission refusal reads apart from the intake refusals.
  await expect(refusals.nth(5)).toContainText("Automatic admission — outside the backfill window");
  await expect(panel.getByTestId("admissions-by-reason")).toContainText("1 · Automatic admission — outside the backfill window");
  expect(await panel.innerText()).not.toMatch(SNAKE);
  expect(await panel.innerText()).not.toContain("excluded:");
  expect(await panel.innerText()).not.toContain("expansion:");
  await panel.screenshot({ path: path.join(EVIDENCE, "adm4-admissions-today.png") });

  const [request] = await Promise.all([
    page.waitForRequest((candidate) => /\/enrollment\/admissions\?business_day=2026-09-25$/.test(candidate.url())),
    panel.getByTestId("admissions-day").fill("2026-09-25"),
  ]);
  expect(request.method()).toBe("GET");
  await expect(panel.getByTestId("admissions-refusals")).toContainText("No new lead was refused this day.");
  await panel.getByTestId("admissions-day").fill("2026-09-10");
  await expect(panel.getByTestId("admissions-error")).toHaveText("Only the last 14 days are kept. Choose a later day.");
  await panel.getByRole("button", { name: "Today" }).click();
  await expect(panel.getByTestId("admissions-refusals").locator("tbody tr")).toHaveCount(6);
});

test("Owner: the lead panel says a lead was added by automatic admission; the cohort id never shows", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto(`/outreach-desk?view=team&lead=${syntheticSubjectId(SYNTHETIC_ADMITTED_ROW)}`);
  const panel = page.locator(".od-lead");
  await expect(panel.getByTestId("lead-enrollment")).toHaveText("Added automatically on Sep 28, when it became eligible (automatic admission)");
  await expect(panel).not.toContainText("admission:");
  await page.goto(`/outreach-desk?view=team&lead=${syntheticSubjectId(1)}`);
  await expect(page.locator(".od-lead").getByTestId("lead-enrollment")).toHaveText("Enrolled on Sep 30");
});

test("Manager: no enrollment or intake panels", async ({ page }) => {
  await signIn(page, "manager");
  await page.goto("/outreach-desk?view=settings");
  await waitForDesk(page);
  await expect(page.getByTestId("settings-attendance")).toBeVisible();
  await expect(page.getByTestId("settings-enrollment")).toHaveCount(0);
  await expect(page.getByTestId("settings-admissions")).toHaveCount(0);
});

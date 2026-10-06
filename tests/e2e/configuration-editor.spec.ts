import { expect, test, type Page, type Request } from "@playwright/test";
import { DESK_API, signIn, waitForDesk } from "./helpers";

/**
 * Lifecycle repair ADM-5 on the mock desk (today = 2026-10-01): the Owner configuration editor in Settings. Each write
 * is the full value just read with one path changed; absent keys read as the server default; a refused PATCH reads
 * issue by issue, by code, never with the server's text.
 */

type Value = Record<string, Record<string, unknown>>;

async function storedValue(page: Page): Promise<Value> {
  const response = await page.request.get("/api/proxy/api/v1/admin/sales-outreach/configuration");
  expect(response.ok()).toBe(true);
  return (await response.json()).data.value as Value;
}

const isConfigurationPatch = (request: Request) => request.method() === "PATCH" && /\/sales-outreach\/configuration(\?|$)/.test(request.url());

async function openSettings(page: Page) {
  await signIn(page, "owner");
  await page.goto("/outreach-desk?view=settings");
  await waitForDesk(page);
  await expect(page.getByTestId("settings-goal-counts")).toBeVisible();
}

test("Owner: the editor reads the stored value — defaults, the revision-6 rule, the priority map", async ({ page }) => {
  await openSettings(page);
  await expect(page.getByTestId("goal-counts-today")).toHaveText("Today the goal counts every outbound call (the default).");

  const rules = page.getByTestId("settings-lead-rules");
  await expect(rules.getByRole("switch", { name: "No phone number → Needs review" })).toHaveAttribute("aria-checked", "true");
  await expect(rules.getByRole("switch", { name: "Admit leads that become eligible later" })).toHaveAttribute("aria-checked", "false");
  await expect(rules.getByRole("switch", { name: "Credit the one active lead on a shared number" })).toHaveAttribute("aria-checked", "false");

  const capture = page.getByTestId("settings-capture-timing");
  await expect(capture.locator('li[data-field="today_coverage_tolerance_minutes"]')).toContainText("Default (25 min)");
  await expect(page.getByTestId("settings-evaluate-drain").locator('li[data-field="evaluate_drain_max_jobs"]')).toContainText("Default (100 jobs)");
  await expect(page.getByTestId("settings-lead-change-intake").locator('li[data-field="decision_reconcile_per_run"]')).toContainText("Default (300 leads)");

  await expect(page.locator("#od-intake-granot_created")).toHaveValue("review");
  const map = page.getByTestId("priority-map");
  await expect(map.locator('tr[data-code="5"]')).toContainText("Closed");
  await expect(map.locator('tr[data-code="5"]')).toContainText("Booked in Granot");
  await expect(page.getByTestId("settings-priority-map")).toContainText("Any other code: No cadence.");
  await expect(page.getByTestId("settings-priority-map").locator("select, input, button")).toHaveCount(0);
});

test("Owner: adding an upcoming goal count and setting drain tunables PATCH the stored value with one path changed", async ({ page }) => {
  await openSettings(page);
  const stored = await storedValue(page);

  await page.getByTestId("goal-counts-day").fill("2026-10-08");
  await page.getByTestId("goal-counts-scope").selectOption("eligible_new_quoted");
  const [countPatch] = await Promise.all([page.waitForRequest(isConfigurationPatch), page.getByTestId("settings-goal-counts").getByRole("button", { name: "Add" }).click()]);
  const countBody = countPatch.postDataJSON() as { expected_revision: number; value: Value };
  expect(countBody.expected_revision).toBe(3);
  expect(countBody.value).toEqual({ ...stored, goals: { ...stored.goals, count_scope_schedule: [{ from_day: "2026-10-08", scope: "eligible_new_quoted" }] } });

  const drain = page.getByTestId("settings-evaluate-drain");
  await drain.locator("#od-tunable-drain-evaluate_drain_max_jobs").fill("300");
  await drain.locator("#od-tunable-drain-evaluate_drain_concurrency").fill("2");
  const [drainPatch] = await Promise.all([page.waitForRequest(isConfigurationPatch), drain.getByRole("button", { name: "Save" }).click()]);
  expect((drainPatch.postDataJSON() as { value: Value }).value).toEqual({ ...stored, operations: { evaluate_drain_max_jobs: 300, evaluate_drain_concurrency: 2 } });
});

test("Owner: an out-of-range tunable is refused in place, without a PATCH", async ({ page }) => {
  await openSettings(page);
  let patches = 0;
  page.on("request", (request) => void (isConfigurationPatch(request) && (patches += 1)));
  const drain = page.getByTestId("settings-evaluate-drain");
  await drain.locator("#od-tunable-drain-evaluate_drain_concurrency").fill("9");
  await drain.getByRole("button", { name: "Save" }).click();
  await expect(drain.getByRole("alert")).toHaveText("Re-checks at once: enter a whole number from 1 to 4, or leave it blank for the default.");
  expect(patches).toBe(0);
});

test("Owner: a refused PATCH reads by code (count_scope_not_prospective, engine_policy_unavailable, any other)", async ({ page }) => {
  await page.route(`${DESK_API}/configuration**`, async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        code: "INVALID_INPUT",
        error: "a server sentence that must not show",
        issues: [
          { path: "goals.count_scope_schedule", code: "count_scope_not_prospective", message: "entries on or before 2026-10-01 cannot change" },
          { path: "cadence", code: "engine_policy_unavailable", message: "website_form review" },
          { path: "cadence", code: "engine_policy_unavailable", message: "manual review" },
          { path: "goals.something_new", code: "a_new_guard" },
        ],
      }),
    });
  });
  await openSettings(page);
  const intake = page.getByTestId("settings-intake-defaults");
  await page.locator("#od-intake-website_form").selectOption("review");
  const error = intake.getByTestId("configuration-error");
  await expect(error).toContainText("The server didn't accept this change:");
  await expect(error.locator("li")).toHaveText([
    "Days that have already started keep their count. Start the new count from tomorrow or later.",
    "The cadence engine can't run with this setting while cadence is on. Keep the native lead sources on New, or switch cadence off first.",
    "The server refused this setting (code a_new_guard).",
  ]);
  await expect(error).not.toContainText("server sentence");
  await expect(error).not.toContainText("website_form");
});

test("Manager: no configuration editor", async ({ page }) => {
  await signIn(page, "manager");
  await page.goto("/outreach-desk?view=settings");
  await waitForDesk(page);
  await expect(page.getByTestId("settings-attendance")).toBeVisible();
  for (const id of ["settings-goal-counts", "settings-lead-rules", "settings-intake-defaults", "settings-priority-map", "settings-capture-timing", "settings-evaluate-drain", "settings-lead-change-intake"]) {
    await expect(page.getByTestId(id)).toHaveCount(0);
  }
});
